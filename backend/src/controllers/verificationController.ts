import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { verificationService } from '../services/verificationService';
import logger from '../config/logger';
import { singleValue } from '../utils/request';
import { getRequiredVerificationType, serializeVerificationStatus } from '../utils/verification';
import { getErrorMessage } from '../utils/errors';
import { createNotification } from '../utils/notifications';
import { recordAdminAction } from '../utils/adminAudit';
import { sendVerificationDecisionEmail } from '../services/emailService';
import { confirmContactCode, sendContactCode } from '../services/contactVerificationService';
import { normalizePhone } from '../validation/interestSchemas';
import {
  describeVerificationDecision,
  normalizeRegistrationNumber,
  verificationDecisionProblem,
} from '../utils/verification';

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
    const body = req.body as {
      details?: string;
      documentUrl?: string;
      registrationNumber?: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
    };
    const { documentUrl } = body;

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

    const isBusiness = requiredType === 'BUSINESS';
    const registrationNumber = isBusiness && body.registrationNumber ? normalizeRegistrationNumber(body.registrationNumber) : null;

    if (isBusiness && !registrationNumber) {
      return res.status(400).json({ success: false, message: 'Enter your Registrar-General registration number' });
    }

    // One company, one account: the same registration number cannot be claimed by someone else.
    if (registrationNumber) {
      const claimed = await prisma.verificationRequest.findFirst({
        where: {
          type: 'BUSINESS',
          registrationNumber,
          userId: { not: userId },
          status: { in: ['PENDING', 'APPROVED'] },
        },
        select: { id: true },
      });
      if (claimed) {
        return res.status(409).json({
          success: false,
          message: 'This registration number is already being used by another account. Contact support if it is your company.',
        });
      }
    }

    // A contact already confirmed on an earlier request does not need confirming again.
    let contactVerifiedAt: Date | null = null;
    if (isBusiness && body.contactEmail) {
      const earlier = await prisma.verificationRequest.findFirst({
        where: { userId, type: 'BUSINESS', contactEmail: body.contactEmail, contactVerifiedAt: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { contactVerifiedAt: true },
      });
      contactVerifiedAt = earlier?.contactVerifiedAt ?? null;
    }

    const details =
      body.details?.trim() ||
      (isBusiness ? `Registration number ${registrationNumber}. Address: ${body.address?.trim()}.` : '');

    const verification = await prisma.verificationRequest.create({
      data: {
        userId,
        type: requiredType,
        details,
        documentUrl: documentUrl?.trim() || null,
        ...(isBusiness
          ? {
              registrationNumber,
              contactEmail: body.contactEmail,
              contactPhone: body.contactPhone ? normalizePhone(body.contactPhone) : null,
              address: body.address?.trim() || null,
              contactVerifiedAt,
            }
          : {}),
      },
    });

    // Email the confirmation code straight away, so the employer can finish in one sitting.
    let codeSent = false;
    if (isBusiness && !contactVerifiedAt) {
      const sent = await sendContactCode(verification.id, userId).catch(() => null);
      codeSent = Boolean(sent?.ok);
    }

    return res.status(201).json({
      success: true,
      verification,
      requiredType,
      contact: { confirmed: Boolean(contactVerifiedAt), codeSent },
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

    const trails = await prisma.adminActionLog.findMany({
      where: { targetType: 'VerificationRequest', targetId: { in: verifications.map((verification) => verification.id) } },
      orderBy: { createdAt: 'desc' },
      select: { targetId: true, action: true, adminEmail: true, reason: true, createdAt: true },
    });
    const trailByRequest = new Map<string, typeof trails>();
    for (const entry of trails) {
      trailByRequest.set(entry.targetId, [...(trailByRequest.get(entry.targetId) || []), entry]);
    }

    return res.json({
      success: true,
      verifications: verificationsWithHistory.map((verification) => ({
        ...verification,
        auditTrail: trailByRequest.get(verification.id) || [],
      })),
    });
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

    const problem = verificationDecisionProblem(verification, status, reviewNote);
    if (problem) {
      return res.status(400).json({ success: false, message: problem });
    }

    const admin = await prisma.user.findUnique({ where: { id: reviewerId }, select: { id: true, email: true } });
    const decision = describeVerificationDecision(status, verification.type, reviewNote);

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

      await recordAdminAction(tx, {
        admin: { id: reviewerId, email: admin?.email ?? 'unknown' },
        action: `VERIFICATION_${status}`,
        targetType: 'VerificationRequest',
        targetId: verificationId,
        reason: reviewNote,
        metadata: { userId: verification.userId, type: verification.type, internalNoteAdded: Boolean(internalNote?.trim()) },
      });

      await createNotification(tx, {
        userId: verification.userId,
        type:
          status === 'APPROVED'
            ? 'VERIFICATION_APPROVED'
            : status === 'NEEDS_INFO'
              ? 'VERIFICATION_NEEDS_INFO'
              : 'VERIFICATION_REJECTED',
        title: decision.title,
        message: decision.message,
        actionUrl: '/dashboard',
      });

      return nextVerification;
    });

    // The email goes out after the decision is saved and never holds it up.
    void sendVerificationDecisionEmail(verification.user.email, decision).catch((error) =>
      logger.error('verification_decision_email_failed', { verificationId, error: getErrorMessage(error) }),
    );

    return res.json({ success: true, verification: updatedVerification });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Employer asks for a new one-time code to be emailed to the company contact. */
export const requestContactCode = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id);
    const result = await sendContactCode(id || '', req.user!.id);

    if (result.ok) return res.json({ success: true, message: 'We have emailed you a 6-digit code.' });

    switch (result.reason) {
      case 'NOT_FOUND':
        return res.status(404).json({ success: false, message: 'Verification request not found' });
      case 'NOT_OPEN':
        return res.status(409).json({ success: false, message: 'This request is no longer open' });
      case 'ALREADY_CONFIRMED':
        return res.json({ success: true, alreadyConfirmed: true, message: 'This contact is already confirmed.' });
      case 'NO_EMAIL':
        return res.status(400).json({ success: false, message: 'Add a company email address to your request first.' });
      case 'COOLDOWN':
        return res.status(429).json({
          success: false,
          retryAfterSeconds: result.retryAfterSeconds,
          message: `Please wait ${result.retryAfterSeconds} seconds before asking for another code.`,
        });
      case 'TOO_MANY':
        return res.status(429).json({ success: false, message: 'Too many codes requested. Try again in an hour.' });
      default:
        return res.status(502).json({ success: false, message: 'We could not send the email just now. Please try again.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Employer types the code they received. */
export const submitContactCode = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id);
    const { code } = req.body as { code: string };
    const result = await confirmContactCode(id || '', req.user!.id, code);

    if (result.ok) return res.json({ success: true, message: 'Your company email is confirmed.' });

    switch (result.reason) {
      case 'NOT_FOUND':
        return res.status(404).json({ success: false, message: 'Verification request not found' });
      case 'NOT_OPEN':
        return res.status(409).json({ success: false, message: 'This request is no longer open' });
      case 'ALREADY_CONFIRMED':
        return res.json({ success: true, alreadyConfirmed: true, message: 'This contact is already confirmed.' });
      case 'NO_CODE':
        return res.status(400).json({ success: false, message: 'Ask for a code first.' });
      case 'EXPIRED':
        return res.status(400).json({ success: false, message: 'That code has expired. Ask for a new one.' });
      case 'LOCKED':
        return res.status(429).json({ success: false, message: 'Too many wrong tries. Ask for a new code.' });
      default:
        return res.status(400).json({
          success: false,
          attemptsLeft: result.attemptsLeft,
          message: `That code is not right. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'try' : 'tries'} left.`,
        });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
