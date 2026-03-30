import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { singleValue } from '../utils/request';
import { createNotification } from '../utils/notifications';
import { getRequiredVerificationType, serializeVerificationStatus } from '../utils/verification';

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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
