export const getRequiredVerificationType = (role?: string | null) => {
  if (role === 'SEEKER') return 'IDENTITY';
  if (role === 'EMPLOYER') return 'BUSINESS';
  if (role === 'FREELANCER') return 'PROFESSIONAL';
  return null;
};

type VerificationRecord = {
  id: string;
  type: string;
  status: string;
  details: string;
  documentUrl?: string | null;
  reviewNote?: string | null;
  internalNote?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const toPublicVerificationRecord = (request: VerificationRecord) => {
  const { internalNote: _internalNote, ...publicRequest } = request;
  return publicRequest;
};

export const serializeVerificationStatus = (
  request?: VerificationRecord | null,
  history: VerificationRecord[] = [],
) => ({
  verificationStatus: request?.status || 'UNVERIFIED',
  verificationType: request?.type || null,
  isVerified: request?.status === 'APPROVED',
  latestVerificationRequest: request ? toPublicVerificationRecord(request) : null,
  verificationHistory: history.map(toPublicVerificationRecord),
});

/**
 * The one rule for "Verified employer": a company counts as verified ONLY if it has an APPROVED
 * BUSINESS verification request. Pending, rejected, needs-info or no request means not verified,
 * and a newer request never takes the badge away from a company that already has an approved one.
 */
export const approvedBusinessVerificationQuery = {
  where: { status: 'APPROVED', type: 'BUSINESS' },
  take: 1,
  select: { id: true, status: true, type: true },
} as const;

type VerificationLike = { status: string; type: string };

export const isVerifiedEmployer = (requests?: VerificationLike[] | null) =>
  Boolean(requests?.some((request) => request.status === 'APPROVED' && request.type === 'BUSINESS'));

/** What public job and company responses may say about an employer: nothing but the yes/no. */
export const publicEmployerVerification = (requests?: VerificationLike[] | null) => {
  const isVerified = isVerifiedEmployer(requests);
  return { isVerified, verificationStatus: isVerified ? 'APPROVED' : 'UNVERIFIED' };
};
