import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiError } from '../core/ApiError';
import { ApiResponse } from '../core/ApiResponse';

const prisma = new PrismaClient();

export const getPrinters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const printers = await prisma.printerProfile.findMany({ where: { businessId } });
    return ApiResponse.success(res, printers);
  } catch (error) {
    next(error);
  }
};

export const createPrinter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { name, paperWidth, connectionType, vendor, model, isDefault, enabled } = req.body;

    if (isDefault) {
      await prisma.printerProfile.updateMany({
        where: { businessId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const printer = await prisma.printerProfile.create({
      data: {
        businessId,
        name,
        paperWidth: paperWidth || '58mm',
        connectionType: connectionType || 'BROWSER',
        vendor,
        model,
        isDefault: isDefault || false,
        enabled: enabled ?? true
      }
    });

    return ApiResponse.success(res, printer, 'Printer created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updatePrinter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { id } = req.params;
    const { name, paperWidth, connectionType, vendor, model, isDefault, enabled } = req.body;

    const existing = await prisma.printerProfile.findFirst({ where: { id, businessId } });
    if (!existing) throw ApiError.notFound('Printer not found');

    if (isDefault) {
      await prisma.printerProfile.updateMany({
        where: { businessId, isDefault: true, id: { not: id } },
        data: { isDefault: false }
      });
    }

    const printer = await prisma.printerProfile.update({
      where: { id },
      data: { name, paperWidth, connectionType, vendor, model, isDefault, enabled }
    });

    return ApiResponse.success(res, printer, 'Printer updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deletePrinter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { id } = req.params;

    const existing = await prisma.printerProfile.findFirst({ where: { id, businessId } });
    if (!existing) throw ApiError.notFound('Printer not found');

    await prisma.printerProfile.delete({ where: { id } });

    return ApiResponse.success(res, null, 'Printer deleted successfully');
  } catch (error) {
    next(error);
  }
};
