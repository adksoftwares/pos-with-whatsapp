import { PrismaClient } from '@prisma/client';
import { ApiError } from '../core/ApiError';

const prisma = new PrismaClient();

export interface SubscriptionInfo {
  planCode: string;
  planName: string;
  status: string;
  productLimit: number;
  productCount: number;
  remaining: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isExpired: boolean;
  isPro: boolean;
  isFree: boolean;
  price: number;
  currency: string;
  billingDays: number | null;
}

export const getActiveSubscription = async (businessId: string) => {
  const subscription = await prisma.subscription.findFirst({
    where: { businessId },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
  return subscription;
};

export const getSubscriptionInfo = async (businessId: string): Promise<SubscriptionInfo> => {
  const subscription = await getActiveSubscription(businessId);

  const freePlan = await prisma.plan.findUnique({ where: { code: 'FREE' } });
  const defaultPlan = freePlan || {
    code: 'FREE',
    name: 'Free Plan',
    productLimit: 10,
    price: 0 as any,
    currency: 'LKR',
    billingDays: null,
  };

  const productCount = await prisma.product.count({
    where: { businessId, status: 'ACTIVE' },
  });

  if (!subscription) {
    return {
      planCode: defaultPlan.code,
      planName: defaultPlan.name,
      status: 'ACTIVE',
      productLimit: defaultPlan.productLimit,
      productCount,
      remaining: Math.max(0, defaultPlan.productLimit - productCount),
      startsAt: null,
      expiresAt: null,
      isExpired: false,
      isPro: false,
      isFree: true,
      price: Number(defaultPlan.price),
      currency: defaultPlan.currency,
      billingDays: defaultPlan.billingDays,
    };
  }

  // Check if subscription is expired by time (server-authoritative)
  const now = new Date();
  const isExpired =
    subscription.plan.code !== 'FREE' &&
    subscription.expiresAt !== null &&
    now >= subscription.expiresAt;

  // If subscription should be expired but DB still says ACTIVE, update it
  if (isExpired && subscription.status === 'ACTIVE') {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    });
    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        businessId,
        eventType: 'PRO_EXPIRED',
        metadata: { autoExpiredAt: now },
      },
    });
    subscription.status = 'EXPIRED';
  }

  const effectiveStatus = isExpired ? 'EXPIRED' : subscription.status;
  const effectivePlan = isExpired ? defaultPlan : subscription.plan;
  const effectiveProductLimit = isExpired
    ? defaultPlan.productLimit
    : subscription.plan.productLimit;

  return {
    planCode: effectivePlan.code,
    planName: effectivePlan.name,
    status: effectiveStatus,
    productLimit: effectiveProductLimit,
    productCount,
    remaining: Math.max(0, effectiveProductLimit - productCount),
    startsAt: subscription.startsAt,
    expiresAt: subscription.expiresAt,
    isExpired,
    isPro: effectivePlan.code === 'PRO' && !isExpired,
    isFree: effectivePlan.code === 'FREE' || isExpired,
    price: Number(subscription.plan.price),
    currency: subscription.plan.currency,
    billingDays: subscription.plan.billingDays,
  };
};

export const checkProductLimit = async (businessId: string): Promise<void> => {
  const info = await getSubscriptionInfo(businessId);

  if (info.productCount >= info.productLimit) {
    throw new ApiError(
      403,
      'Product limit reached for your current plan. Please upgrade to add more products.',
      'PLAN_LIMIT_REACHED',
      {
        current: info.productCount,
        limit: info.productLimit,
        plan: info.planCode,
      }
    );
  }
};
