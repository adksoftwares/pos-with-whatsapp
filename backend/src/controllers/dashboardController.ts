import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../core/ApiResponse';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

const getTodayBounds = (timezone: string) => {
  const start = DateTime.now().setZone(timezone).startOf('day');
  const end = DateTime.now().setZone(timezone).endOf('day');
  return { startDate: start.toJSDate(), endDate: end.toJSDate() };
};

export const getDashboardSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    
    // Fetch business timezone
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    const timezone = business?.timezone || 'Asia/Colombo';

    const { startDate, endDate } = getTodayBounds(timezone);

    // Today's Sales
    const salesAgg = await prisma.order.aggregate({
      where: {
        businessId,
        status: 'COMPLETED',
        completedAt: { gte: startDate, lte: endDate }
      },
      _count: { id: true },
      _sum: { grandTotal: true }
    });

    // Today's Items Sold
    const itemsAgg = await prisma.orderItem.aggregate({
      where: {
        order: {
          businessId,
          status: 'COMPLETED',
          completedAt: { gte: startDate, lte: endDate }
        }
      },
      _sum: { quantity: true }
    });

    // Low stock / Out of stock counts
    // Assuming low stock threshold is configurable or default 5 for active products
    const [lowStockCount, outOfStockCount] = await Promise.all([
      prisma.product.count({
        where: {
          businessId,
          status: 'ACTIVE',
          stockQuantity: { gt: 0, lte: 5 } // Using 5 as hardcoded threshold if model doesn't have it
        }
      }),
      prisma.product.count({
        where: {
          businessId,
          status: 'ACTIVE',
          stockQuantity: { lte: 0 }
        }
      })
    ]);

    const todayOrders = salesAgg._count.id;
    const todaySales = Number(salesAgg._sum.grandTotal || 0);

    return ApiResponse.success(res, {
      todaySales,
      todayOrders,
      todayItemsSold: Number(itemsAgg._sum.quantity || 0),
      averageOrderValue: todayOrders > 0 ? todaySales / todayOrders : 0,
      lowStockCount,
      outOfStockCount
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardRecentSales = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;

    const recentOrders = await prisma.order.findMany({
      where: {
        businessId,
        status: 'COMPLETED'
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
      include: {
        payments: { select: { method: true } },
        _count: { select: { items: true } }
      }
    });

    const formatted = recentOrders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      completedAt: o.completedAt,
      grandTotal: Number(o.grandTotal),
      status: o.status,
      itemCount: o._count.items,
      paymentMethod: o.payments.length > 0 ? o.payments[0].method : 'UNKNOWN'
    }));

    return ApiResponse.success(res, formatted);
  } catch (error) {
    next(error);
  }
};

export const getDashboardLowStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;

    // Out of stock
    const outOfStock = await prisma.product.findMany({
      where: { businessId, status: 'ACTIVE', stockQuantity: { lte: 0 } },
      select: { id: true, name: true, sku: true, stockQuantity: true, unit: true },
      take: 5
    });

    // Low stock
    const lowStock = await prisma.product.findMany({
      where: { businessId, status: 'ACTIVE', stockQuantity: { gt: 0, lte: 5 } },
      select: { id: true, name: true, sku: true, stockQuantity: true, unit: true },
      take: 5
    });

    return ApiResponse.success(res, {
      outOfStock: outOfStock.map(p => ({ ...p, stockQuantity: Number(p.stockQuantity) })),
      lowStock: lowStock.map(p => ({ ...p, stockQuantity: Number(p.stockQuantity) }))
    });
  } catch (error) {
    next(error);
  }
};
