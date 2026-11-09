import { Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { ApiError } from '../core/ApiError';
import { ApiResponse } from '../core/ApiResponse';
import { checkProductLimit } from '../services/entitlementService';

const prisma = new PrismaClient();


export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { 
      name, sku, barcode, categoryId, description, company, expiryDate,
      mrpPrice, sellingPrice, discountReceived, discountAllowed,
      costPrice, stockQuantity, lowStockThreshold, unitSize, unit, status 
    } = req.body;

    const cleanBarcode = barcode?.trim() || null;
    const cleanSku = sku?.trim() || null;
    const incomingStock = Number(stockQuantity) || 0;

    let existingProduct = null;
    
    // Check if barcode or sku exists for upsert
    if (cleanBarcode) {
      existingProduct = await prisma.product.findUnique({ where: { businessId_barcode: { businessId, barcode: cleanBarcode } } });
    }
    if (!existingProduct && cleanSku) {
      existingProduct = await prisma.product.findUnique({ where: { businessId_sku: { businessId, sku: cleanSku } } });
    }

    if (categoryId) {
      const cat = await prisma.category.findFirst({ where: { id: categoryId, businessId } });
      if (!cat) throw ApiError.badRequest('Invalid category');
    }

    const result = await prisma.$transaction(async (tx) => {
      let product;
      if (existingProduct) {
        // UPSERT: If exists, update stock and other provided details
        product = await tx.product.update({
          where: { id: existingProduct.id },
          data: {
            name: name || existingProduct.name,
            categoryId: categoryId || existingProduct.categoryId,
            description: description !== undefined ? description : existingProduct.description,
            company: company !== undefined ? company : existingProduct.company,
            expiryDate: expiryDate ? new Date(expiryDate) : existingProduct.expiryDate,
            mrpPrice: mrpPrice !== undefined ? mrpPrice : existingProduct.mrpPrice,
            sellingPrice: sellingPrice !== undefined ? sellingPrice : existingProduct.sellingPrice,
            discountReceived: discountReceived !== undefined ? discountReceived : existingProduct.discountReceived,
            discountAllowed: discountAllowed !== undefined ? discountAllowed : existingProduct.discountAllowed,
            costPrice: costPrice !== undefined ? costPrice : existingProduct.costPrice,
            stockQuantity: { increment: incomingStock }, // Increase stock
            lowStockThreshold: lowStockThreshold !== undefined ? lowStockThreshold : existingProduct.lowStockThreshold,
            unitSize: unitSize !== undefined ? unitSize : existingProduct.unitSize,
            unit: unit || existingProduct.unit,
            status: status || existingProduct.status
          }
        });

        if (incomingStock > 0) {
          await tx.inventoryTransaction.create({
            data: {
              businessId,
              productId: product.id,
              type: 'PURCHASE',
              quantity: incomingStock,
              createdById: req.user.id,
              note: 'Stock received via upsert',
            }
          });
        }
      } else {
        // CREATE: Check limit first before creating new
        await checkProductLimit(businessId);
        
        product = await tx.product.create({
          data: {
            businessId,
            name, sku: cleanSku, barcode: cleanBarcode, categoryId, description, company,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            mrpPrice, sellingPrice, discountReceived, discountAllowed, costPrice, 
            stockQuantity: incomingStock, 
            lowStockThreshold: lowStockThreshold || 0, 
            unitSize, unit, status
          },
        });

        if (incomingStock > 0) {
          await tx.inventoryTransaction.create({
            data: {
              businessId,
              productId: product.id,
              type: 'OPENING',
              quantity: incomingStock,
              createdById: req.user.id,
              note: 'Initial opening stock',
            }
          });
        }
      }
      return product;
    });

    return ApiResponse.success(res, result, existingProduct ? 'Product stock updated successfully' : 'Product created successfully', existingProduct ? 200 : 201);
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { search, status, categoryId, stockStatus, updatedAfter } = req.query as any;
    const page = (req.query.page && req.query.page !== 'undefined') ? Number(req.query.page) : 1;
    const limit = (req.query.limit && req.query.limit !== 'undefined') ? Number(req.query.limit) : 
                  (req.query.pageSize && req.query.pageSize !== 'undefined') ? Number(req.query.pageSize) : 50;
    const sortBy = (req.query.sortBy && req.query.sortBy !== 'undefined') ? (req.query.sortBy as string) : 'name';
    const sortOrder = (req.query.sortOrder && req.query.sortOrder !== 'undefined') ? (req.query.sortOrder as string) : 'asc';

    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { businessId };

    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (updatedAfter) {
      where.updatedAt = { gt: new Date(updatedAfter) };
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
      ];
    }

    if (stockStatus) {
      if (stockStatus === 'OUT_OF_STOCK') {
        where.stockQuantity = { lte: 0 };
      }
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { category: { select: { name: true } } },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      })
    ]);

    return ApiResponse.success(res, {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: { id, businessId },
      include: { category: true }
    });

    if (!product) throw ApiError.notFound('Product not found');
    return ApiResponse.success(res, product);
  } catch (error) {
    next(error);
  }
};

export const getProductByBarcode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const cleanBarcode = req.params.barcode?.trim();

    if (!cleanBarcode) {
      throw ApiError.badRequest('Barcode is required');
    }

    const product = await prisma.product.findUnique({
      where: { businessId_barcode: { businessId, barcode: cleanBarcode } },
      include: { category: { select: { name: true } } }
    });

    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    // Checking if inactive happens on frontend, or we can flag it here. 
    // We return it anyway so the frontend can display the "Product Inactive" warning cleanly.
    return ApiResponse.success(res, product);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { id } = req.params;
    const { 
      name, sku, barcode, categoryId, description, company, expiryDate,
      mrpPrice, sellingPrice, discountReceived, discountAllowed,
      costPrice, stockQuantity, lowStockThreshold, unitSize, unit, status 
    } = req.body;

    const cleanBarcode = barcode?.trim() || null;
    const incomingStock = Number(stockQuantity) || 0;

    const existing = await prisma.product.findFirst({ where: { id, businessId } });
    if (!existing) throw ApiError.notFound('Product not found');

    if (sku && sku !== existing.sku) {
      const existingSku = await prisma.product.findUnique({ where: { businessId_sku: { businessId, sku } } });
      if (existingSku) throw ApiError.badRequest('SKU already exists');
    }
    if (cleanBarcode && cleanBarcode !== existing.barcode) {
      const existingBarcode = await prisma.product.findUnique({ where: { businessId_barcode: { businessId, barcode: cleanBarcode } } });
      if (existingBarcode) throw ApiError.badRequest('Barcode already exists');
    }
    if (categoryId && categoryId !== existing.categoryId) {
      const cat = await prisma.category.findFirst({ where: { id: categoryId, businessId } });
      if (!cat) throw ApiError.badRequest('Invalid category');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          name, sku, barcode: cleanBarcode, categoryId, description, company,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          mrpPrice, sellingPrice, discountReceived, discountAllowed,
          costPrice, lowStockThreshold, unitSize, unit, status,
          ...(incomingStock > 0 ? { stockQuantity: { increment: incomingStock } } : {})
        },
      });

      if (incomingStock > 0) {
        await tx.inventoryTransaction.create({
          data: {
            businessId,
            productId: product.id,
            type: 'PURCHASE',
            quantity: incomingStock,
            createdById: req.user.id,
            note: 'Stock received via edit product form',
          }
        });
      }

      return product;
    });

    return ApiResponse.success(res, updated, incomingStock > 0 ? 'Product and stock updated successfully' : 'Product updated successfully');
  } catch (error) {
    next(error);
  }
};

export const updateProductStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { id } = req.params;
    const { status } = req.body;

    const existing = await prisma.product.findFirst({ where: { id, businessId } });
    if (!existing) throw ApiError.notFound('Product not found');

    const updated = await prisma.product.update({
      where: { id },
      data: { status },
    });

    return ApiResponse.success(res, updated, `Product marked as ${status}`);
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req:Request,res:Response,next:NextFunction)=>{
 try{
  const businessId=req.businessMembership.businessId,userId=req.user!.id,productId=req.params.id,delta=Number(req.body.quantity),reason=String(req.body.reason||'Manual adjustment').trim();
  if(!Number.isFinite(delta)||delta===0)throw ApiError.badRequest('Adjustment quantity must be non-zero');
  if(!['OWNER','ADMIN','MANAGER'].includes(req.businessMembership.role))throw ApiError.forbidden('Management access required');
  const product=await prisma.product.findFirst({where:{id:productId,businessId}});if(!product)throw ApiError.notFound('Product not found');
  const updated=await prisma.$transaction(async tx=>{
   const change=await tx.product.updateMany({where:{id:productId,businessId,...(delta<0?{stockQuantity:{gte:Math.abs(delta)}}:{})},data:{stockQuantity:{increment:delta}}});
   if(!change.count)throw ApiError.badRequest('Adjustment would make stock negative');
   await tx.inventoryTransaction.create({data:{businessId,productId,type:'ADJUSTMENT',quantity:delta,referenceType:'MANUAL',createdById:userId,note:reason}});
   await tx.auditLog.create({data:{businessId,userId,action:'STOCK_ADJUSTMENT',entityType:'PRODUCT',entityId:productId,details:{delta,reason}}});
   return tx.product.findUnique({where:{id:productId}});
  });
  return ApiResponse.success(res,updated,'Stock adjusted');
 }catch(e){next(e)}
};
