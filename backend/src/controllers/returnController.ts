import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiError } from '../core/ApiError';
import { ApiResponse } from '../core/ApiResponse';

const db = new PrismaClient();

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const returns = await db.saleReturn.findMany({
      where: { businessId: req.businessMembership.businessId },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    return ApiResponse.success(res, returns);
  } catch (e) {
    next(e);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = req.businessMembership.businessId;
    const u = req.user!.id;
    const { orderId, reason, restock = true } = req.body;

    const result = await db.$transaction(async (tx) => {
      const o = await tx.order.findFirst({
        where: {
          businessId: b,
          OR: [{ id: String(orderId) }, { orderNumber: String(orderId) }]
        },
        include: { items: true, payments: true, customer: true }
      });

      if (!o) throw ApiError.notFound('Sale not found');
      if (o.status !== 'COMPLETED') throw ApiError.badRequest('Only completed sales can be returned');
      if (await tx.saleReturn.findFirst({ where: { orderId: o.id } })) {
        throw ApiError.badRequest('This sale has already been returned');
      }

      const r = await tx.saleReturn.create({
        data: {
          businessId: b,
          orderId: o.id,
          amount: o.grandTotal,
          reason: String(reason || 'Customer return'),
          restocked: Boolean(restock),
          processedById: u
        }
      });

      if (restock) {
        for (const item of o.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: Number(item.quantity) } }
            });
            await tx.inventoryTransaction.create({
              data: {
                businessId: b,
                productId: item.productId,
                type: 'RETURN',
                quantity: item.quantity,
                referenceType: 'RETURN',
                referenceId: r.id,
                createdById: u,
                note: 'Returned sale ' + o.orderNumber
              }
            });
          }
        }
      }

      await tx.payment.updateMany({
        where: { orderId: o.id, status: 'PAID' },
        data: { status: 'REFUNDED' }
      });

      await tx.order.update({
        where: { id: o.id },
        data: { status: 'CANCELLED', paymentStatus: 'REFUNDED' }
      });

      if (o.customerId) {
        await tx.customer.update({
          where: { id: o.customerId },
          data: {
            totalSpent: { decrement: Number(o.grandTotal) },
            loyaltyPoints: { decrement: Math.floor(Number(o.grandTotal) / 100) }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          businessId: b,
          userId: u,
          action: 'SALE_RETURN',
          entityType: 'RETURN',
          entityId: r.id,
          details: { orderId: o.id, amount: Number(o.grandTotal), restock: Boolean(restock) }
        }
      });

      return r;
    });

    return ApiResponse.success(res, result, 'Return processed', 201);
  } catch (e) {
    next(e);
  }
};
