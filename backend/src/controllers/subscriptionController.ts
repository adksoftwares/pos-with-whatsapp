import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiError } from '../core/ApiError';
import { ApiResponse } from '../core/ApiResponse';
import { getSubscriptionInfo, getActiveSubscription } from '../services/entitlementService';

const prisma = new PrismaClient();

// ─── Helper ───────────────────────────────────────────────────────────────────

const requireSuperAdmin = (req: Request) => {
  if (!req.user?.isSuperAdmin) {
    throw ApiError.forbidden(
      'Super Admin access required. This action is restricted to platform administrators.'
    );
  }
};

// ─── Business-facing endpoints ────────────────────────────────────────────────

// GET /api/v1/subscription — current business subscription info
export const getMySubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const businessId = req.businessMembership.businessId;
    const info = await getSubscriptionInfo(businessId);
    return ApiResponse.success(res, info, 'Subscription info retrieved');
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/subscription/plans — all active plans
export const getPlans = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
    return ApiResponse.success(res, plans, 'Plans retrieved');
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/subscription/history — subscription history for current business
export const getSubscriptionHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const businessId = req.businessMembership.businessId;
    const events = await prisma.subscriptionEvent.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        performedBy: { select: { id: true, name: true } },
      },
    });
    return ApiResponse.success(res, events, 'Subscription history retrieved');
  } catch (error) {
    next(error);
  }
};

// ─── Super Admin endpoints ────────────────────────────────────────────────────

// GET /api/v1/subscription/admin/all
export const adminListSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    requireSuperAdmin(req);
    const { search, page = 1, limit = 20 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const nameFilter = search
      ? { name: { contains: search as string, mode: 'insensitive' as const } }
      : {};

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where: nameFilter,
        include: {
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { products: { where: { status: 'ACTIVE' } } } },
        },
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' },
      }),
      prisma.business.count({ where: nameFilter }),
    ]);

    const now = new Date();
    const result = businesses.map((b) => {
      const latestSub = b.subscriptions[0] || null;
      const isExpired =
        latestSub?.plan.code !== 'FREE' &&
        latestSub?.expiresAt &&
        now >= latestSub.expiresAt;
      return {
        businessId: b.id,
        businessName: b.name,
        productCount: b._count.products,
        plan: latestSub
          ? {
              code: latestSub.plan.code,
              name: latestSub.plan.name,
              productLimit: latestSub.plan.productLimit,
            }
          : { code: 'NONE', name: 'No Plan', productLimit: 10 },
        status: isExpired ? 'EXPIRED' : latestSub?.status || 'NONE',
        subscriptionId: latestSub?.id || null,
        startsAt: latestSub?.startsAt || null,
        expiresAt: latestSub?.expiresAt || null,
        activatedAt: latestSub?.activatedAt || null,
      };
    });

    return ApiResponse.success(res, {
      businesses: result,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/subscription/admin/:businessId
export const adminGetBusinessSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    requireSuperAdmin(req);
    const { businessId } = req.params;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { _count: { select: { products: { where: { status: 'ACTIVE' } } } } },
    });
    if (!business) throw ApiError.notFound('Business not found');

    const [info, events] = await Promise.all([
      getSubscriptionInfo(businessId),
      prisma.subscriptionEvent.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { performedBy: { select: { id: true, name: true } } },
      }),
    ]);

    return ApiResponse.success(res, {
      business: { id: business.id, name: business.name, productCount: business._count.products },
      subscription: info,
      history: events,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/subscription/admin/:businessId/activate
export const adminActivatePro = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    requireSuperAdmin(req);
    const { businessId } = req.params;
    const { reason } = req.body;

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw ApiError.notFound('Business not found');

    const proPlan = await prisma.plan.findUnique({ where: { code: 'PRO' } });
    if (!proPlan) throw ApiError.internal('PRO plan not configured. Please run the plan seeder.');

    // Check for already active PRO subscription
    const existing = await prisma.subscription.findFirst({
      where: { businessId, status: 'ACTIVE', plan: { code: 'PRO' } },
      include: { plan: true },
    });
    if (existing) {
      throw new ApiError(409, 'Business already has an active PRO subscription.', 'DUPLICATE_ACTIVATION');
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + (proPlan.billingDays || 30));

    await prisma.$transaction(async (tx) => {
      // Cancel any existing active subscriptions
      await tx.subscription.updateMany({
        where: { businessId, status: 'ACTIVE' },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: 'Superseded by new PRO activation',
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          businessId,
          planId: proPlan.id,
          status: 'ACTIVE',
          startsAt: now,
          expiresAt,
          activatedAt: now,
          activatedById: req.user.id,
        },
        include: { plan: true },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          businessId,
          eventType: 'PRO_ACTIVATED',
          performedById: req.user.id,
          reason: reason || 'Manual Super Admin activation',
          metadata: { startsAt: now, expiresAt },
        },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId: req.user.id,
          action: 'PRO_ACTIVATED',
          entityType: 'SUBSCRIPTION',
          entityId: subscription.id,
          details: { reason, startsAt: now, expiresAt },
        },
      });

      return subscription;
    });

    const info = await getSubscriptionInfo(businessId);
    return ApiResponse.success(res, info, 'PRO plan activated successfully');
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/subscription/admin/:businessId/reactivate
export const adminReactivatePro = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    requireSuperAdmin(req);
    const { businessId } = req.params;
    const { reason } = req.body;

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw ApiError.notFound('Business not found');

    const proPlan = await prisma.plan.findUnique({ where: { code: 'PRO' } });
    if (!proPlan) throw ApiError.internal('PRO plan not configured.');

    // Find most recent PRO subscription to reference in event metadata
    const prevSub = await prisma.subscription.findFirst({
      where: { businessId, plan: { code: 'PRO' } },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + (proPlan.billingDays || 30));

    await prisma.$transaction(async (tx) => {
      // Cancel any existing active subscriptions
      await tx.subscription.updateMany({
        where: { businessId, status: 'ACTIVE' },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: 'Superseded by reactivation',
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          businessId,
          planId: proPlan.id,
          status: 'ACTIVE',
          startsAt: now,
          expiresAt,
          activatedAt: now,
          activatedById: req.user.id,
        },
        include: { plan: true },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          businessId,
          eventType: 'PRO_REACTIVATED',
          performedById: req.user.id,
          reason: reason || 'Manual Super Admin reactivation',
          metadata: { previousSubId: prevSub?.id, startsAt: now, expiresAt },
        },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId: req.user.id,
          action: 'PRO_REACTIVATED',
          entityType: 'SUBSCRIPTION',
          entityId: subscription.id,
          details: { reason, startsAt: now, expiresAt },
        },
      });

      return subscription;
    });

    const info = await getSubscriptionInfo(businessId);
    return ApiResponse.success(res, info, 'PRO plan reactivated successfully');
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/subscription/admin/:businessId/cancel
export const adminCancelSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    requireSuperAdmin(req);
    const { businessId } = req.params;
    const { reason } = req.body;

    const activeSub = await prisma.subscription.findFirst({
      where: { businessId, status: 'ACTIVE' },
      include: { plan: true },
    });

    if (!activeSub) throw ApiError.notFound('No active subscription found');
    if (activeSub.plan.code === 'FREE') throw ApiError.badRequest('Cannot cancel the Free plan');

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: activeSub.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: reason || 'Cancelled by Super Admin',
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: activeSub.id,
          businessId,
          eventType: 'PRO_CANCELLED',
          performedById: req.user.id,
          reason: reason || 'Cancelled by Super Admin',
        },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId: req.user.id,
          action: 'PRO_CANCELLED',
          entityType: 'SUBSCRIPTION',
          entityId: activeSub.id,
          details: { reason },
        },
      });
    });

    const info = await getSubscriptionInfo(businessId);
    return ApiResponse.success(res, info, 'Subscription cancelled');
  } catch (error) {
    next(error);
  }
};
