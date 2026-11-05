import { promotionOf } from './billing';
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

// ---- Business (employer) verification: what to ask for, what a decision needs, what to tell people ----

/** Registrar-General numbers differ in format, so keep this loose: letters, digits, dashes, slashes, spaces. */
export const normalizeRegistrationNumber = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();
export const isPlausibleRegistrationNumber = (value: string) => /^[A-Z0-9][A-Z0-9 \-/.]{2,39}$/.test(normalizeRegistrationNumber(value));

export const MIN_REASON_LENGTH = 5;

type DecisionTarget = {
  type: string;
  registrationNumber?: string | null;
  documentUrl?: string | null;
  address?: string | null;
  contactVerifiedAt?: Date | null;
};

/**
 * Why an admin decision cannot be recorded yet, or null if it can.
 * Rejecting or asking for more information always needs a reason the employer will read.
 * Approving a company needs the full set: number, certificate, address and a confirmed contact.
 */
export const verificationDecisionProblem = (
  verification: DecisionTarget,
  status: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO',
  reason?: string | null,
): string | null => {
  const trimmed = reason?.trim() ?? '';

  if ((status === 'REJECTED' || status === 'NEEDS_INFO') && trimmed.length < MIN_REASON_LENGTH) {
    return status === 'REJECTED'
      ? 'Give a reason for rejecting this request. The employer will see it.'
      : 'Say what more information is needed. The employer will see it.';
  }

  if (status === 'APPROVED' && verification.type === 'BUSINESS') {
    const missing: string[] = [];
    if (!verification.registrationNumber) missing.push('registration number');
    if (!verification.documentUrl) missing.push('registration certificate');
    if (!verification.address) missing.push('physical address');
    if (missing.length > 0) {
      return `This request is missing its ${missing.join(', ')}. Ask for more information instead of approving.`;
    }
    if (!verification.contactVerifiedAt) {
      return 'The company contact has not been confirmed with the one-time code yet, so it cannot be approved.';
    }
  }

  return null;
};

/** What the employer is told after each decision. The reason is always included for rejections and requests for more. */
export const describeVerificationDecision = (
  status: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO',
  type: string,
  reason?: string | null,
) => {
  const subject = type === 'BUSINESS' ? 'company' : type.toLowerCase();
  const why = reason?.trim();

  if (status === 'APPROVED') {
    return {
      title: type === 'BUSINESS' ? 'Your company is verified' : 'Verification approved',
      message:
        type === 'BUSINESS'
          ? 'Your company now shows the Verified employer badge, and your jobs rank above unverified ones.'
          : `Your ${subject} verification was approved.`,
    };
  }

  if (status === 'NEEDS_INFO') {
    return {
      title: 'We need a little more information',
      message: `To verify your ${subject} we need more information: ${why}. Update your request from your dashboard and we will look again.`,
    };
  }

  return {
    title: 'We could not verify your request',
    message: `We were not able to verify your ${subject} this time. Reason: ${why}. You can fix this and send a new request from your dashboard.`,
  };
};

/** Prisma filter for "employers with an approved business verification". */
export const verifiedEmployerFilter = {
  verificationRequests: { some: { status: 'APPROVED', type: 'BUSINESS' } },
} as const;

/**
 * Verified employers' jobs first, then newest first. The sort is stable, so jobs that tie
 * keep the order they arrived in.
 */
export const rankJobsByVerification = <
  T extends { createdAt: Date | string; employer: { isVerified?: boolean }; featuredUntil?: Date | string | null; boostedUntil?: Date | string | null },
>(
  jobs: T[],
  now = new Date(),
) =>
  [...jobs].sort((a, b) => {
    // Verified always comes first, whatever was paid.
    const byVerified = Number(Boolean(b.employer.isVerified)) - Number(Boolean(a.employer.isVerified));
    if (byVerified !== 0) return byVerified;
    // Within the same verification level, a featured or boosted job comes before one that is not.
    const byPromotion = Number(Boolean(promotionOf(b, now))) - Number(Boolean(promotionOf(a, now)));
    if (byPromotion !== 0) return byPromotion;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
