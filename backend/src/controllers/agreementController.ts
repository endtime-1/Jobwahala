import { randomUUID } from 'crypto';
import { Response } from 'express';
import env from '../config/env';
import logger from '../config/logger';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { singleValue } from '../utils/request';
import { createAgreementEvent } from '../utils/agreementEvents';
import { createNotification, createNotifications } from '../utils/notifications';
import { initializePaymentSession, verifyProviderPayment } from '../services/paymentProvider';
import {
  generateAgreementDecisionBrief,
  generateAgreementComparisonSummary,
  type AgreementComparisonOptionContext,
} from '../services/ai';
import { emitAgreementRefresh } from '../utils/workflowRealtime';

import { paystackService } from '../services/paystackService';
const agreementUserSelect = {
  id: true,
  email: true,
  role: true,
  employerProfile: true,
  jobSeekerProfile: true,
  freelancerProfile: true,
} as const;

const isAgreementParticipant = (
  agreement: {
    employerId?: string | null;
    seekerId?: string | null;
    freelancerId?: string | null;
    clientId?: string | null;
  },
  userId: string
) => {
  return [agreement.employerId, agreement.seekerId, agreement.freelancerId, agreement.clientId].includes(userId);
};

const milestoneStatusLabel = (status: string) => status.toLowerCase().replace(/_/g, ' ');
const getAgreementPaymentActors = (agreement: {
  type: string;
  employerId?: string | null;
  seekerId?: string | null;
  freelancerId?: string | null;
  clientId?: string | null;
}) => {
  if (agreement.type === 'JOB') {
    return {
      payerId: agreement.employerId || null,
      payeeId: agreement.seekerId || null,
    };
  }

  if (agreement.type === 'SERVICE') {
    return {
      payerId: agreement.clientId || null,
      payeeId: agreement.freelancerId || null,
    };
  }

  return {
    payerId: null,
    payeeId: null,
  };
};

const getAgreementParticipantIds = (agreement: {
  employerId?: string | null;
  seekerId?: string | null;
  freelancerId?: string | null;
  clientId?: string | null;
}) =>
  [...new Set([agreement.employerId, agreement.seekerId, agreement.freelancerId, agreement.clientId].filter(Boolean))] as string[];

const getAgreementCounterpartyId = (
  agreement: {
    employerId?: string | null;
    seekerId?: string | null;
    freelancerId?: string | null;
    clientId?: string | null;
  },
  userId: string
) =>
  [agreement.employerId, agreement.seekerId, agreement.freelancerId, agreement.clientId]
    .filter((participantId): participantId is string => Boolean(participantId))
    .find((participantId) => participantId !== userId) || null;

const getAgreementUserName = (user?: {
  email?: string | null;
  employerProfile?: { companyName?: string | null } | null;
  jobSeekerProfile?: { firstName?: string | null; lastName?: string | null } | null;
  freelancerProfile?: { firstName?: string | null; lastName?: string | null } | null;
} | null) => {
  if (!user) {
    return 'Unknown';
  }

  const fullName = [
    user.jobSeekerProfile?.firstName || user.freelancerProfile?.firstName || '',
    user.jobSeekerProfile?.lastName || user.freelancerProfile?.lastName || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return user.employerProfile?.companyName || fullName || user.email || 'Unknown';
};

/**
 * Background process to release funds from escrow to the freelancer.
 */
export const processPayout = async (milestoneId: string) => {
  try {
    const milestone = await prisma.agreementMilestone.findFirst({
      where: { id: milestoneId },
      include: {
        agreement: {
          include: {
            freelancer: true,
            seeker: true,
          }
        },
        payments: {
          where: { status: 'SUCCEEDED' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!milestone || milestone.status !== 'COMPLETED' || milestone.paymentStatus !== 'PAID') {
      return;
    }

    const payment = milestone.payments[0];
    if (!payment || (payment as any).payoutStatus !== 'PENDING') {
      return;
    }

    // --- Industry Practice: Maturity Check ---
    const holdMs = env.payoutHoldDurationHours * 60 * 60 * 1000;
    const isMature = payment.completedAt && (new Date().getTime() - new Date(payment.completedAt).getTime()) >= holdMs;
    
    if (!isMature && env.isProduction) {
      logger.info('payout_pending_maturity', { milestoneId, completedAt: payment.completedAt });
      return;
    }

    const freelancerId = milestone.agreement.freelancerId || milestone.agreement.seekerId;
    if (!freelancerId) return;

    const payoutAccount = await (prisma as any).payoutAccount.findUnique({
      where: { userId: freelancerId }
    });

    if (!payoutAccount) {
      logger.warn('payout_skipped_no_account', { milestoneId, freelancerId });
      return;
    }

    const totalAmountMinor = payment.providerAmount || 0;
    const feePercentage = env.platformFeePercentage;
    const feeAmountMinor = Math.round(totalAmountMinor * (feePercentage / 100));
    const payoutAmountMinor = totalAmountMinor - feeAmountMinor;
    const currency = (payment as any).currency || 'GHS';

    // 1. Mark as PROCESSING in DB before calling Paystack (Atomic check-and-set)
    const updateResult = await prisma.payment.updateMany({
      where: { 
        id: payment.id,
        payoutStatus: 'PENDING'
      },
      data: { 
        payoutStatus: 'PROCESSING',
        platformFee: (feeAmountMinor / 100).toString(),
        payoutAmount: (payoutAmountMinor / 100).toString(),
      } as any
    });

    if (updateResult.count === 0) {
      logger.warn('payout_skipped_already_processing', { paymentId: payment.id });
      return;
    }

    // 2. Initiate Paystack Transfer
    const transferResponse = await paystackService.initiateTransfer({
      source: 'balance',
      amount: payoutAmountMinor,
      currency: currency,
      recipient: payoutAccount.recipientCode,
      reason: `Payout for milestone: ${milestone.title}`,
      reference: `out_${payment.id}_${Date.now()}`
    });

    if (transferResponse.status) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { 
          transferId: transferResponse.data.transfer_code,
          payoutStatus: 'SUCCESS'
        } as any
      });
      logger.info('payout_initiated_successfully', { milestoneId, transferId: transferResponse.data.transfer_code });
    } else {
      throw new Error(transferResponse.message || 'Paystack transfer failed');
    }

  } catch (error: any) {
    logger.error('process_payout_failed', { milestoneId, error: error.message });
    await prisma.payment.updateMany({
      where: { milestoneId, payoutStatus: 'PROCESSING' } as any,
      data: { payoutStatus: 'FAILED' } as any
    });
  }
};

const activeAgreementDisputeStatuses = ['OPEN', 'UNDER_REVIEW'] as const;

const hasActiveAgreementDispute = (
  disputes?: Array<{
    status: string;
  }>
) => Boolean(disputes?.some((dispute) => activeAgreementDisputeStatuses.includes(dispute.status as typeof activeAgreementDisputeStatuses[number])));

const getLatestMilestonePayment = (milestone: {
  payments?: Array<{
    id: string;
    status: string;
    reference: string;
    provider: string;
    amount: string;
    checkoutUrl?: string | null;
    failureReason?: string | null;
    completedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    payerId: string;
    payeeId: string;
  }>;
}) => milestone.payments?.[0] || null;

const generatePaymentReference = () =>
  `JW-PAY-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

export type TransactionClientLike = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const createPaymentRecord = async (
  tx: TransactionClientLike,
  {
    agreementId,
    milestoneId,
    payerId,
    payeeId,
    amount,
    provider = 'SANDBOX',
    status = 'PENDING',
    checkoutUrl = null,
    currency = null,
    providerAmount = null,
  }: {
    agreementId: string;
    milestoneId: string;
    payerId: string;
    payeeId: string;
    amount: string;
    provider?: string;
    status?: string;
    checkoutUrl?: string | null;
    currency?: string | null;
    providerAmount?: number | null;
  }
) => {
  return tx.payment.create({
    data: {
      agreementId,
      milestoneId,
      payerId,
      payeeId,
      amount,
      provider,
      status,
      reference: generatePaymentReference(),
      checkoutUrl,
      currency,
      providerAmount,
    } as any,
  });
};

export const getMyAgreements = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const agreements = await prisma.agreement.findMany({
      where: {
        OR: [
          { employerId: userId },
          { seekerId: userId },
          { freelancerId: userId },
          { clientId: userId },
        ],
      },
      include: {
        employer: {
          select: agreementUserSelect,
        },
        seeker: {
          select: agreementUserSelect,
        },
        freelancer: {
          select: agreementUserSelect,
        },
        client: {
          select: agreementUserSelect,
        },
        application: {
          select: {
            id: true,
            status: true,
            job: {
              select: { id: true, title: true, salary: true },
            },
          },
        },
        serviceRequest: {
          select: {
            id: true,
            status: true,
            service: {
              select: { id: true, title: true, price: true, category: true },
            },
          },
        },
        milestones: {
          include: {
            payments: {
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        events: {
          include: {
            actor: {
              select: agreementUserSelect,
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          include: {
            reviewer: {
              select: agreementUserSelect,
            },
            reviewee: {
              select: agreementUserSelect,
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        disputes: {
          include: {
            creator: {
              select: agreementUserSelect,
            },
            counterparty: {
              select: agreementUserSelect,
            },
            resolver: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({ success: true, agreements });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const compareAgreements = async (req: AuthRequest, res: Response) => {
  try {
    const agreementIds = Array.isArray(req.body?.agreementIds) ? (req.body.agreementIds as string[]) : [];
    const userId = req.user!.id;

    if (agreementIds.length < 2) {
      return res.status(400).json({ success: false, message: 'Select at least two agreements to compare' });
    }

    const agreements = await prisma.agreement.findMany({
      where: {
        id: { in: agreementIds },
        OR: [
          { employerId: userId },
          { seekerId: userId },
          { freelancerId: userId },
          { clientId: userId },
        ],
      },
      select: {
        id: true,
        type: true,
        title: true,
        summary: true,
        amount: true,
        status: true,
        updatedAt: true,
        employerId: true,
        seekerId: true,
        freelancerId: true,
        clientId: true,
        employer: { select: agreementUserSelect },
        seeker: { select: agreementUserSelect },
        freelancer: { select: agreementUserSelect },
        client: { select: agreementUserSelect },
        application: {
          select: {
            id: true,
            status: true,
            job: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        serviceRequest: {
          select: {
            id: true,
            status: true,
            service: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        milestones: {
          select: {
            id: true,
            status: true,
            amount: true,
            paymentStatus: true,
          },
        },
        disputes: {
          select: {
            status: true,
          },
        },
      },
    });

    if (agreements.length !== agreementIds.length) {
      return res.status(404).json({ success: false, message: 'One or more agreements were not found' });
    }

    const agreementMap = new Map(agreements.map((agreement) => [agreement.id, agreement]));
    const orderedAgreements = agreementIds
      .map((agreementId) => agreementMap.get(agreementId))
      .filter(Boolean);

    const comparisonOptions: AgreementComparisonOptionContext[] = orderedAgreements.map((agreement) => {
      const counterparty =
        agreement!.employerId === userId
          ? agreement!.seeker
          : agreement!.seekerId === userId
            ? agreement!.employer
            : agreement!.freelancerId === userId
              ? agreement!.client
              : agreement!.freelancer;
      const completedMilestones = agreement!.milestones.filter(
        (milestone) => milestone.status === 'COMPLETED',
      ).length;
      const outstandingPayments = agreement!.milestones.filter(
        (milestone) => Boolean(milestone.amount) && milestone.paymentStatus !== 'PAID',
      ).length;

      return {
        title: agreement!.title,
        type: agreement!.type as AgreementComparisonOptionContext['type'],
        status: agreement!.status,
        counterpartyName: getAgreementUserName(counterparty),
        amount: agreement!.amount,
        sourceTitle:
          agreement!.application?.job?.title ||
          agreement!.serviceRequest?.service?.title ||
          null,
        sourceStatus:
          agreement!.application?.status ||
          agreement!.serviceRequest?.status ||
          null,
        milestoneCount: agreement!.milestones.length,
        completedMilestones,
        outstandingPayments,
        hasActiveDispute: hasActiveAgreementDispute(agreement!.disputes),
      };
    });

    const summary = await generateAgreementComparisonSummary({
      options: comparisonOptions,
    });

    return res.json({
      success: true,
      comparison: {
        summary,
        comparedCount: orderedAgreements.length,
        agreements: orderedAgreements.map((agreement) => {
          const counterparty =
            agreement!.employerId === userId
              ? agreement!.seeker
              : agreement!.seekerId === userId
                ? agreement!.employer
                : agreement!.freelancerId === userId
                  ? agreement!.client
                  : agreement!.freelancer;
          const completedMilestones = agreement!.milestones.filter(
            (milestone) => milestone.status === 'COMPLETED',
          ).length;
          const outstandingPayments = agreement!.milestones.filter(
            (milestone) => Boolean(milestone.amount) && milestone.paymentStatus !== 'PAID',
          ).length;

          return {
            id: agreement!.id,
            type: agreement!.type,
            status: agreement!.status,
            title: agreement!.title,
            summary: agreement!.summary,
            amount: agreement!.amount,
            updatedAt: agreement!.updatedAt,
            counterpartyName: getAgreementUserName(counterparty),
            source: agreement!.application
              ? {
                  kind: 'APPLICATION',
                  id: agreement!.application.id,
                  title: agreement!.application.job?.title || 'Job application',
                  status: agreement!.application.status,
                }
              : agreement!.serviceRequest
                ? {
                    kind: 'SERVICE_REQUEST',
                    id: agreement!.serviceRequest.id,
                    title: agreement!.serviceRequest.service?.title || 'Service request',
                    status: agreement!.serviceRequest.status,
                  }
                : null,
            milestoneCount: agreement!.milestones.length,
            completedMilestones,
            outstandingPayments,
            hasActiveDispute: hasActiveAgreementDispute(agreement!.disputes),
          };
        }),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const generateAgreementDecisionSummary = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const userId = req.user!.id;
    const { focus } = req.body as { focus?: string };

    if (!agreementId) {
      return res.status(400).json({ success: false, message: 'Agreement id is required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      select: {
        id: true,
        type: true,
        title: true,
        summary: true,
        amount: true,
        status: true,
        employerId: true,
        seekerId: true,
        freelancerId: true,
        clientId: true,
        employer: { select: agreementUserSelect },
        seeker: { select: agreementUserSelect },
        freelancer: { select: agreementUserSelect },
        client: { select: agreementUserSelect },
        application: {
          select: {
            id: true,
            status: true,
            job: {
              select: {
                title: true,
                salary: true,
              },
            },
          },
        },
        serviceRequest: {
          select: {
            id: true,
            status: true,
            budget: true,
            timeline: true,
            service: {
              select: {
                title: true,
              },
            },
          },
        },
        milestones: {
          select: {
            id: true,
            status: true,
            amount: true,
            paymentStatus: true,
          },
        },
        disputes: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!agreement || !isAgreementParticipant(agreement, userId)) {
      return res.status(404).json({ success: false, message: 'Agreement not found' });
    }

    if (agreement.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Decision briefs are only available for active agreements' });
    }

    const counterparty =
      agreement.employerId === userId
        ? agreement.seeker
        : agreement.seekerId === userId
          ? agreement.employer
          : agreement.freelancerId === userId
            ? agreement.client
            : agreement.freelancer;
    const { payerId, payeeId } = getAgreementPaymentActors(agreement);
    const completedMilestones = agreement.milestones.filter((milestone) => milestone.status === 'COMPLETED').length;
    const incompleteMilestones = agreement.milestones.filter((milestone) => milestone.status !== 'COMPLETED').length;
    const outstandingPayments = agreement.milestones.filter(
      (milestone) => Boolean(milestone.amount) && milestone.paymentStatus !== 'PAID',
    ).length;
    const requestedPayments = agreement.milestones.filter(
      (milestone) => Boolean(milestone.amount) && milestone.paymentStatus === 'REQUESTED',
    ).length;
    const hasActiveDispute = hasActiveAgreementDispute(agreement.disputes);
    const canCompleteNow =
      agreement.milestones.length > 0 &&
      incompleteMilestones === 0 &&
      outstandingPayments === 0 &&
      !hasActiveDispute;

    const brief = await generateAgreementDecisionBrief({
      type: agreement.type as 'JOB' | 'SERVICE',
      title: agreement.title,
      status: agreement.status,
      summary: agreement.summary,
      amount: agreement.amount,
      sourceTitle:
        agreement.application?.job?.title ||
        agreement.serviceRequest?.service?.title ||
        null,
      sourceStatus:
        agreement.application?.status ||
        agreement.serviceRequest?.status ||
        null,
      counterpartyName: getAgreementUserName(counterparty),
      milestoneCount: agreement.milestones.length,
      completedMilestones,
      incompleteMilestones,
      outstandingPayments,
      requestedPayments,
      hasActiveDispute,
      canCompleteNow,
      userRoleLabel:
        userId === payerId
          ? 'Payer'
          : userId === payeeId
            ? 'Worker'
            : 'Participant',
      focus: focus?.trim() || '',
    });

    return res.json({ success: true, brief });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAgreementStatus = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const userId = req.user!.id;
    const { status } = req.body as { status: string };

    if (!agreementId) {
      return res.status(400).json({ success: false, message: 'Agreement id is required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        milestones: {
          select: { id: true, status: true, amount: true, paymentStatus: true },
        },
        disputes: {
          where: {
            status: {
              in: [...activeAgreementDisputeStatuses],
            },
          },
          select: { id: true, status: true },
        },
      },
    });

    if (!agreement || !isAgreementParticipant(agreement, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (agreement.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Only active agreements can be updated' });
    }

    if (hasActiveAgreementDispute(agreement.disputes)) {
      return res.status(400).json({
        success: false,
        message: 'Resolve the active dispute on this agreement before changing its status',
      });
    }

    if (
      status === 'COMPLETED' &&
      agreement.milestones.some(
        (milestone) =>
          milestone.status !== 'COMPLETED' ||
          (Boolean(milestone.amount) && milestone.paymentStatus !== 'PAID')
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'All milestones must be completed and paid before the agreement can be marked completed',
      });
    }

    if (agreement.status === status) {
      return res.json({ success: true, agreement });
    }

    const updatedAgreement = await prisma.$transaction(async (tx) => {
      const nextAgreement = await tx.agreement.update({
        where: { id: agreementId },
        data: { status },
      });

      if (agreement.serviceRequestId && status === 'COMPLETED') {
        await tx.serviceRequest.update({
          where: { id: agreement.serviceRequestId },
          data: { status: 'COMPLETED' },
        });
      }

      if (agreement.serviceRequestId && status === 'CANCELLED') {
        await tx.serviceRequest.update({
          where: { id: agreement.serviceRequestId },
          data: { status: 'CANCELLED' },
        });
      }

      if (agreement.applicationId) {
        await tx.application.update({
          where: { id: agreement.applicationId },
          data: { status },
        });
      }

      await createAgreementEvent(tx, {
        agreementId,
        actorId: userId,
        eventType: 'STATUS_CHANGED',
        message:
          status === 'COMPLETED'
            ? 'Agreement marked as completed.'
            : 'Agreement cancelled by a participant.',
        fromStatus: agreement.status,
        toStatus: status,
      });

      await createNotifications(
        tx,
        getAgreementParticipantIds(agreement)
          .filter((participantId) => participantId !== userId)
          .map((participantId) => ({
            userId: participantId,
            type: 'AGREEMENT_STATUS_CHANGED',
            title: status === 'COMPLETED' ? 'Agreement completed' : 'Agreement cancelled',
            message:
              status === 'COMPLETED'
                ? `The agreement "${agreement.title}" was marked as completed.`
                : `The agreement "${agreement.title}" was cancelled.`,
            actionUrl: '/agreements',
          }))
      );

      return nextAgreement;
    });

    emitAgreementRefresh(getAgreementParticipantIds(agreement), {
      reason: 'status_changed',
      agreementId,
      actorId: userId,
    });

    return res.json({ success: true, agreement: updatedAgreement });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAgreementMilestone = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const userId = req.user!.id;
    const { title, description, amount, dueDate } = req.body as {
      title: string;
      description?: string;
      amount?: string;
      dueDate?: string;
    };

    if (!agreementId) {
      return res.status(400).json({ success: false, message: 'Agreement id is required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement || !isAgreementParticipant(agreement, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (agreement.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Milestones can only be added to active agreements' });
    }

    const milestone = await prisma.$transaction(async (tx) => {
      const createdMilestone = await tx.agreementMilestone.create({
        data: {
          agreementId,
          title: title.trim(),
          description: description?.trim() || null,
          amount: amount?.trim() || null,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });

      await createAgreementEvent(tx, {
        agreementId,
        actorId: userId,
        eventType: 'MILESTONE_CREATED',
        message: `Milestone "${createdMilestone.title}" added to the agreement.`,
        toStatus: createdMilestone.status,
      });

      await createNotifications(
        tx,
        getAgreementParticipantIds(agreement)
          .filter((participantId) => participantId !== userId)
          .map((participantId) => ({
            userId: participantId,
            type: 'MILESTONE_CREATED',
            title: 'New milestone added',
            message: `A new milestone "${createdMilestone.title}" was added to "${agreement.title}".`,
            actionUrl: '/agreements',
          }))
      );

      return createdMilestone;
    });

    emitAgreementRefresh(getAgreementParticipantIds(agreement), {
      reason: 'milestone_created',
      agreementId,
      milestoneId: milestone.id,
      actorId: userId,
    });

    return res.status(201).json({ success: true, milestone });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAgreementReview = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const userId = req.user!.id;
    const { rating, comment } = req.body as {
      rating: number;
      comment?: string;
    };

    if (!agreementId) {
      return res.status(400).json({ success: false, message: 'Agreement id is required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        employer: {
          select: agreementUserSelect,
        },
        seeker: {
          select: agreementUserSelect,
        },
        freelancer: {
          select: agreementUserSelect,
        },
        client: {
          select: agreementUserSelect,
        },
        reviews: {
          select: {
            id: true,
            reviewerId: true,
            revieweeId: true,
          },
        },
        disputes: {
          where: {
            status: {
              in: [...activeAgreementDisputeStatuses],
            },
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!agreement || !isAgreementParticipant(agreement, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (agreement.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Reviews can only be submitted after an agreement is completed' });
    }

    if (hasActiveAgreementDispute(agreement.disputes)) {
      return res.status(400).json({
        success: false,
        message: 'Reviews are disabled while this agreement has an active dispute',
      });
    }

    if (agreement.reviews.some((review) => review.reviewerId === userId)) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this agreement' });
    }

    const revieweeId = getAgreementCounterpartyId(agreement, userId);

    if (!revieweeId) {
      return res.status(400).json({ success: false, message: 'A valid counterparty is required before a review can be submitted' });
    }

    const review = await prisma.$transaction(async (tx) => {
      const createdReview = await tx.review.create({
        data: {
          agreementId,
          reviewerId: userId,
          revieweeId,
          rating,
          comment: comment?.trim() || null,
        },
        include: {
          reviewer: {
            select: agreementUserSelect,
          },
          reviewee: {
            select: agreementUserSelect,
          },
        },
      });

      await createAgreementEvent(tx, {
        agreementId,
        actorId: userId,
        eventType: 'REVIEW_SUBMITTED',
        message: `A ${rating}-star review was submitted for "${agreement.title}".`,
      });

      await createNotification(tx, {
        userId: revieweeId,
        type: 'REVIEW_RECEIVED',
        title: 'New review received',
        message: `You received a ${rating}-star review for "${agreement.title}".`,
        actionUrl: '/agreements',
      });

      return createdReview;
    });

    emitAgreementRefresh(getAgreementParticipantIds(agreement), {
      reason: 'review_created',
      agreementId,
      reviewId: review.id,
      actorId: userId,
    });

    return res.status(201).json({ success: true, review });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAgreementDispute = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const userId = req.user!.id;
    const { type, title, description, evidenceUrl } = req.body as {
      type: string;
      title: string;
      description: string;
      evidenceUrl?: string;
    };

    if (!agreementId) {
      return res.status(400).json({ success: false, message: 'Agreement id is required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        disputes: {
          where: {
            status: {
              in: [...activeAgreementDisputeStatuses],
            },
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!agreement || !isAgreementParticipant(agreement, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (agreement.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Disputes cannot be opened on cancelled agreements' });
    }

    if (hasActiveAgreementDispute(agreement.disputes)) {
      return res.status(409).json({ success: false, message: 'This agreement already has an active dispute' });
    }

    const counterpartyId = getAgreementCounterpartyId(agreement, userId);

    if (!counterpartyId) {
      return res.status(400).json({ success: false, message: 'A valid counterparty is required before opening a dispute' });
    }

    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const dispute = await prisma.$transaction(async (tx) => {
      const createdDispute = await tx.agreementDispute.create({
        data: {
          agreementId,
          creatorId: userId,
          counterpartyId,
          type,
          title: title.trim(),
          description: description.trim(),
          evidenceUrl: evidenceUrl?.trim() || null,
        },
        include: {
          creator: {
            select: agreementUserSelect,
          },
          counterparty: {
            select: agreementUserSelect,
          },
          resolver: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      await createAgreementEvent(tx, {
        agreementId,
        actorId: userId,
        eventType: 'DISPUTE_OPENED',
        message: `Dispute opened: ${createdDispute.title}.`,
        toStatus: createdDispute.status,
      });

      await createNotifications(
        tx,
        [counterpartyId, ...adminUsers.map((admin) => admin.id)].map((participantId) => ({
          userId: participantId,
          type: 'DISPUTE_OPENED',
          title: 'New dispute opened',
          message: `A ${type.toLowerCase()} dispute was opened on "${agreement.title}".`,
          actionUrl: '/agreements',
        })),
      );

      return createdDispute;
    });

    emitAgreementRefresh(getAgreementParticipantIds(agreement), {
      reason: 'dispute_created',
      agreementId,
      disputeId: dispute.id,
      actorId: userId,
    });

    return res.status(201).json({ success: true, dispute });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAgreementMilestoneStatus = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const milestoneId = singleValue(req.params.milestoneId);
    const userId = req.user!.id;
    const { status } = req.body as { status: string };

    if (!agreementId || !milestoneId) {
      return res.status(400).json({ success: false, message: 'Agreement and milestone ids are required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        milestones: {
          where: { id: milestoneId },
        },
      },
    });

    if (!agreement || !isAgreementParticipant(agreement, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (agreement.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Only active agreements can update milestones' });
    }

    const milestone = agreement.milestones[0];

    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found for this agreement' });
    }

    if (milestone.status === 'COMPLETED' && status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Completed milestones cannot be moved back to an earlier status',
      });
    }

    if (milestone.status === status) {
      return res.json({ success: true, milestone });
    }

    const updatedMilestone = await prisma.$transaction(async (tx) => {
      const nextMilestone = await tx.agreementMilestone.update({
        where: { id: milestoneId },
        data: { status },
      });

      // Automated Escrow Payout Logic
      if (status === 'COMPLETED' && milestone.paymentStatus === 'PAID') {
        const payment = await tx.payment.findFirst({
          where: { milestoneId, status: 'SUCCEEDED' },
        });

        if (payment && payment.payoutStatus === 'NONE') {
          const recipient = await tx.payoutAccount.findUnique({
            where: { userId: agreement.freelancerId || agreement.seekerId || '' },
          });

          if (recipient) {
            // Mark for processing. The actual transfer happens after transaction commit for safety.
            await tx.payment.update({
              where: { id: payment.id },
              data: { payoutStatus: 'PENDING' }
            });
          }
        }
      }

      await createAgreementEvent(tx, {
        agreementId,
        actorId: userId,
        eventType: 'MILESTONE_STATUS_CHANGED',
        message: `Milestone "${milestone.title}" marked as ${milestoneStatusLabel(status)}.`,
        fromStatus: milestone.status,
        toStatus: status,
      });

      await createNotifications(
        tx,
        getAgreementParticipantIds(agreement)
          .filter((participantId) => participantId !== userId)
          .map((participantId) => ({
            userId: participantId,
            type: 'MILESTONE_STATUS_CHANGED',
            title: 'Milestone updated',
            message: `Milestone "${milestone.title}" on "${agreement.title}" was marked as ${milestoneStatusLabel(status)}.`,
            actionUrl: '/agreements',
          }))
      );

      return nextMilestone;
    });

    emitAgreementRefresh(getAgreementParticipantIds(agreement), {
      reason: 'milestone_status_changed',
      agreementId,
      milestoneId,
      actorId: userId,
    });

    // Fire-and-forget payout trigger
    if (status === 'COMPLETED' && milestone.paymentStatus === 'PAID') {
       processPayout(milestone.id).catch((err: any) => logger.error('deferred_payout_error', { error: err.message }));
    }

    return res.json({ success: true, milestone: updatedMilestone });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const completeMilestonePayment = async (
  tx: TransactionClientLike,
  {
    agreement,
    milestone,
    payment,
    userId,
    payeeId,
    completedAt,
  }: {
    agreement: {
      id: string;
      title: string;
    };
    milestone: {
      id: string;
      title: string;
      paymentStatus: string;
    };
    payment: {
      id: string;
      status: string;
    };
    userId: string;
    payeeId: string;
    completedAt?: Date;
  }
) => {
  const settledAt = completedAt || new Date();

  const [updatedPayment, updatedMilestone] = await Promise.all([
    tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCEEDED',
        failureReason: null,
        completedAt: settledAt,
      },
    }),
    tx.agreementMilestone.update({
      where: { id: milestone.id },
      data: {
        paymentStatus: 'PAID',
        paidAt: settledAt,
      },
    }),
  ]);

  await createAgreementEvent(tx, {
    agreementId: agreement.id,
    actorId: userId,
    eventType: 'MILESTONE_PAYMENT_MARKED_PAID',
    message: `Milestone "${milestone.title}" marked as paid.`,
    fromStatus: milestone.paymentStatus,
    toStatus: 'PAID',
  });

  await createNotification(tx, {
    userId: payeeId,
    type: 'MILESTONE_PAYMENT_PAID',
    title: 'Milestone marked paid',
    message: `Milestone "${milestone.title}" on "${agreement.title}" was marked as paid.`,
    actionUrl: '/agreements',
  });

  return { payment: updatedPayment, milestone: updatedMilestone };
};

export const updateAgreementMilestonePaymentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const milestoneId = singleValue(req.params.milestoneId);
    const userId = req.user!.id;
    const { status } = req.body as { status: string };

    if (!agreementId || !milestoneId) {
      return res.status(400).json({ success: false, message: 'Agreement and milestone ids are required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        employer: {
          select: { id: true, email: true },
        },
        client: {
          select: { id: true, email: true },
        },
        milestones: {
          where: { id: milestoneId },
          include: {
            payments: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!agreement || !isAgreementParticipant(agreement, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (agreement.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Only active agreements can update milestone payments' });
    }

    const milestone = agreement.milestones[0];

    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found for this agreement' });
    }

    const latestPayment = getLatestMilestonePayment(milestone);

    if (!milestone.amount) {
      return res.status(400).json({ success: false, message: 'Milestone amount is required before payment can be tracked' });
    }

    if (milestone.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Only completed milestones can enter the payment workflow' });
    }

    if (milestone.paymentStatus === status && status === 'REQUESTED') {
      return res.json({ success: true, milestone });
    }

    const { payerId, payeeId } = getAgreementPaymentActors(agreement);

    if (!payerId || !payeeId) {
      return res.status(400).json({ success: false, message: 'This agreement is missing its payment participants' });
    }

    if (status === 'REQUESTED') {
      if (userId !== payeeId) {
        return res.status(403).json({ success: false, message: 'Only the worker on this agreement can request payment' });
      }

      if (milestone.paymentStatus !== 'PENDING') {
        return res.status(400).json({ success: false, message: 'Payment can only be requested once per milestone' });
      }
    }

    if (status === 'PAID') {
      if (userId !== payerId) {
        return res.status(403).json({ success: false, message: 'Only the paying counterparty can mark this milestone as paid' });
      }

      if (milestone.paymentStatus !== 'REQUESTED') {
        return res.status(400).json({ success: false, message: 'Payment must be requested before it can be marked as paid' });
      }
    }

    if (status === 'REQUESTED') {
      const updatedMilestone = await prisma.$transaction(async (tx) => {
        const nextMilestone = await tx.agreementMilestone.update({
          where: { id: milestoneId },
          data: {
            paymentStatus: status,
            paymentRequestedAt: new Date(),
            paidAt: null,
          },
        });

        await createAgreementEvent(tx, {
          agreementId,
          actorId: userId,
          eventType: 'MILESTONE_PAYMENT_REQUESTED',
          message: `Payment requested for milestone "${milestone.title}".`,
          fromStatus: milestone.paymentStatus,
          toStatus: status,
        });

        await createNotification(tx, {
          userId: payerId,
          type: 'MILESTONE_PAYMENT_REQUESTED',
          title: 'Payment requested',
          message: `Payment was requested for milestone "${milestone.title}" on "${agreement.title}".`,
          actionUrl: '/agreements',
        });

        return nextMilestone;
      });

      emitAgreementRefresh(getAgreementParticipantIds(agreement), {
        reason: 'milestone_payment_requested',
        agreementId,
        milestoneId,
        actorId: userId,
      });

      return res.json({ success: true, milestone: updatedMilestone });
    }

    const paymentResult = await prisma.$transaction(async (tx) => {
      const sessionPayment =
        latestPayment && ['PENDING', 'PROCESSING'].includes(latestPayment.status)
          ? latestPayment
          : await createPaymentRecord(tx, {
              agreementId,
              milestoneId,
              payerId,
              payeeId,
              amount: milestone.amount!,
            });

      return completeMilestonePayment(tx, {
        agreement: {
          id: agreementId,
          title: agreement.title,
        },
        milestone: {
          id: milestone.id,
          title: milestone.title,
          paymentStatus: milestone.paymentStatus,
        },
        payment: {
          id: sessionPayment.id,
          status: sessionPayment.status,
        },
        userId,
        payeeId,
      });
    });

    // Trigger background payout process
    void processPayout(milestone.id);

    emitAgreementRefresh(getAgreementParticipantIds(agreement), {
      reason: 'milestone_payment_paid',
      agreementId,
      milestoneId,
      actorId: userId,
    });

    return res.json({ success: true, milestone: paymentResult.milestone, payment: paymentResult.payment });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAgreementMilestonePaymentSession = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const milestoneId = singleValue(req.params.milestoneId);
    const userId = req.user!.id;

    if (!agreementId || !milestoneId) {
      return res.status(400).json({ success: false, message: 'Agreement and milestone ids are required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        employer: {
          select: { id: true, email: true },
        },
        client: {
          select: { id: true, email: true },
        },
        milestones: {
          where: { id: milestoneId },
          include: {
            payments: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!agreement || !isAgreementParticipant(agreement, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (agreement.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Only active agreements can open payment sessions' });
    }

    const milestone = agreement.milestones[0];

    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found for this agreement' });
    }

    if (!milestone.amount) {
      return res.status(400).json({ success: false, message: 'Milestone amount is required before payment can start' });
    }

    if (milestone.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Only completed milestones can open payment sessions' });
    }

    if (milestone.paymentStatus !== 'REQUESTED') {
      return res.status(400).json({ success: false, message: 'Payment must be requested before a payment session can start' });
    }

    const { payerId, payeeId } = getAgreementPaymentActors(agreement);

    if (!payerId || !payeeId) {
      return res.status(400).json({ success: false, message: 'This agreement is missing its payment participants' });
    }

    if (userId !== payerId) {
      return res.status(403).json({ success: false, message: 'Only the paying counterparty can start this payment session' });
    }

    const latestPayment = getLatestMilestonePayment(milestone);
    const payerEmail = agreement.type === 'JOB' ? (agreement as any).employer?.email : (agreement as any).client?.email;

    if (latestPayment && ['PENDING', 'PROCESSING'].includes(latestPayment.status)) {
      return res.json({ success: true, payment: latestPayment, sessionAlreadyActive: true });
    }

    if (!payerEmail) {
      return res.status(400).json({ success: false, message: 'The payer email is required before a payment session can start' });
    }

    const paymentSession = await initializePaymentSession({
      paymentId: randomUUID(),
      reference: generatePaymentReference(),
      payerEmail,
      amount: milestone.amount!,
      agreementId,
      milestoneId,
    });

    const payment = await prisma.$transaction(async (tx) => {
      const nextPayment = await tx.payment.create({
        data: {
          id: paymentSession.paymentId,
          agreementId,
          milestoneId,
          payerId,
          payeeId,
          amount: milestone.amount!,
          provider: paymentSession.provider,
          status: paymentSession.status,
          checkoutUrl: paymentSession.checkoutUrl,
          currency: paymentSession.currency,
          providerAmount: paymentSession.providerAmount,
          reference: paymentSession.reference,
        } as any,
      });

      await createAgreementEvent(tx, {
        agreementId,
        actorId: userId,
        eventType: 'MILESTONE_PAYMENT_STARTED',
        message: `${paymentSession.provider === 'PAYSTACK' ? 'Paystack' : 'Sandbox'} payment session opened for milestone "${milestone.title}".`,
        fromStatus: latestPayment?.status || milestone.paymentStatus,
        toStatus: nextPayment.status,
      });

      return nextPayment;
    });

    emitAgreementRefresh(getAgreementParticipantIds(agreement), {
      reason: 'payment_started',
      agreementId,
      milestoneId,
      paymentId: payment.id,
      actorId: userId,
    });

    return res.status(201).json({ success: true, payment });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAgreementPaymentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const paymentId = singleValue(req.params.paymentId);
    const userId = req.user!.id;
    const { status, failureReason } = req.body as { status: string; failureReason?: string };

    if (!agreementId || !paymentId) {
      return res.status(400).json({ success: false, message: 'Agreement and payment ids are required' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        agreement: true,
        milestone: true,
      },
    });

    if (!payment || payment.agreementId !== agreementId) {
      return res.status(404).json({ success: false, message: 'Payment not found for this agreement' });
    }

    if (!isAgreementParticipant(payment.agreement, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (userId !== payment.payerId) {
      return res.status(403).json({ success: false, message: 'Only the paying counterparty can update this payment' });
    }

    if (payment.status === status) {
      return res.json({ success: true, payment });
    }

    if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(payment.status)) {
      return res.status(400).json({ success: false, message: 'This payment session is already closed' });
    }

    if (payment.milestone.paymentStatus !== 'REQUESTED') {
      return res.status(400).json({ success: false, message: 'This milestone is no longer awaiting payment' });
    }

    if (status === 'SUCCEEDED') {
      const completedPayment = await prisma.$transaction(async (tx) =>
        completeMilestonePayment(tx, {
          agreement: {
            id: payment.agreement.id,
            title: payment.agreement.title,
          },
          milestone: {
            id: payment.milestone.id,
            title: payment.milestone.title,
            paymentStatus: payment.milestone.paymentStatus,
          },
          payment: {
            id: payment.id,
            status: payment.status,
          },
          userId,
          payeeId: payment.payeeId,
        })
      );

      emitAgreementRefresh(getAgreementParticipantIds(payment.agreement), {
        reason: 'payment_succeeded',
        agreementId,
        milestoneId: payment.milestoneId,
        paymentId,
        actorId: userId,
      });

      return res.json({ success: true, payment: completedPayment.payment, milestone: completedPayment.milestone });
    }

    const closedAt = new Date();
    const updatedPayment = await prisma.$transaction(async (tx) => {
      const nextPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status,
          failureReason: status === 'FAILED' ? failureReason?.trim() || 'Sandbox payment failed' : null,
          completedAt: closedAt,
        },
      });

      await createAgreementEvent(tx, {
        agreementId,
        actorId: userId,
        eventType: status === 'FAILED' ? 'MILESTONE_PAYMENT_FAILED' : 'MILESTONE_PAYMENT_CANCELLED',
        message:
          status === 'FAILED'
            ? `Payment attempt failed for milestone "${payment.milestone.title}".`
            : `Payment session cancelled for milestone "${payment.milestone.title}".`,
        fromStatus: payment.status,
        toStatus: status,
      });

      return nextPayment;
    });

    emitAgreementRefresh(getAgreementParticipantIds(payment.agreement), {
      reason: status === 'FAILED' ? 'payment_failed' : 'payment_cancelled',
      agreementId,
      milestoneId: payment.milestoneId,
      paymentId,
      actorId: userId,
    });

    return res.json({ success: true, payment: updatedPayment });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyAgreementPayment = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const paymentId = singleValue(req.params.paymentId);
    const userId = req.user!.id;

    if (!agreementId || !paymentId) {
      return res.status(400).json({ success: false, message: 'Agreement and payment ids are required' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        agreement: true,
        milestone: true,
      },
    });

    if (!payment || payment.agreementId !== agreementId) {
      return res.status(404).json({ success: false, message: 'Payment not found for this agreement' });
    }

    if (!isAgreementParticipant(payment.agreement, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (payment.provider !== 'PAYSTACK') {
      return res.status(400).json({ success: false, message: 'Only external payment sessions require verification' });
    }

    if (payment.status === 'SUCCEEDED') {
      return res.json({ success: true, payment, alreadyVerified: true });
    }

    const verification = await verifyProviderPayment(payment.reference);

    if (verification.status === 'PROCESSING') {
      const updatedPayment =
        payment.status === 'PROCESSING'
          ? payment
          : await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'PROCESSING',
                failureReason: verification.failureReason || null,
              },
            });

      emitAgreementRefresh(getAgreementParticipantIds(payment.agreement), {
        reason: 'payment_processing',
        agreementId,
        milestoneId: payment.milestoneId,
        paymentId,
        actorId: userId,
      });

      return res.json({
        success: true,
        payment: updatedPayment,
        verificationStatus: 'PROCESSING',
      });
    }

      if (verification.status === 'SUCCEEDED') {
        const completedPayment = await prisma.$transaction(async (tx) =>
          completeMilestonePayment(tx, {
            agreement: {
              id: payment.agreement.id,
              title: payment.agreement.title,
            },
            milestone: {
              id: payment.milestone.id,
              title: payment.milestone.title,
              paymentStatus: payment.milestone.paymentStatus,
            },
            payment: {
              id: payment.id,
              status: payment.status,
            },
            userId: payment.payerId,
            payeeId: payment.payeeId,
            completedAt: verification.completedAt ? new Date(verification.completedAt) : undefined,
          })
        );

        // Trigger background payout process
        void processPayout(payment.milestone.id);

        emitAgreementRefresh(getAgreementParticipantIds(payment.agreement), {
          reason: 'payment_succeeded',
          agreementId,
          milestoneId: payment.milestoneId,
          paymentId,
          actorId: payment.payerId,
        });

        return res.json({
          success: true,
          payment: completedPayment.payment,
          milestone: completedPayment.milestone,
          verificationStatus: 'SUCCEEDED',
        });
      }

    const failedPayment = await prisma.$transaction(async (tx) => {
      const nextPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: verification.status,
          failureReason: verification.failureReason || 'Payment could not be verified',
          completedAt: new Date(),
        },
      });

      await createAgreementEvent(tx, {
        agreementId,
        actorId: payment.payerId,
        eventType: verification.status === 'CANCELLED' ? 'MILESTONE_PAYMENT_CANCELLED' : 'MILESTONE_PAYMENT_FAILED',
        message:
          verification.status === 'CANCELLED'
            ? `Payment session cancelled for milestone "${payment.milestone.title}".`
            : `Payment attempt failed for milestone "${payment.milestone.title}".`,
        fromStatus: payment.status,
        toStatus: verification.status,
      });

      return nextPayment;
    });

    emitAgreementRefresh(getAgreementParticipantIds(payment.agreement), {
      reason: verification.status === 'CANCELLED' ? 'payment_cancelled' : 'payment_failed',
      agreementId,
      milestoneId: payment.milestoneId,
      paymentId,
      actorId: payment.payerId,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
