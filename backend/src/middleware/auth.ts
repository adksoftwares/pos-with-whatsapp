import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../core/ApiError';
import { verifyToken } from '../utils/jwt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      user?: any;
      businessMembership?: any;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { memberships: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw ApiError.unauthorized('Invalid or inactive user');
    }

    req.user = user;
    next();
  } catch (error) {
    next(ApiError.unauthorized('Invalid token'));
  }
};

/**
 * Ensures the authenticated user has access to a specific business context.
 * The frontend must pass `X-Business-Id` header for operations requiring store context.
 */
export const requireBusinessAccess = (allowedRoles?: Role[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.headers['x-business-id'] as string;
      
      if (!businessId) {
        throw ApiError.badRequest('Business context required (X-Business-Id header missing)');
      }

      if (!req.user) {
        throw ApiError.unauthorized();
      }

      const membership = req.user.memberships.find((m: any) => m.businessId === businessId);
      
      if (!membership) {
        throw ApiError.forbidden('You do not have access to this business');
      }

      if (allowedRoles && !allowedRoles.includes(membership.role)) {
        throw ApiError.forbidden('You do not have sufficient permissions for this action');
      }

      req.businessMembership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Ensures the authenticated user is a platform-level Super Admin.
 * Super Admin is NOT a business role — it's a platform-level flag on the User record.
 * This middleware must be used on all subscription administration and platform-level endpoints.
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.isSuperAdmin) {
    // Log unauthorized access attempt
    console.warn(`[SECURITY] Unauthorized Super Admin access attempt by user ${req.user?.id} from ${req.ip}`);
    return next(new ApiError(403, 'Super Admin access required. This action is restricted to platform administrators.', 'SUPER_ADMIN_REQUIRED'));
  }
  next();
};
