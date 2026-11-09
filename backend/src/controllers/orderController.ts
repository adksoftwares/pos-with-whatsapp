import { Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { ApiError } from '../core/ApiError';
import { ApiResponse } from '../core/ApiResponse';

const prisma = new PrismaClient();

// Helper to validate and calculate order structure securely
const buildValidatedOrder = async (
  businessId: string, 
  items: any[], 
  orderDiscountAmount: number
) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Cart is empty or invalid.');
  }

  const productIds = items.map((i: any) => i.productId);
  
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId }
  });

  const productMap = new Map(products.map(p => [p.id, p]));

  let subtotal = 0;
  let totalItems = 0;
  let totalQuantity = 0;

  const validatedItems = items.map((item: any) => {
    const product = productMap.get(item.productId);
    
    if (!product) {
      throw ApiError.badRequest(`Product ID ${item.productId} not found.`);
    }

    if (product.status !== 'ACTIVE') {
      throw ApiError.badRequest(`Product ${product.name} is inactive and cannot be sold.`);
    }

    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw ApiError.badRequest(`Invalid quantity for product ${product.name}.`);
    }

    if (qty > Number(product.stockQuantity)) {
      throw ApiError.badRequest(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, Requested: ${qty}`);
    }

    const unitPrice = Number(product.sellingPrice);
    const lineDiscount = Number(item.lineDiscount) || 0;
    
    const grossLineTotal = unitPrice * qty;
    const netLineTotal = Math.max(0, grossLineTotal - lineDiscount);

    subtotal += netLineTotal;
    totalItems += 1;
    totalQuantity += qty;

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      company: product.company,
      unit: product.unit,
      unitPrice,
      costPrice: product.costPrice ? Number(product.costPrice) : null,
      quantity: qty,
      lineDiscount,
      netLineTotal,
      stockAvailable: Number(product.stockQuantity)
    };
  });

  const discountAmount = Math.max(0, Number(orderDiscountAmount) || 0);
  if (discountAmount > subtotal) {
    throw ApiError.badRequest('Discount cannot exceed subtotal.');
  }

  const tax = 0; 
  const grandTotal = subtotal - discountAmount + tax;

  return {
    validatedItems,
    subtotal,
    discountAmount,
    tax,
    grandTotal,
    totalItems,
    totalQuantity
  };
};

export const previewOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { items, orderDiscountAmount, customerId } = req.body;
    
    if (customerId && !(await prisma.customer.findFirst({ where: { id: customerId, businessId } }))) throw ApiError.badRequest('Customer does not belong to this business');
    const validatedOrder = await buildValidatedOrder(businessId, items, orderDiscountAmount);

    return ApiResponse.success(res, {
      items: validatedOrder.validatedItems,
      subtotal: validatedOrder.subtotal,
      orderDiscount: validatedOrder.discountAmount,
      tax: validatedOrder.tax,
      grandTotal: validatedOrder.grandTotal,
      totalItems: validatedOrder.totalItems,
      totalQuantity: validatedOrder.totalQuantity
    }, 'Cart validated successfully');

  } catch (error) {
    next(error);
  }
};

const generateOrderNumber = () => {
  const date = new Date();
  const datePart = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `INV-${datePart}-${random}`;
};

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const cashierId = req.user.id;
    const { items, orderDiscountAmount, paymentMethod, amountTendered, referenceNumber, customerId } = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    if (!idempotencyKey) {
      throw ApiError.badRequest('Missing X-Idempotency-Key header');
    }

    // Idempotency check: Return existing order if already processed
    const existingOrder = await prisma.order.findUnique({
      where: { clientTransactionId: idempotencyKey },
      include: { items: { include: { product: { select: { company: true } } } }, payments: true }
    });

    if (existingOrder) {
      return ApiResponse.success(res, existingOrder, 'Order processed successfully');
    }

    if (customerId) { const customer = await prisma.customer.findFirst({ where: { id: String(customerId), businessId } }); if (!customer) throw ApiError.badRequest('Customer does not belong to this business'); }
    const validatedOrder = await buildValidatedOrder(businessId, items, orderDiscountAmount);

    const paymentAmount = validatedOrder.grandTotal;
    const tendered = Number(amountTendered);
    
    if (paymentMethod === 'CASH') {
      if (isNaN(tendered) || tendered < paymentAmount) {
        throw ApiError.badRequest(`Insufficient cash. Required: ${paymentAmount}, Provided: ${tendered}`);
      }
    }

    const changeGiven = paymentMethod === 'CASH' ? tendered - paymentAmount : 0;

    const result = await prisma.$transaction(async (tx) => {
      // Re-verify stock inside transaction
      for (const item of validatedOrder.validatedItems) {
        const p = await tx.product.findUnique({ where: { id: item.productId } });
        if (!p || Number(p.stockQuantity) < item.quantity) {
          throw ApiError.badRequest(`Stock changed during checkout for ${item.name}. Please retry.`);
        }
      }

      // 1. Create Order
      const order = await tx.order.create({
        data: {
          businessId,
          clientTransactionId: idempotencyKey,
          orderNumber: generateOrderNumber(),
          status: 'COMPLETED',
          subtotal: validatedOrder.subtotal,
          discountTotal: validatedOrder.discountAmount,
          taxTotal: validatedOrder.tax,
          grandTotal: paymentAmount,
          paymentStatus: 'PAID',
          cashierId,
          customerId: customerId || null,
          completedAt: new Date()
        }
      });

      // 2. Create Order Items
      const orderItemsData = validatedOrder.validatedItems.map(item => ({
        orderId: order.id,
        productId: item.productId,
        productName: item.name,
        sku: item.sku,
        barcode: item.barcode,
          
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        
        lineDiscount: item.lineDiscount,
        lineTotal: item.netLineTotal,
      }));

      await tx.orderItem.createMany({ data: orderItemsData });

      // 3. Create Payment
      await tx.payment.create({
        data: {
          businessId,
          orderId: order.id,
          method: paymentMethod as any,
          amount: paymentAmount,
          status: 'PAID',
          referenceNumber: referenceNumber || null,
          cashTendered: paymentMethod === 'CASH' ? tendered : paymentAmount,
          changeGiven: changeGiven,
          createdById: cashierId
        }
      });

      // 4. Update Stock & Create Inventory Movements
      for (const item of validatedOrder.validatedItems) {
        // Concurrency-safe: only decrement if enough stock remains (race condition guard)
        const updated = await tx.product.updateMany({
          where: { 
            id: item.productId,
            businessId,
            stockQuantity: { gte: item.quantity }
          },
          data: {
            stockQuantity: { decrement: item.quantity }
          }
        });

        if (updated.count === 0) {
          throw ApiError.badRequest(`Insufficient stock for ${item.name}. Another sale may have just reduced the stock.`);
        }

        await tx.inventoryTransaction.create({
          data: {
            businessId,
            productId: item.productId,
            type: 'SALE',
            quantity: -item.quantity, // Negative for sale deduction
            referenceType: 'ORDER',
            referenceId: order.id,
            createdById: cashierId,
            note: `Sold in ${order.orderNumber}`
          }
        });
      }



      // Update customer lifetime value and reward points when the sale is linked.
      if (customerId) await tx.customer.update({ where: { id: String(customerId) }, data: { totalSpent: { increment: paymentAmount }, loyaltyPoints: { increment: Math.floor(paymentAmount / 100) } } });

      // 5. Create Audit Event
      await tx.auditLog.create({
        data: {
          businessId,
          userId: cashierId,
          action: 'SALE_COMPLETED',
          entityType: 'ORDER',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            grandTotal: paymentAmount,
            paymentMethod
          }
        }
      });

      return order;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    });

    return ApiResponse.success(res, result, 'Sale completed successfully');

  } catch (error) {
    next(error);
  }
};

export const getReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, businessId },
      include: {
        items: true,
        payments: true,
        business: {
          select: {
            name: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            country: true,
            settings: true
          }
        },
        cashier: {
          select: { name: true }
        }
      }
    });

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    return ApiResponse.success(res, order);
  } catch (error) {
    next(error);
  }
};


export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { 
      page = '1', 
      pageSize = '25', 
      search, 
      from, 
      to, 
      paymentMethod, 
      paymentStatus, 
      orderStatus, 
      cashierId 
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, Number(pageSize) || 25)); // max 100 per page
    const skip = (pageNum - 1) * pageSizeNum;
    const take = pageSizeNum;

    const where: any = { businessId };

    if (search) {
      where.orderNumber = { contains: String(search), mode: 'insensitive' };
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(String(from));
      if (to) where.createdAt.lte = new Date(String(to));
    }

    if (paymentStatus) {
      where.paymentStatus = String(paymentStatus);
    }

    if (orderStatus) {
      where.status = String(orderStatus);
    }

    if (cashierId) {
      where.cashierId = String(cashierId);
    }

    if (paymentMethod) {
      where.payments = {
        some: {
          method: String(paymentMethod)
        }
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          cashier: { select: { name: true } },
          payments: { select: { method: true, amount: true } }
        }
      }),
      prisma.order.count({ where })
    ]);

    return ApiResponse.success(res, {
      data: orders,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

