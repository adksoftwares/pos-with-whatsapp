import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedPlans = async () => {
  // FREE Plan
  await prisma.plan.upsert({
    where: { code: 'FREE' },
    update: {},
    create: {
      code: 'FREE',
      name: 'Free Plan',
      description: 'Get started with up to 10 products at no cost.',
      price: 0,
      currency: 'LKR',
      billingDays: null,
      productLimit: 10,
      isActive: true,
    },
  });

  // PRO Plan
  await prisma.plan.upsert({
    where: { code: 'PRO' },
    update: {},
    create: {
      code: 'PRO',
      name: 'Pro Plan',
      description: 'Unlimited products, advanced reports, and priority support.',
      price: 2500,
      currency: 'LKR',
      billingDays: 30,
      productLimit: 500,
      isActive: true,
    },
  });

  console.log('Plans seeded successfully');
};

if (require.main === module) {
  seedPlans().finally(() => prisma.$disconnect());
}
