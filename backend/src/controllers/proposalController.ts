import { Prisma } from '@prisma/client';
import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { singleValue } from '../utils/request';
import { createAgreementEvent } from '../utils/agreementEvents';
import {
  generateProposalDecisionBrief,
  generateProposalComparisonSummary,
  generateProposalDraft,
  type ProposalComparisonOptionContext,
} from '../services/ai';
import { createNotification } from '../utils/notifications';
import { emitAgreementRefresh, emitProposalRefresh } from '../utils/workflowRealtime';

const activeProposalStatuses = ['PENDING', 'COUNTERED'] as const;
const allowedJobProposalApplicationStatuses = ['SUBMITTED', 'SHORTLISTED', 'INTERVIEW'] as const;
const allowedStatusActions = ['ACCEPTED', 'REJECTED', 'CANCELLED'] as const;

const userSelect = {
  id: true,
  email: true,
  role: true,
  employerProfile: true,
  jobSeekerProfile: true,
  freelancerProfile: true,
} as const;

const proposalInclude = {
  creator: { select: userSelect },
  recipient: { select: userSelect },
  application: {
    select: {
      id: true,
      status: true,
      coverLetter: true,
      seekerId: true,
      agreement: {
        select: { id: true, status: true, updatedAt: true, amount: true },
      },
      job: {
        select: {
          id: true,
          title: true,
          salary: true,
          employerId: true,
        },
      },
      seeker: { select: userSelect },
    },
  },
  serviceRequest: {
    select: {
      id: true,
      status: true,
      message: true,
      budget: true,
      timeline: true,
      clientId: true,
      agreement: {
        select: { id: true, status: true, updatedAt: true, amount: true },
      },
      client: { select: userSelect },
      service: {
        select: {
          id: true,
          title: true,
          price: true,
          freelancerId: true,
        },
      },
    },
  },
  revisions: {
    include: {
      author: { select: userSelect },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

type ProposalTx = Prisma.TransactionClient;
type ProposalWithRelations = Prisma.ProposalGetPayload<{
  include: typeof proposalInclude;
}>;
type JobProposalWithRelations = ProposalWithRelations & {
  application: NonNullable<ProposalWithRelations['application']>;
};
type ServiceProposalWithRelations = ProposalWithRelations & {
  serviceRequest: NonNullable<ProposalWithRelations['serviceRequest']>;
};

const getProposalUserName = (user?: ProposalWithRelations['creator'] | null) => {
  if (!user) return 'Someone';

  const fullName = [
    user.jobSeekerProfile?.firstName || user.freelancerProfile?.firstName || '',
    user.jobSeekerProfile?.lastName || user.freelancerProfile?.lastName || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return user.employerProfile?.companyName || fullName || user.email;
};

const getProposalSourceLabel = (proposal: ProposalWithRelations) => {
  if (proposal.type === 'JOB') {
    return proposal.application?.job.title || 'your application';
  }

  return proposal.serviceRequest?.service.title || 'your service request';
};

const appendTimelineToSummary = (summary: string, timeline?: string | null) => {
  if (!timeline?.trim()) {
    return summary.trim();
  }

  return `${summary.trim()}\n\nTimeline: ${timeline.trim()}`;
};

const expireStaleProposals = async () => {
  await prisma.proposal.updateMany({
    where: {
      status: { in: [...activeProposalStatuses] },
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });
};

const isProposalParticipant = (
  proposal: {
    creatorId: string;
    recipientId: string;
  },
  userId: string,
) => proposal.creatorId === userId || proposal.recipientId === userId;

const getLatestRevision = (proposal: { revisions: Array<{ authorId: string }> }) => proposal.revisions[0] || null;

const isAwaitingUserResponse = (
  proposal: { status: string; revisions: Array<{ authorId: string }> },
  userId: string,
) => {
  const latestRevision = getLatestRevision(proposal);
  return (
    activeProposalStatuses.includes(proposal.status as (typeof activeProposalStatuses)[number]) &&
    Boolean(latestRevision) &&
    latestRevision!.authorId !== userId
  );
};

const cancelSiblingActiveProposals = async (
  tx: ProposalTx,
  proposal: {
    id: string;
    applicationId?: string | null;
    serviceRequestId?: string | null;
  },
) => {
  await tx.proposal.updateMany({
    where: {
      id: { not: proposal.id },
      status: { in: [...activeProposalStatuses] },
      ...(proposal.applicationId
        ? { applicationId: proposal.applicationId }
        : { serviceRequestId: proposal.serviceRequestId }),
    },
    data: { status: 'CANCELLED' },
  });
};

const createJobAgreementFromProposal = async (
  tx: ProposalTx,
  proposal: JobProposalWithRelations,
  actorId: string,
) => {
  const currentApplication = proposal.application;

  const nextSummary = appendTimelineToSummary(
    proposal.summary || currentApplication.coverLetter || `Job agreement for ${currentApplication.job.title}`,
    proposal.timeline,
  );

  await tx.application.update({
    where: { id: currentApplication.id },
    data: { status: 'HIRED' },
  });

  if (currentApplication.agreement) {
    const updatedAgreement = await tx.agreement.update({
      where: { id: currentApplication.agreement.id },
      data: {
        status: 'ACTIVE',
        title: proposal.title,
        summary: nextSummary,
        amount: proposal.amount || currentApplication.agreement.amount || currentApplication.job.salary || null,
      },
    });

    if (currentApplication.agreement.status !== 'ACTIVE') {
      await createAgreementEvent(tx, {
        agreementId: updatedAgreement.id,
        actorId,
        eventType: 'STATUS_CHANGED',
        message: 'Agreement reactivated from an accepted job proposal.',
        fromStatus: currentApplication.agreement.status,
        toStatus: 'ACTIVE',
      });
    }

    await createAgreementEvent(tx, {
      agreementId: updatedAgreement.id,
      actorId,
      eventType: 'PROPOSAL_ACCEPTED',
      message: 'Accepted proposal terms were applied to this job agreement.',
      toStatus: updatedAgreement.status,
    });

    return updatedAgreement;
  }

  const createdAgreement = await tx.agreement.create({
    data: {
      type: 'JOB',
      title: proposal.title,
      summary: nextSummary,
      amount: proposal.amount || currentApplication.job.salary || null,
      applicationId: currentApplication.id,
      employerId: currentApplication.job.employerId,
      seekerId: currentApplication.seekerId,
    },
  });

  await createAgreementEvent(tx, {
    agreementId: createdAgreement.id,
    actorId,
    eventType: 'CREATED',
    message: 'Agreement created from an accepted job proposal.',
    toStatus: createdAgreement.status,
  });

  return createdAgreement;
};

const createServiceAgreementFromProposal = async (
  tx: ProposalTx,
  proposal: ServiceProposalWithRelations,
  actorId: string,
) => {
  const currentRequest = proposal.serviceRequest;

  const nextSummary = appendTimelineToSummary(
    proposal.summary || currentRequest.message.trim(),
    proposal.timeline,
  );

  await tx.serviceRequest.update({
    where: { id: currentRequest.id },
    data: { status: 'ACCEPTED' },
  });

  if (currentRequest.agreement) {
    const updatedAgreement = await tx.agreement.update({
      where: { id: currentRequest.agreement.id },
      data: {
        status: 'ACTIVE',
        title: proposal.title,
        summary: nextSummary,
        amount: proposal.amount || currentRequest.agreement.amount || currentRequest.budget || null,
      },
    });

    if (currentRequest.agreement.status !== 'ACTIVE') {
      await createAgreementEvent(tx, {
        agreementId: updatedAgreement.id,
        actorId,
        eventType: 'STATUS_CHANGED',
        message: 'Agreement reactivated from an accepted service proposal.',
        fromStatus: currentRequest.agreement.status,
        toStatus: 'ACTIVE',
      });
    }

    await createAgreementEvent(tx, {
      agreementId: updatedAgreement.id,
      actorId,
      eventType: 'PROPOSAL_ACCEPTED',
      message: 'Accepted proposal terms were applied to this service agreement.',
      toStatus: updatedAgreement.status,
    });

    return updatedAgreement;
  }

  const createdAgreement = await tx.agreement.create({
    data: {
      type: 'SERVICE',
      title: proposal.title,
      summary: nextSummary,
      amount: proposal.amount || currentRequest.budget || null,
      serviceRequestId: currentRequest.id,
      freelancerId: currentRequest.service.freelancerId,
      clientId: currentRequest.clientId,
    },
  });

  await createAgreementEvent(tx, {
    agreementId: createdAgreement.id,
    actorId,
    eventType: 'CREATED',
    message: 'Agreement created from an accepted service proposal.',
    toStatus: createdAgreement.status,
  });

  return createdAgreement;
};

export const generateJobProposalDraft = async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = singleValue(req.params.applicationId);
    const { title, amount, timeline, focus } = req.body as {
      title?: string;
      amount?: string;
      timeline?: string;
      focus?: string;
    };

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'Application id is required' });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        coverLetter: true,
        agreement: {
          select: { id: true }
        },
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            salary: true,
            employerId: true,
          },
        },
        seeker: {
          select: userSelect,
        },
      },
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.job.employerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!allowedJobProposalApplicationStatuses.includes(application.status as (typeof allowedJobProposalApplicationStatuses)[number])) {
      return res.status(400).json({ success: false, message: 'This application cannot receive a proposal in its current state' });
    }

    if (application.agreement) {
      return res.status(400).json({ success: false, message: 'This application is already attached to an agreement' });
    }

    const draft = await generateProposalDraft({
      type: 'JOB',
      sourceTitle: application.job.title,
      sourceDescription: application.job.description,
      counterpartName: getProposalUserName(application.seeker),
      counterpartRoleLabel: 'Candidate',
      requestSummary: application.coverLetter,
      skills:
        application.seeker.jobSeekerProfile?.skills ||
        application.seeker.jobSeekerProfile?.experience ||
        '',
      amountHint: amount?.trim() || application.job.salary || '',
      timelineHint: timeline?.trim() || '',
      focus: focus?.trim() || '',
      titleHint: title?.trim() || `${application.job.title} proposal`,
    });

    return res.json({ success: true, draft });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const generateServiceProposalDraft = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = singleValue(req.params.requestId);
    const { title, amount, timeline, focus } = req.body as {
      title?: string;
      amount?: string;
      timeline?: string;
      focus?: string;
    };

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Service request id is required' });
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        message: true,
        budget: true,
        timeline: true,
        agreement: {
          select: { id: true }
        },
        client: {
          select: userSelect,
        },
        service: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            deliveryTime: true,
            freelancerId: true,
          },
        },
      },
    });

    if (!serviceRequest) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    if (serviceRequest.service.freelancerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (serviceRequest.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Only pending service requests can receive a proposal' });
    }

    if (serviceRequest.agreement) {
      return res.status(400).json({ success: false, message: 'This service request is already attached to an agreement' });
    }

    const draft = await generateProposalDraft({
      type: 'SERVICE',
      sourceTitle: serviceRequest.service.title,
      sourceDescription: serviceRequest.service.description,
      counterpartName: getProposalUserName(serviceRequest.client),
      counterpartRoleLabel: 'Client',
      requestSummary: serviceRequest.message,
      skills: '',
      amountHint: amount?.trim() || serviceRequest.budget || String(serviceRequest.service.price || ''),
      timelineHint:
        timeline?.trim() || serviceRequest.timeline || serviceRequest.service.deliveryTime || '',
      focus: focus?.trim() || '',
      titleHint: title?.trim() || `${serviceRequest.service.title} proposal`,
    });

    return res.json({ success: true, draft });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createJobProposal = async (req: AuthRequest, res: Response) => {
  try {
    await expireStaleProposals();

    const applicationId = singleValue(req.params.applicationId);
    const { title, summary, amount, timeline, expiresAt, message } = req.body as {
      title: string;
      summary: string;
      amount?: string;
      timeline?: string;
      expiresAt?: string;
      message?: string;
    };

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'Application id is required' });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        agreement: {
          select: { id: true, status: true, amount: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            salary: true,
          },
        },
        proposals: {
          where: { status: { in: [...activeProposalStatuses] } },
          select: { id: true },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.job.employerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!allowedJobProposalApplicationStatuses.includes(application.status as (typeof allowedJobProposalApplicationStatuses)[number])) {
      return res.status(400).json({ success: false, message: 'This application cannot receive a proposal in its current state' });
    }

    if (application.agreement) {
      return res.status(400).json({ success: false, message: 'This application is already attached to an agreement' });
    }

    if (application.proposals.length > 0) {
      return res.status(409).json({ success: false, message: 'An active proposal already exists for this application' });
    }

    const proposal = await prisma.$transaction(async (tx) => {
      const createdProposal = await tx.proposal.create({
        data: {
          applicationId,
          creatorId: req.user!.id,
          recipientId: application.seekerId,
          type: 'JOB',
          title: title.trim(),
          summary: summary.trim(),
          amount: amount?.trim() || null,
          timeline: timeline?.trim() || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          revisions: {
            create: {
              authorId: req.user!.id,
              summary: summary.trim(),
              amount: amount?.trim() || null,
              timeline: timeline?.trim() || null,
              message: message?.trim() || null,
            },
          },
        },
        include: proposalInclude,
      });

      await createNotification(tx, {
        userId: createdProposal.recipientId,
        type: 'PROPOSAL_CREATED',
        title: 'New proposal received',
        message: `${getProposalUserName(createdProposal.creator)} sent you a proposal for ${getProposalSourceLabel(createdProposal)}.`,
        actionUrl: '/proposals',
      });

      return createdProposal;
    });

    emitProposalRefresh([proposal.creatorId, proposal.recipientId], {
      reason: 'created',
      proposalId: proposal.id,
      actorId: req.user!.id,
    });

    return res.status(201).json({ success: true, proposal });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createServiceProposal = async (req: AuthRequest, res: Response) => {
  try {
    await expireStaleProposals();

    const requestId = singleValue(req.params.requestId);
    const { title, summary, amount, timeline, expiresAt, message } = req.body as {
      title: string;
      summary: string;
      amount?: string;
      timeline?: string;
      expiresAt?: string;
      message?: string;
    };

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Service request id is required' });
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        agreement: {
          select: { id: true, status: true, amount: true },
        },
        service: {
          select: {
            id: true,
            title: true,
            freelancerId: true,
            price: true,
          },
        },
        proposals: {
          where: { status: { in: [...activeProposalStatuses] } },
          select: { id: true },
        },
      },
    });

    if (!serviceRequest) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    if (serviceRequest.service.freelancerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (serviceRequest.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Only pending service requests can receive a proposal' });
    }

    if (serviceRequest.agreement) {
      return res.status(400).json({ success: false, message: 'This service request is already attached to an agreement' });
    }

    if (serviceRequest.proposals.length > 0) {
      return res.status(409).json({ success: false, message: 'An active proposal already exists for this service request' });
    }

    const proposal = await prisma.$transaction(async (tx) => {
      const createdProposal = await tx.proposal.create({
        data: {
          serviceRequestId: requestId,
          creatorId: req.user!.id,
          recipientId: serviceRequest.clientId,
          type: 'SERVICE',
          title: title.trim(),
          summary: summary.trim(),
          amount: amount?.trim() || null,
          timeline: timeline?.trim() || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          revisions: {
            create: {
              authorId: req.user!.id,
              summary: summary.trim(),
              amount: amount?.trim() || null,
              timeline: timeline?.trim() || null,
              message: message?.trim() || null,
            },
          },
        },
        include: proposalInclude,
      });

      await createNotification(tx, {
        userId: createdProposal.recipientId,
        type: 'PROPOSAL_CREATED',
        title: 'New proposal received',
        message: `${getProposalUserName(createdProposal.creator)} sent you a proposal for ${getProposalSourceLabel(createdProposal)}.`,
        actionUrl: '/proposals',
      });

      return createdProposal;
    });

    emitProposalRefresh([proposal.creatorId, proposal.recipientId], {
      reason: 'created',
      proposalId: proposal.id,
      actorId: req.user!.id,
    });

    return res.status(201).json({ success: true, proposal });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyProposals = async (req: AuthRequest, res: Response) => {
  try {
    await expireStaleProposals();

    const userId = req.user!.id;

    const proposals = await prisma.proposal.findMany({
      where: {
        OR: [{ creatorId: userId }, { recipientId: userId }],
      },
      include: proposalInclude,
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({ success: true, proposals });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const compareProposals = async (req: AuthRequest, res: Response) => {
  try {
    await expireStaleProposals();

    const proposalIds = Array.isArray(req.body?.proposalIds) ? (req.body.proposalIds as string[]) : [];

    if (proposalIds.length < 2) {
      return res.status(400).json({ success: false, message: 'Select at least two proposals to compare' });
    }

    const proposals = await prisma.proposal.findMany({
      where: {
        id: { in: proposalIds },
        OR: [{ creatorId: req.user!.id }, { recipientId: req.user!.id }],
      },
      include: proposalInclude,
    });

    if (proposals.length !== proposalIds.length) {
      return res.status(404).json({ success: false, message: 'One or more proposals were not found' });
    }

    const proposalMap = new Map(proposals.map((proposal) => [proposal.id, proposal]));
    const orderedProposals = proposalIds.map((proposalId) => proposalMap.get(proposalId)).filter(Boolean) as ProposalWithRelations[];

    const comparisonOptions: ProposalComparisonOptionContext[] = orderedProposals.map((proposal) => ({
      title: proposal.title,
      type: proposal.type as ProposalComparisonOptionContext['type'],
      status: proposal.status,
      counterpartyName: getProposalUserName(
        proposal.creatorId === req.user!.id ? proposal.recipient : proposal.creator,
      ),
      amount: proposal.amount,
      timeline: proposal.timeline,
      sourceTitle: getProposalSourceLabel(proposal),
      sourceStatus: proposal.application?.status || proposal.serviceRequest?.status || null,
    }));

    const summary = await generateProposalComparisonSummary({
      options: comparisonOptions,
    });

    return res.json({
      success: true,
      comparison: {
        summary,
        comparedCount: orderedProposals.length,
        proposals: orderedProposals.map((proposal) => {
          const counterparty = proposal.creatorId === req.user!.id ? proposal.recipient : proposal.creator;
          const source = proposal.application
            ? {
                kind: 'APPLICATION',
                id: proposal.application.id,
                title: proposal.application.job.title,
                status: proposal.application.status,
                agreement: proposal.application.agreement,
              }
            : proposal.serviceRequest
              ? {
                  kind: 'SERVICE_REQUEST',
                  id: proposal.serviceRequest.id,
                  title: proposal.serviceRequest.service.title,
                  status: proposal.serviceRequest.status,
                  agreement: proposal.serviceRequest.agreement,
                }
              : null;

          return {
            id: proposal.id,
            type: proposal.type,
            status: proposal.status,
            title: proposal.title,
            summary: proposal.summary,
            amount: proposal.amount,
            timeline: proposal.timeline,
            updatedAt: proposal.updatedAt,
            counterpartyName: getProposalUserName(counterparty),
            source,
          };
        }),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const generateProposalDecisionSummary = async (req: AuthRequest, res: Response) => {
  try {
    await expireStaleProposals();

    const proposalId = singleValue(req.params.id);
    const { focus } = req.body as { focus?: string };

    if (!proposalId) {
      return res.status(400).json({ success: false, message: 'Proposal id is required' });
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: proposalInclude,
    });

    if (!proposal || !isProposalParticipant(proposal, req.user!.id)) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (!activeProposalStatuses.includes(proposal.status as (typeof activeProposalStatuses)[number])) {
      return res.status(400).json({ success: false, message: 'Decision briefs are only available for active proposals' });
    }

    if (!isAwaitingUserResponse(proposal, req.user!.id)) {
      return res.status(400).json({ success: false, message: 'Decision briefs are only available when it is your turn to respond' });
    }

    const counterparty = proposal.creatorId === req.user!.id ? proposal.recipient : proposal.creator;
    const brief = await generateProposalDecisionBrief({
      type: proposal.type as 'JOB' | 'SERVICE',
      proposalTitle: proposal.title,
      proposalSummary: proposal.summary,
      proposalAmount: proposal.amount,
      proposalTimeline: proposal.timeline,
      expiresAt: proposal.expiresAt?.toISOString() || null,
      sourceTitle: getProposalSourceLabel(proposal),
      sourceStatus: proposal.application?.status || proposal.serviceRequest?.status || null,
      sourceAmountHint:
        proposal.type === 'JOB'
          ? proposal.application?.job.salary || null
          : proposal.serviceRequest?.budget || String(proposal.serviceRequest?.service.price || ''),
      sourceTimelineHint: proposal.serviceRequest?.timeline || null,
      counterpartyName: getProposalUserName(counterparty),
      revisionCount: proposal.revisions.length,
      focus: focus?.trim() || '',
    });

    return res.json({ success: true, brief });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProposalById = async (req: AuthRequest, res: Response) => {
  try {
    await expireStaleProposals();

    const proposalId = singleValue(req.params.id);

    if (!proposalId) {
      return res.status(400).json({ success: false, message: 'Proposal id is required' });
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: proposalInclude,
    });

    if (!proposal || !isProposalParticipant(proposal, req.user!.id)) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    return res.json({ success: true, proposal });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const counterProposal = async (req: AuthRequest, res: Response) => {
  try {
    await expireStaleProposals();

    const proposalId = singleValue(req.params.id);
    const { summary, amount, timeline, expiresAt, message } = req.body as {
      summary: string;
      amount?: string;
      timeline?: string;
      expiresAt?: string;
      message?: string;
    };

    if (!proposalId) {
      return res.status(400).json({ success: false, message: 'Proposal id is required' });
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: proposalInclude,
    });

    if (!proposal || !isProposalParticipant(proposal, req.user!.id)) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (!activeProposalStatuses.includes(proposal.status as (typeof activeProposalStatuses)[number])) {
      return res.status(400).json({ success: false, message: 'Only active proposals can be countered' });
    }

    if (!isAwaitingUserResponse(proposal, req.user!.id)) {
      return res.status(400).json({ success: false, message: 'You cannot counter your own latest proposal terms' });
    }

    if (proposal.application?.agreement || proposal.serviceRequest?.agreement) {
      return res.status(400).json({ success: false, message: 'This proposal source is already attached to an agreement' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.proposalRevision.create({
        data: {
          proposalId,
          authorId: req.user!.id,
          summary: summary.trim(),
          amount: amount?.trim() || null,
          timeline: timeline?.trim() || null,
          message: message?.trim() || null,
        },
      });

      await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: 'COUNTERED',
          summary: summary.trim(),
          amount: amount?.trim() || null,
          timeline: timeline?.trim() || null,
          expiresAt: expiresAt ? new Date(expiresAt) : proposal.expiresAt,
        },
      });

      await createNotification(tx, {
        userId: proposal.creatorId === req.user!.id ? proposal.recipientId : proposal.creatorId,
        type: 'PROPOSAL_COUNTERED',
        title: 'Proposal counter received',
        message: `${getProposalUserName(
          proposal.creatorId === req.user!.id ? proposal.creator : proposal.recipient,
        )} countered the terms for ${getProposalSourceLabel(proposal)}.`,
        actionUrl: '/proposals',
      });
    });

    const updatedProposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: proposalInclude,
    });

    if (updatedProposal) {
      emitProposalRefresh([updatedProposal.creatorId, updatedProposal.recipientId], {
        reason: 'countered',
        proposalId: updatedProposal.id,
        actorId: req.user!.id,
      });
    }

    return res.json({ success: true, proposal: updatedProposal });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProposalStatus = async (req: AuthRequest, res: Response) => {
  try {
    await expireStaleProposals();

    const proposalId = singleValue(req.params.id);
    const { status } = req.body as { status: (typeof allowedStatusActions)[number] };

    if (!proposalId) {
      return res.status(400).json({ success: false, message: 'Proposal id is required' });
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: proposalInclude,
    });

    if (!proposal || !isProposalParticipant(proposal, req.user!.id)) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (!activeProposalStatuses.includes(proposal.status as (typeof activeProposalStatuses)[number])) {
      return res.status(400).json({ success: false, message: 'Only active proposals can be updated' });
    }

    if (status === 'CANCELLED') {
      if (proposal.creatorId !== req.user!.id) {
        return res.status(403).json({ success: false, message: 'Only the proposal creator can cancel it' });
      }

      const cancelledProposal = await prisma.proposal.update({
        where: { id: proposalId },
        data: { status: 'CANCELLED' },
        include: proposalInclude,
      });

      await createNotification(prisma, {
        userId: proposal.recipientId,
        type: 'PROPOSAL_CANCELLED',
        title: 'Proposal cancelled',
        message: `${getProposalUserName(proposal.creator)} cancelled the proposal for ${getProposalSourceLabel(proposal)}.`,
        actionUrl: '/proposals',
      });

      emitProposalRefresh([cancelledProposal.creatorId, cancelledProposal.recipientId], {
        reason: 'cancelled',
        proposalId: cancelledProposal.id,
        actorId: req.user!.id,
      });

      return res.json({ success: true, proposal: cancelledProposal });
    }

    if (!isAwaitingUserResponse(proposal, req.user!.id)) {
      return res.status(400).json({ success: false, message: 'You cannot respond to your own latest proposal terms' });
    }

    if (status === 'REJECTED') {
      const rejectedProposal = await prisma.proposal.update({
        where: { id: proposalId },
        data: { status: 'REJECTED' },
        include: proposalInclude,
      });

      await createNotification(prisma, {
        userId: proposal.creatorId === req.user!.id ? proposal.recipientId : proposal.creatorId,
        type: 'PROPOSAL_REJECTED',
        title: 'Proposal declined',
        message: `${getProposalUserName(
          proposal.creatorId === req.user!.id ? proposal.creator : proposal.recipient,
        )} declined the proposal for ${getProposalSourceLabel(proposal)}.`,
        actionUrl: '/proposals',
      });

      emitProposalRefresh([rejectedProposal.creatorId, rejectedProposal.recipientId], {
        reason: 'rejected',
        proposalId: rejectedProposal.id,
        actorId: req.user!.id,
      });

      return res.json({ success: true, proposal: rejectedProposal });
    }

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      await cancelSiblingActiveProposals(tx, proposal);

      if (proposal.type === 'JOB') {
        if (!proposal.application) {
          throw new Error('The source application for this proposal is missing');
        }

        await createJobAgreementFromProposal(tx, proposal as JobProposalWithRelations, req.user!.id);
        await createNotification(tx, {
          userId: proposal.creatorId === req.user!.id ? proposal.recipientId : proposal.creatorId,
          type: 'PROPOSAL_ACCEPTED',
          title: 'Proposal accepted',
          message: `${getProposalUserName(
            proposal.creatorId === req.user!.id ? proposal.creator : proposal.recipient,
          )} accepted the proposal for ${getProposalSourceLabel(proposal)}.`,
          actionUrl: '/agreements',
        });
        return;
      }

      if (!proposal.serviceRequest) {
        throw new Error('The source service request for this proposal is missing');
      }

      await createServiceAgreementFromProposal(tx, proposal as ServiceProposalWithRelations, req.user!.id);

      await createNotification(tx, {
        userId: proposal.creatorId === req.user!.id ? proposal.recipientId : proposal.creatorId,
        type: 'PROPOSAL_ACCEPTED',
        title: 'Proposal accepted',
        message: `${getProposalUserName(
          proposal.creatorId === req.user!.id ? proposal.creator : proposal.recipient,
        )} accepted the proposal for ${getProposalSourceLabel(proposal)}.`,
        actionUrl: '/agreements',
      });
    });

    const acceptedProposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: proposalInclude,
    });

    if (acceptedProposal) {
      emitProposalRefresh([acceptedProposal.creatorId, acceptedProposal.recipientId], {
        reason: 'accepted',
        proposalId: acceptedProposal.id,
        actorId: req.user!.id,
      });

      const agreementId =
        acceptedProposal.application?.agreement?.id ||
        acceptedProposal.serviceRequest?.agreement?.id;

      emitAgreementRefresh([acceptedProposal.creatorId, acceptedProposal.recipientId], {
        reason: 'proposal_accepted',
        proposalId: acceptedProposal.id,
        agreementId,
        actorId: req.user!.id,
      });
    }

    return res.json({ success: true, proposal: acceptedProposal });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
