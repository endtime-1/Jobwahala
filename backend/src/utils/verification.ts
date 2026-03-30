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
  const { internalNote, ...publicRequest } = request;
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
