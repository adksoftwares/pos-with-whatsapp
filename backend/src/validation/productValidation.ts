import { z } from 'zod';

const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters'),
    description: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters').optional(),
    description: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }),
});

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Product name must be at least 2 characters'),
    sku: z.string().nullable().optional().transform(val => val === '' ? null : val),
    barcode: z.string().nullable().optional().transform(val => val === '' ? null : val),
    categoryId: z.string().uuid('Invalid Category ID').nullable().optional(),
    description: z.string().optional(),
    sellingPrice: z.number().min(0, 'Selling price cannot be negative'),
    costPrice: z.number().min(0, 'Cost price cannot be negative').nullable().optional(),
    stockQuantity: z.number().min(0, 'Initial stock cannot be negative').optional(),
    lowStockThreshold: z.number().min(0, 'Low stock threshold cannot be negative').optional(),
    unit: z.string().min(1, 'Unit is required'),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }).refine(data => {
    if (data.costPrice && data.sellingPrice < data.costPrice) {
      return false; // Can't sell below cost without explicit business logic override
    }
    return true;
  }, {
    message: 'Selling price should not be lower than cost price',
    path: ['sellingPrice'],
  })
});

export const updateProductSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().min(2).optional(),
    sku: z.string().nullable().optional().transform(val => val === '' ? null : val),
    barcode: z.string().nullable().optional().transform(val => val === '' ? null : val),
    categoryId: z.string().uuid().nullable().optional(),
    description: z.string().optional(),
    sellingPrice: z.number().min(0).optional(),
    costPrice: z.number().min(0).nullable().optional(),
    lowStockThreshold: z.number().min(0).optional(),
    unit: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
});

export const updateStatusSchema = z.object({
  params: idParamSchema,
  body: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']),
  }),
});

export const listQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    categoryId: z.string().uuid().optional(),
    stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
    expiryStatus: z.enum(['EXPIRING', 'EXPIRED']).optional(),
    sortBy: z.enum(['name', 'sellingPrice', 'stockQuantity', 'createdAt', 'updatedAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});
