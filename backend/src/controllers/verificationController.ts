import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { verificationService } from '../services/verificationService';
import logger from '../config/logger';
import { singleValue } from '../utils/request';
import { getRequiredVerificationType, serializeVerificationStatus } from '../utils/verification';
import { getErrorMessage } from '../utils/errors';
import { createNotification } from '../utils/notifications';

const verificationUserSelect = {
  id: true,
  email: true,
  role: true,
  employerProfile: true,
  jobSeekerProfile: true,
  freelancerProfile: true,
} as const;

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
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
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
    } catch (apiError) {
      logger.error('smile_id_api_failure', { userId, error: getErrorMessage(apiError) });
      
      await prisma.verificationRequest.update({
        where: { id: verificationRequest.id },
        data: { 
          status: 'REJECTED', 
          reviewNote: `API Error: ${getErrorMessage(apiError)}` 
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
            status: 'APPROVED' as any, 
            reviewedAt: new Date(),
            reviewNote: 'Automatically verified via Ghana Card (Smile ID).' 
          } as any,
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

  } catch (error) {
    logger.error('initiate_identity_verification_fatal_error', { error: getErrorMessage(error) });
    res.status(500).json({ success: false, message: 'Internal server error during verification.' });
  }
};

export const createVerificationRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const requiredType = getRequiredVerificationType(role);
    const { details, documentUrl } = req.body as {
      details: string;
      documentUrl?: string;
    };

    if (!requiredType) {
      return res.status(400).json({ success: false, message: 'Verification is not supported for this role' });
    }

    const latestRequest = await prisma.verificationRequest.findFirst({
      where: { userId, type: requiredType },
      orderBy: { createdAt: 'desc' },
    });

    if (latestRequest?.status === 'APPROVED') {
      return res.status(409).json({ success: false, message: 'Your account is already verified' });
    }

    if (latestRequest?.status === 'PENDING') {
      return res.status(409).json({ success: false, message: 'You already have a pending verification request' });
    }

    const verification = await prisma.verificationRequest.create({
      data: {
        userId,
        type: requiredType,
        details: details.trim(),
        documentUrl: documentUrl?.trim() || null,
      },
    });

    return res.status(201).json({
      success: true,
      verification,
      requiredType,
      ...serializeVerificationStatus(verification, [verification]),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getVerificationRequests = async (req: AuthRequest, res: Response) => {
  try {
    const verifications = await prisma.verificationRequest.findMany({
      include: {
        user: {
          select: verificationUserSelect,
        },
        reviewer: {
          select: verificationUserSelect,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const historyByKey = new Map<string, typeof verifications>();

    for (const verification of verifications) {
      const key = `${verification.userId}:${verification.type}`;
      const current = historyByKey.get(key) || [];
      current.push(verification);
      historyByKey.set(key, current);
    }

    const verificationsWithHistory = verifications.map((verification) => {
      const key = `${verification.userId}:${verification.type}`;
      const group = historyByKey.get(key) || [];
      const history = group
        .filter((entry) => new Date(entry.createdAt).getTime() < new Date(verification.createdAt).getTime())
        .slice(0, 4)
        .map((entry) => ({
          id: entry.id,
          type: entry.type,
          status: entry.status,
          details: entry.details,
          documentUrl: entry.documentUrl,
          reviewNote: entry.reviewNote,
          internalNote: entry.internalNote,
          reviewedAt: entry.reviewedAt,
          createdAt: entry.createdAt,
          reviewer: entry.reviewer
            ? {
                id: entry.reviewer.id,
                email: entry.reviewer.email,
              }
            : null,
        }));

      return {
        ...verification,
        submissionCount: group.length,
        history,
      };
    });

    return res.json({ success: true, verifications: verificationsWithHistory });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const updateVerificationRequestStatus = async (req: AuthRequest, res: Response) => {
  try {
    const verificationId = singleValue(req.params.id);
    const reviewerId = req.user!.id;
    const { status, reviewNote, internalNote } = req.body as {
      status: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO';
      reviewNote?: string;
      internalNote?: string;
    };

    if (!verificationId) {
      return res.status(400).json({ success: false, message: 'Verification id is required' });
    }

    const verification = await prisma.verificationRequest.findUnique({
      where: { id: verificationId },
      include: {
        user: {
          select: verificationUserSelect,
        },
      },
    });

    if (!verification) {
      return res.status(404).json({ success: false, message: 'Verification request not found' });
    }

    if (verification.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Only pending verification requests can be reviewed' });
    }

    const updatedVerification = await prisma.$transaction(async (tx) => {
      const nextVerification = await tx.verificationRequest.update({
        where: { id: verificationId },
        data: {
          status,
          reviewNote: reviewNote?.trim() || null,
          internalNote: internalNote?.trim() || null,
          reviewedAt: new Date(),
          reviewerId,
        },
        include: {
          user: {
            select: verificationUserSelect,
          },
          reviewer: {
            select: verificationUserSelect,
          },
        },
      });

      if (status === 'APPROVED' && verification.type === 'IDENTITY') {
        await tx.user.update({ where: { id: verification.userId }, data: { identityVerified: true } });
      }

      await createNotification(tx, {
        userId: verification.userId,
        type:
          status === 'APPROVED'
            ? 'VERIFICATION_APPROVED'
            : status === 'NEEDS_INFO'
              ? 'VERIFICATION_NEEDS_INFO'
              : 'VERIFICATION_REJECTED',
        title:
          status === 'APPROVED'
            ? 'Verification approved'
            : status === 'NEEDS_INFO'
              ? 'More verification info needed'
              : 'Verification update',
        message:
          status === 'APPROVED'
            ? `Your ${verification.type.toLowerCase()} verification was approved.`
            : status === 'NEEDS_INFO'
              ? `Your ${verification.type.toLowerCase()} verification needs more detail before it can be approved.`
              : `Your ${verification.type.toLowerCase()} verification needs attention.`,
        actionUrl: '/dashboard',
      });

      return nextVerification;
    });

    return res.json({ success: true, verification: updatedVerification });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
