import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../core/ApiResponse';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

const getBusinessDateRange = (timezone: string, from?: any, to?: any) => {
  const startDate = from 
    ? DateTime.fromISO(from as string, { zone: timezone }).startOf('day').toJSDate()
    : DateTime.now().setZone(timezone).startOf('day').toJSDate();

  const endDate = to
    ? DateTime.fromISO(to as string, { zone: timezone }).endOf('day').toJSDate()
    : DateTime.now().setZone(timezone).endOf('day').toJSDate();

  return { startDate, endDate };
};

export const getSalesSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { from, to } = req.query;
    const business = await prisma.business.findUnique({ where: { id: businessId } }); const tz = business?.timezone || "Asia/Colombo"; const { startDate, endDate } = getBusinessDateRange(tz, from, to);

    const aggregates = await prisma.order.aggregate({
      where: {
        businessId,
        status: 'COMPLETED',
        completedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      _count: { id: true },
      _sum: {
        grandTotal: true,
        discountTotal: true,
        taxTotal: true,
        subtotal: true
      }
    });

    const itemsSold = await prisma.orderItem.aggregate({
      where: {
        order: {
          businessId,
          status: 'COMPLETED',
          completedAt: { gte: startDate, lte: endDate }
        }
      },
      _sum: { quantity: true }
    });

    const orderCount = aggregates._count.id;
    const netSales = Number(aggregates._sum.grandTotal || 0);

    return ApiResponse.success(res, {
      netSales,
      orderCount,
      itemsSold: Number(itemsSold._sum.quantity || 0),
      discountTotal: Number(aggregates._sum.discountTotal || 0),
      taxTotal: Number(aggregates._sum.taxTotal || 0),
      subtotal: Number(aggregates._sum.subtotal || 0),
      averageOrderValue: orderCount > 0 ? netSales / orderCount : 0,
      period: { from: startDate, to: endDate }
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentMethodsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { from, to } = req.query;
    const business = await prisma.business.findUnique({ where: { id: businessId } }); const tz = business?.timezone || "Asia/Colombo"; const { startDate, endDate } = getBusinessDateRange(tz, from, to);

    // Grouping by payment method using Prisma groupBy
    const payments = await prisma.payment.groupBy({
      by: ['method'],
      where: {
        businessId,
        status: 'PAID',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    const report = payments.map(p => ({
      method: p.method,
      amount: Number(p._sum.amount || 0),
      count: p._count.id
    }));

    return ApiResponse.success(res, report);
  } catch (error) {
    next(error);
  }
};

export const getProductAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { from, to, sort = 'revenue_desc' } = req.query;
    const business = await prisma.business.findUnique({ where: { id: businessId } }); const tz = business?.timezone || "Asia/Colombo"; const { startDate, endDate } = getBusinessDateRange(tz, from, to);
    const role = req.businessMembership.role;

    // We only aggregate completed orders
    const items = await prisma.orderItem.groupBy({
      by: ['productId', 'productName', 'sku'],
      where: {
        order: {
          businessId,
          status: 'COMPLETED',
          completedAt: { gte: startDate, lte: endDate }
        }
      },
      _sum: {
        quantity: true,
        lineTotal: true
      },
      _count: {
        orderId: true
      }
    });

    let formatted = items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantitySold: Number(item._sum.quantity || 0),
      revenue: Number(item._sum.lineTotal || 0),
      orderCount: item._count.orderId,
    }));

    // Sorting
    if (sort === 'qty_desc') formatted.sort((a, b) => b.quantitySold - a.quantitySold);
    else if (sort === 'qty_asc') formatted.sort((a, b) => a.quantitySold - b.quantitySold);
    else if (sort === 'revenue_desc') formatted.sort((a, b) => b.revenue - a.revenue);
    else if (sort === 'revenue_asc') formatted.sort((a, b) => a.revenue - b.revenue);

    return ApiResponse.success(res, formatted);
  } catch (error) {
    next(error);
  }
};

export const getSalesByDate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { from, to } = req.query;
    const business = await prisma.business.findUnique({ where: { id: businessId } }); const tz = business?.timezone || "Asia/Colombo"; const { startDate, endDate } = getBusinessDateRange(tz, from, to);

    // Naive raw query for grouping by date (PostgreSQL specific date truncation)
    // To remain ORM agnostic and safely handle different DBs, we'll pull minimal data and group in memory 
    // since this is a date-bounded query anyway.
    
    const orders = await prisma.order.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        completedAt: { gte: startDate, lte: endDate }
      },
      select: {
        completedAt: true,
        grandTotal: true
      }
    });

    const dailyMap = new Map<string, { date: string, sales: number, orders: number }>();

    orders.forEach(order => {
      if (!order.completedAt) return;
      const dateStr = DateTime.fromJSDate(order.completedAt).setZone(tz).toISODate() || '';
      const existing = dailyMap.get(dateStr) || { date: dateStr, sales: 0, orders: 0 };
      existing.sales += Number(order.grandTotal);
      existing.orders += 1;
      dailyMap.set(dateStr, existing);
    });

    const result = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};
