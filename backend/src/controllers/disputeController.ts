import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { singleValue } from '../utils/request';
import { createAgreementEvent } from '../utils/agreementEvents';
import { createNotifications } from '../utils/notifications';
import { emitAgreementRefresh } from '../utils/workflowRealtime';
import {
  agreementUserSelect,
  getAgreementCounterpartyId,
  getAgreementParticipantIds,
  hasActiveAgreementDispute,
  isAgreementParticipant
} from '../utils/agreementHelpers';

/**
 * Open a new dispute for an agreement milestone.
 */
export const openDispute = async (req: AuthRequest, res: Response) => {
  try {
    const agreementId = singleValue(req.params.id);
    const userId = req.user!.id;
    const { type, title, description, evidenceUrl } = req.body as {
      type: string;
      title: string;
      description: string;
      evidenceUrl?: string;
    };

    if (!agreementId || !type || !title || !description) {
      return res.status(400).json({ success: false, message: 'Missing required dispute details' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        disputes: {
          where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
          select: { id: true, status: true }
        }
      }
    });

    if (!agreement || !isAgreementParticipant(agreement, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (hasActiveAgreementDispute(agreement.disputes)) {
      return res.status(409).json({ success: false, message: 'This agreement already has an active dispute' });
    }

    const counterpartyId = getAgreementCounterpartyId(agreement, userId);

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
        }
      });

      await createAgreementEvent(tx, {
        agreementId,
        actorId: userId,
        eventType: 'DISPUTE_OPENED',
        message: `Dispute opened: ${createdDispute.title}.`,
        toStatus: createdDispute.status,
      });

      // Notify counterparty and admins
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true }
      });

      const notifyIds = [...new Set([counterpartyId, ...adminUsers.map(a => a.id)].filter(Boolean) as string[])];
      
      await createNotifications(tx, notifyIds.map(participantId => ({
        userId: participantId,
        type: 'DISPUTE_OPENED',
        title: 'New dispute opened',
        message: `A dispute was opened on "${agreement.title}".`,
        actionUrl: `/agreements/${agreementId}`
      })));

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

/**
 * Get full details of a specific dispute, including messages.
 */
export const getDisputeDetails = async (req: AuthRequest, res: Response) => {
  try {
    const disputeId = singleValue(req.params.disputeId);
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const dispute = await prisma.agreementDispute.findUnique({
      where: { id: disputeId },
      include: {
        agreement: true,
        creator: { select: agreementUserSelect },
        counterparty: { select: agreementUserSelect },
        resolver: { select: { id: true, email: true } },
        messages: {
          include: { sender: { select: agreementUserSelect } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    // Access check: participant or admin
    const isAdmin = userRole === 'ADMIN';
    const isParticipant = dispute.creatorId === userId || dispute.counterpartyId === userId;

    if (!isAdmin && !isParticipant) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.json({ success: true, dispute });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add a message or evidence to an active dispute.
 */
export const addDisputeMessage = async (req: AuthRequest, res: Response) => {
  try {
    const disputeId = singleValue(req.params.disputeId);
    const userId = req.user!.id;
    const { content, evidenceUrl } = req.body as { content: string; evidenceUrl?: string };

    if (!disputeId || !content) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const dispute = await prisma.agreementDispute.findUnique({
      where: { id: disputeId },
      include: { agreement: true }
    });

    if (!dispute || dispute.status === 'RESOLVED' || dispute.status === 'DISMISSED') {
      return res.status(400).json({ success: false, message: 'Cannot message on an inactive dispute' });
    }

    // Access check
    const isAdmin = req.user!.role === 'ADMIN';
    const isParticipant = dispute.creatorId === userId || dispute.counterpartyId === userId;
    if (!isAdmin && !isParticipant) return res.status(403).json({ success: false, message: 'Access denied' });

    const message = await prisma.disputeMessage.create({
      data: {
        disputeId,
        senderId: userId,
        content: content.trim(),
        evidenceUrl: evidenceUrl?.trim() || null
      },
      include: { sender: { select: agreementUserSelect } }
    });

    // Notify other parties
    const notifyIds = [dispute.creatorId, dispute.counterpartyId]
      .filter((id): id is string => Boolean(id) && id !== userId);
    
    if (notifyIds.length > 0) {
      await createNotifications(prisma, notifyIds.map(id => ({
        userId: id,
        type: 'DISPUTE_MESSAGE',
        title: 'New message in dispute',
        message: `New evidence or message added to your dispute: "${dispute.title}"`,
        actionUrl: `/agreements/${dispute.agreementId}`
      })));
    }

    return res.status(201).json({ success: true, message });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Resolve a dispute (Admin only).
 */
export const resolveDispute = async (req: AuthRequest, res: Response) => {
  try {
    const disputeId = singleValue(req.params.disputeId);
    const userId = req.user!.id;
    const { status, resolutionNote } = req.body as { status: 'RESOLVED' | 'DISMISSED'; resolutionNote: string };

    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    if (!disputeId || !status || !resolutionNote) {
      return res.status(400).json({ success: false, message: 'Resolution details required' });
    }

    const dispute = await prisma.agreementDispute.findUnique({
      where: { id: disputeId },
      include: { agreement: true }
    });

    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found' });

    const updatedDispute = await prisma.$transaction(async (tx) => {
      const resolved = await tx.agreementDispute.update({
        where: { id: disputeId },
        data: {
          status,
          resolutionNote,
          resolverId: userId,
          resolvedAt: new Date()
        }
      });

      await createAgreementEvent(tx, {
        agreementId: dispute.agreementId,
        actorId: userId,
        eventType: status === 'RESOLVED' ? 'DISPUTE_RESOLVED' : 'DISPUTE_DISMISSED',
        message: `Dispute ${status.toLowerCase()}: ${resolutionNote}`,
        fromStatus: dispute.status,
        toStatus: status
      });

      const notifyIds = [dispute.creatorId, dispute.counterpartyId].filter((id): id is string => Boolean(id));
      await createNotifications(tx, notifyIds.map(id => ({
        userId: id,
        type: 'DISPUTE_RESOLVED',
        title: 'Dispute Resolution reached',
        message: `An admin has resolved the dispute: "${dispute.title}". Result: ${status}`,
        actionUrl: `/agreements/${dispute.agreementId}`
      })));

      return resolved;
    });

    return res.json({ success: true, dispute: updatedDispute });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
