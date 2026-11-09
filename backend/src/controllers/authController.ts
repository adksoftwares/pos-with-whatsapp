import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { ApiError } from '../core/ApiError';
import { ApiResponse } from '../core/ApiResponse';
import { generateToken } from '../utils/jwt';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, businessName } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw ApiError.badRequest('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Use transaction to ensure both user and business are created safely
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash },
      });

      const business = await tx.business.create({
        data: { 
          name: businessName,
          ownerId: user.id 
        },
      });

      await tx.businessMembership.create({
        data: {
          userId: user.id,
          businessId: business.id,
          role: 'OWNER',
        },
      });

      // Create default FREE subscription for new business
      const freePlan = await tx.plan.findUnique({ where: { code: 'FREE' } });
      if (freePlan) {
        const subscription = await tx.subscription.create({
          data: {
            businessId: business.id,
            planId: freePlan.id,
            status: 'ACTIVE',
            startsAt: new Date(),
            expiresAt: null,
          },
        });
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            businessId: business.id,
            eventType: 'FREE_ASSIGNED',
            metadata: { autoAssigned: true },
          },
        });
      }

      return { user, business };
    });

    const token = generateToken({ userId: result.user.id });

    // Exclude password hash from response
    const { passwordHash: _, ...safeUser } = result.user;

    return ApiResponse.success(res, { user: safeUser, token }, 'Registration successful', 201);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { memberships: { include: { business: true } } }
    });

    if (!user || user.status !== 'ACTIVE') {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const token = generateToken({ userId: user.id });
    const { passwordHash: _, ...safeUser } = user;

    return ApiResponse.success(res, { user: safeUser, token }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { memberships: { include: { business: true } } }
    });
    
    if (!user) throw ApiError.notFound('User not found');
    
    const { passwordHash: _, ...safeUser } = user;
    return ApiResponse.success(res, { user: safeUser }, 'User retrieved');
  } catch (error) {
    next(error);
  }
};
