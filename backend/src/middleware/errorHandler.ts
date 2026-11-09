import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../core/ApiError';
import { ApiResponse } from '../core/ApiResponse';
import { ZodError } from 'zod';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ApiError) {
    return ApiResponse.error(res, err.message, err.code, err.statusCode, err.details);
  }

  // Handle custom coded errors (e.g. PLAN_LIMIT_REACHED from entitlementService)
  const codedErr = err as any;
  if (codedErr.statusCode && codedErr.code) {
    return ApiResponse.error(res, err.message, codedErr.code, codedErr.statusCode, codedErr.details);
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return ApiResponse.error(res, 'Validation failed', 'VALIDATION_ERROR', 400, details);
  }

  // Log unexpected errors
  console.error('Unexpected Error:', err);

  const message = env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  return ApiResponse.error(res, message, 'INTERNAL_ERROR', 500);
};
