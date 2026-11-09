import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiError } from '../core/ApiError';
import { ApiResponse } from '../core/ApiResponse';

const prisma = new PrismaClient();

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { name, description, status } = req.body;

    const existing = await prisma.category.findUnique({
      where: { businessId_name: { businessId, name } },
    });

    if (existing) {
      throw ApiError.badRequest('Category with this name already exists');
    }

    const category = await prisma.category.create({
      data: { businessId, name, description, status },
    });

    return ApiResponse.success(res, category, 'Category created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    
    const categories = await prisma.category.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });

    return ApiResponse.success(res, categories);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { id } = req.params;
    const { name, description, status } = req.body;

    const existing = await prisma.category.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw ApiError.notFound('Category not found');
    }

    if (name && name !== existing.name) {
      const duplicate = await prisma.category.findUnique({
        where: { businessId_name: { businessId, name } },
      });
      if (duplicate) {
        throw ApiError.badRequest('Category with this name already exists');
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name, description, status },
    });

    return ApiResponse.success(res, updated, 'Category updated successfully');
  } catch (error) {
    next(error);
  }
};
