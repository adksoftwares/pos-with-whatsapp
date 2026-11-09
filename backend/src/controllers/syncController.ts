import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiError } from '../core/ApiError';
import { ApiResponse } from '../core/ApiResponse';

const prisma = new PrismaClient();

export const syncOfflineOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const payload = req.body;
    const clientTransactionId = payload.clientTransactionId;

    if (!clientTransactionId) {
      throw ApiError.badRequest('clientTransactionId is required for offline sync.');
    }

    // Idempotency check
    const existing = await prisma.order.findUnique({
      where: { clientTransactionId }
    });

    if (existing) {
      // Already synced, return success idempotently
      return ApiResponse.success(res, { id: existing.id, status: 'ALREADY_SYNCED' });
    }

    // Process identically to createOrder but inside a strict transaction
    const { items, orderDiscountAmount, paymentMethod, amountTendered, referenceNumber } = payload;
    const cashierId = req.user.id;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Build and validate order based on current product state
      // Note: A true robust offline system might preserve the offline price forcefully. 
      // We will re-validate for safety but use the current catalog price.
      const productIds = items.map((i: any) => i.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds }, businessId } });
      const productMap = new Map(products.map(p => [p.id, p]));

      let subtotal = 0;
      let totalQuantity = 0;
      const validatedItems = items.map((item: any) => {
        const product = productMap.get(item.productId);
        if (!product) throw ApiError.badRequest(`Product ${item.productId} not found.`);
        if (product.status !== 'ACTIVE') throw ApiError.badRequest(`Product ${product.name} inactive.`);
        
        const qty = Number(item.quantity);
        if (qty > Number(product.stockQuantity)) {
          throw ApiError.badRequest(`Insufficient stock for ${product.name}.`); // Triggers CONFLICT on client
        }

        const unitPrice = Number(product.sellingPrice);
        const lineDiscount = Number(item.lineDiscount) || 0;
        const netLineTotal = Math.max(0, (unitPrice * qty) - lineDiscount);

        subtotal += netLineTotal;
        totalQuantity += qty;

        return { ...item, product, unitPrice, netLineTotal, qty };
      });

      const discountAmount = Math.max(0, Number(orderDiscountAmount) || 0);
      const tax = 0;
      const grandTotal = subtotal - discountAmount + tax;

      // 2. Generate Order Number
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
      const count = await tx.order.count({
        where: { businessId, createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } }
      });
      const orderNumber = `INV-${dateStr}-${String(count + 1).padStart(5, '0')}`;

      // 3. Create Order
      const order = await tx.order.create({
        data: {
          businessId,
          clientTransactionId,
          orderNumber,
          subtotal,
          discountTotal: discountAmount,
          taxTotal: tax,
          grandTotal,
          paymentStatus: 'PAID',
          cashierId,
          completedAt: new Date()
        }
      });

      // 4. Create Items
      await tx.orderItem.createMany({
        data: validatedItems.map((vi: any) => ({
          orderId: order.id,
          productId: vi.productId,
          productName: vi.product.name,
          sku: vi.product.sku,
          barcode: vi.product.barcode,
          unit: vi.product.unit,
          quantity: vi.qty,
          unitPrice: vi.unitPrice,
          costPrice: vi.product.costPrice ? Number(vi.product.costPrice) : null,
          lineDiscount: vi.lineDiscount,
          lineTotal: vi.netLineTotal
        }))
      });

      // 5. Payment
      await tx.payment.create({
        data: {
          businessId,
          orderId: order.id,
          method: paymentMethod,
          amount: amountTendered,
          status: 'PAID',
          referenceNumber,
          createdById: cashierId
        }
      });

      // 6. Deduct Stock & Audit
      for (const vi of validatedItems) {
        const updateRes = await tx.product.updateMany({
          where: { 
            id: vi.productId,
            stockQuantity: { gte: vi.qty } // Concurrency guard
          },
          data: { stockQuantity: { decrement: vi.qty } }
        });
        
        if (updateRes.count === 0) {
           throw ApiError.badRequest(`Insufficient stock for ${vi.product.name} during final commit.`);
        }
        await tx.inventoryTransaction.create({
          data: {
            businessId,
            productId: vi.productId,
            type: 'SALE',
            quantity: vi.qty,
            note: `Offline sale ${orderNumber}`,
            referenceId: order.id,
            createdById: cashierId
          }
        });
      }

      await tx.auditLog.create({
        data: {
          businessId,
          userId: cashierId,
          action: 'OFFLINE_ORDER_SYNC',
          entityType: 'ORDER',
          entityId: order.id,
          details: { clientTransactionId }
        }
      });

      return order;
    });

    return ApiResponse.success(res, result, 'Order synced successfully', 201);
  } catch (error) {
    next(error);
  }
};
