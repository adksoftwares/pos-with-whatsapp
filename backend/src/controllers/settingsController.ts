import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../core/ApiResponse';
import { ApiError } from '../core/ApiError';

const prisma = new PrismaClient();

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;

    let settings = await prisma.businessSettings.findUnique({
      where: { businessId },
      include: { business: true }
    });

    if (!settings) {
      settings = await prisma.businessSettings.create({
        data: { businessId },
        include: { business: true }
      });
    }

    return ApiResponse.success(res, settings, 'Settings retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { receiptPaperWidth, receiptShowLogo, receiptShowPhone, receiptShowEmail, receiptShowAddress, receiptShowCustomer, receiptShowSku, receiptFooterMessage, receiptThankYouMessage, posAutoPrint, posConfirmClearCart, whatsappEnabled, whatsappMessageTemplate, businessProfile } = req.body;

    // Check roles - only OWNER or ADMIN can change settings
    if (!['OWNER', 'ADMIN'].includes(req.businessMembership.role)) {
      throw ApiError.forbidden('Only owners and admins can update business settings.');
    }

    const updateData: any = {};
    if (receiptPaperWidth !== undefined) updateData.receiptPaperWidth = receiptPaperWidth;
    if (receiptShowLogo !== undefined) updateData.receiptShowLogo = receiptShowLogo;
    if (receiptShowPhone !== undefined) updateData.receiptShowPhone = receiptShowPhone;
    if (receiptShowEmail !== undefined) updateData.receiptShowEmail = receiptShowEmail;
    if (receiptShowAddress !== undefined) updateData.receiptShowAddress = receiptShowAddress;
    if (receiptShowCustomer !== undefined) updateData.receiptShowCustomer = receiptShowCustomer;
    if (receiptShowSku !== undefined) updateData.receiptShowSku = receiptShowSku;
    if (receiptFooterMessage !== undefined) updateData.receiptFooterMessage = receiptFooterMessage;
    if (receiptThankYouMessage !== undefined) updateData.receiptThankYouMessage = receiptThankYouMessage;
    if (posAutoPrint !== undefined) updateData.posAutoPrint = posAutoPrint;
    if (posConfirmClearCart !== undefined) updateData.posConfirmClearCart = posConfirmClearCart;
    if (whatsappEnabled !== undefined) updateData.whatsappEnabled = whatsappEnabled;
    if (whatsappMessageTemplate !== undefined) updateData.whatsappMessageTemplate = whatsappMessageTemplate;

    const settings = await prisma.businessSettings.upsert({
      where: { businessId },
      create: { businessId, ...updateData },
      update: updateData,
    });
    
    if (businessProfile) {
       await prisma.business.update({
         where: { id: businessId },
         data: {
           name: businessProfile.name,
           businessType: businessProfile.businessType,
           phone: businessProfile.phone,
           email: businessProfile.email,
           address: businessProfile.address,
           city: businessProfile.city,
           country: businessProfile.country,
           currency: businessProfile.currency,
           timezone: businessProfile.timezone
         }
       });
    }

    await prisma.auditLog.create({
      data: {
        businessId,
        userId: req.user!.id,
        action: 'UPDATE_SETTINGS',
        entityType: 'BUSINESS',
        entityId: businessId,
        details: { settingsUpdate: true }
      }
    });

    const updatedSettings = await prisma.businessSettings.findUnique({
      where: { businessId },
      include: { business: true }
    });

    return ApiResponse.success(res, updatedSettings, 'Settings updated successfully');
  } catch (error) {
    next(error);
  }
};
export const getBusinessUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;

    if (!['OWNER', 'ADMIN', 'MANAGER'].includes(req.businessMembership.role)) {
      throw ApiError.forbidden('Insufficient permissions to view users.');
    }

    const memberships = await prisma.businessMembership.findMany({
      where: { businessId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true
          }
        }
      }
    });

    return ApiResponse.success(res, memberships, 'Users retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessMembership.businessId;
    const { userId, role, status } = req.body;

    if (!['OWNER', 'ADMIN'].includes(req.businessMembership.role)) {
      throw ApiError.forbidden('Only owners and admins can modify user roles.');
    }

    const targetMembership = await prisma.businessMembership.findUnique({
      where: { userId_businessId: { userId, businessId } },
      include: { user: true }
    });

    if (!targetMembership) {
      throw ApiError.notFound('User not found in this business.');
    }

    // Protect OWNER
    if (targetMembership.role === 'OWNER' && role !== 'OWNER' && req.user!.id !== userId) {
       throw ApiError.forbidden('Cannot change the role of the business owner.');
    }

    // Prevent removing the last owner
    if (targetMembership.role === 'OWNER' && status === 'INACTIVE') {
      const ownerCount = await prisma.businessMembership.count({
        where: { businessId, role: 'OWNER', user: { status: 'ACTIVE' } }
      });
      if (ownerCount <= 1) {
        throw ApiError.badRequest('Cannot deactivate the only active owner.');
      }
    }

    // Update role
    if (role) {
      await prisma.businessMembership.update({
        where: { userId_businessId: { userId, businessId } },
        data: { role }
      });
    }

    // Update user status
    if (status && ['ACTIVE', 'INACTIVE'].includes(status)) {
      await prisma.user.update({
        where: { id: userId },
        data: { status }
      });
    }

    await prisma.auditLog.create({
      data: {
        businessId,
        userId: req.user!.id,
        action: 'UPDATE_USER_ROLE',
        entityType: 'USER',
        entityId: userId,
        details: { role, status }
      }
    });

    return ApiResponse.success(res, null, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};
