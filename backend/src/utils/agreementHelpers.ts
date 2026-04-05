import { Response } from 'express';

export const agreementUserSelect = {
  id: true,
  email: true,
  role: true,
  employerProfile: true,
  jobSeekerProfile: true,
  freelancerProfile: true,
} as const;

export const isAgreementParticipant = (
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

export const getAgreementParticipantIds = (agreement: {
  employerId?: string | null;
  seekerId?: string | null;
  freelancerId?: string | null;
  clientId?: string | null;
}) =>
  [...new Set([agreement.employerId, agreement.seekerId, agreement.freelancerId, agreement.clientId].filter(Boolean))] as string[];

export const getAgreementCounterpartyId = (
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

export const getAgreementUserName = (user?: {
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
    .join(' ');

  return fullName || user.employerProfile?.companyName || user.email || 'User';
};

export const activeAgreementDisputeStatuses = ['OPEN', 'UNDER_REVIEW'];

export const hasActiveAgreementDispute = (disputes: Array<{ status: string }>) =>
  disputes.some((dispute) => activeAgreementDisputeStatuses.includes(dispute.status));
