import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { verificationService } from '../services/verificationService';
import logger from '../config/logger';
import { singleValue } from '../utils/request';
import { getRequiredVerificationType, serializeVerificationStatus } from '../utils/verification';

export const getMyVerification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const requiredType = getRequiredVerificationType(role);

    if (!requiredType) {
      return res.status(400).json({ success: false, message: 'Verification is not supported for this role' });
    }

    const history = await prisma.verificationRequest.findMany({
      where: { userId, type: requiredType },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const latestRequest = history[0] || null;

    return res.json({
      success: true,
      requiredType,
      ...serializeVerificationStatus(latestRequest, history),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Initiates an automated identity verification using Smile ID (Ghana Card).
 */
export const initiateIdentityVerification = async (req: AuthRequest, res: Response) => {
  try {
    const { idNumber, firstName, lastName, dob } = req.body;
    const userId = req.user!.id;

    if (!idNumber || !firstName || !lastName || !dob) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: idNumber, firstName, lastName, dob are all required.' 
      });
    }

    // 1. Create a pending verification request in our DB
    const verificationRequest = await prisma.verificationRequest.create({
      data: {
        userId,
        type: 'IDENTITY',
        status: 'PENDING',
        details: JSON.stringify({
          idType: 'GHANA_CARD',
          idNumber,
          firstName,
          lastName,
          dob,
        }),
      },
    });

    // 2. Call Smile ID Service
    let result;
    try {
      result = await verificationService.verifyGhanaCard({
        userId,
        idNumber,
        firstName,
        lastName,
        dob,
      });
    } catch (apiError: any) {
      logger.error('smile_id_api_failure', { userId, error: apiError.message });
      
      await prisma.verificationRequest.update({
        where: { id: verificationRequest.id },
        data: { 
          status: 'REJECTED', 
          reviewNote: `API Error: ${apiError.message}` 
        },
      });

      return res.status(500).json({ 
        success: false, 
        message: 'Identity verification service (Smile ID) is currently unavailable. Please try again later.' 
      });
    }

    // 3. Handle Result
    if (result.success) {
      await prisma.$transaction([
        prisma.verificationRequest.update({
          where: { id: verificationRequest.id },
          data: { 
            status: 'APPROVED', 
            reviewedAt: new Date(),
            reviewNote: 'Automatically verified via Ghana Card (Smile ID).' 
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: { identityVerified: true },
        }),
      ]);

      return res.json({ 
        success: true, 
        message: 'Identity verified successfully!',
        verificationId: verificationRequest.id
      });
    } else {
      await prisma.verificationRequest.update({
        where: { id: verificationRequest.id },
        data: { 
          status: 'REJECTED', 
          reviewNote: result.status || 'Verification failed: Data mismatch or invalid ID.' 
        },
      });

      return res.status(400).json({ 
        success: false, 
        message: result.status || 'Verification failed. Please check your details and try again.' 
      });
    }

  } catch (error: any) {
    logger.error('initiate_identity_verification_fatal_error', { error: error.message });
    res.status(500).json({ success: false, message: 'Internal server error during verification.' });
  }
};

export const createVerificationRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { details, documentUrl } = req.body as { details: string; documentUrl?: string };
    const userId = req.user!.id;
    const role = req.user!.role;
    const requiredType = getRequiredVerificationType(role);

    if (!requiredType) {
      return res.status(400).json({ success: false, message: 'Verification is not supported for this role' });
    }

    const verificationRequest = await prisma.verificationRequest.create({
      data: {
        userId,
        type: requiredType,
        status: 'PENDING',
        details,
        documentUrl: documentUrl || null,
      },
    });

    return res.status(201).json({ success: true, message: 'Verification request submitted for review', verificationRequest });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getVerificationRequests = async (req: AuthRequest, res: Response) => {
  try {
    const verifications = await prisma.verificationRequest.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, verifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateVerificationRequestStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, reviewNote } = req.body as {
      status: 'APPROVED' | 'REJECTED' | 'PENDING';
      reviewNote?: string;
    };
    const verificationId = singleValue(req.params.id);

    if (!verificationId) {
      return res.status(400).json({ success: false, message: 'Verification id is required' });
    }

    const verification = await prisma.verificationRequest.findUnique({
      where: { id: verificationId },
      include: { user: true },
    });

    if (!verification) {
      return res.status(404).json({ success: false, message: 'Verification request not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextRequest = await tx.verificationRequest.update({
        where: { id: verificationId },
        data: {
          status,
          reviewNote: reviewNote || null,
          reviewedAt: status === 'PENDING' ? null : new Date(),
        },
      });

      // Update user verification status if approved
      if (status === 'APPROVED') {
        const updateData: any = {};
        if (verification.type === 'IDENTITY') {
          updateData.identityVerified = true;
        }
        
        if (Object.keys(updateData).length > 0) {
          await tx.user.update({
            where: { id: verification.userId },
            data: updateData,
          });
        }
      }

      return nextRequest;
    });

    return res.json({ success: true, message: `Verification status updated to ${status}`, verification: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
