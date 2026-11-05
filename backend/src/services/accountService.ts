import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import logger from '../config/logger';
import prisma from '../config/prisma';

/**
 * Everything about letting a person see, take away, or erase their own data
 * (Data Protection Act, 2012 - Act 843: rights of access, correction and deletion).
 */

const LIMIT = 5000;
const OPEN_JOB_STATUSES = ['ACTIVE', 'PAUSED', 'DRAFT'];

// ── Download my data ──────────────────────────────────────────────────

/**
 * A copy of the personal data we hold about this member, as a plain object ready to save as JSON.
 * It covers what the member put in or did. It leaves out other people's data (for example the
 * details of people who applied to this employer's jobs), and secrets (password hash, tokens,
 * internal admin notes). Bank account numbers are shortened to the last four digits.
 */
export const buildUserDataExport = async (userId: string, now: Date = new Date()) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      emailVerified: true,
      phoneVerifiedAt: true,
      identityVerified: true,
      preferredCurrency: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const partyOf = (field: string) => ({ [field]: userId });

  const [
    jobSeekerProfile,
    employerProfile,
    freelancerProfile,
    applications,
    savedSearches,
    savedJobs,
    cvFiles,
    cvRequests,
    notifications,
    jobsPosted,
    verificationRequests,
    messages,
    reportsMade,
    proposals,
    agreements,
    payments,
    reviews,
    payoutAccount,
    freelanceServices,
    serviceRequests,
    waitlistSignups,
  ] = await Promise.all([
    prisma.jobSeekerProfile.findUnique({ where: { userId } }),
    prisma.employerProfile.findUnique({ where: { userId } }),
    prisma.freelancerProfile.findUnique({ where: { userId }, include: { projects: true } }),
    prisma.application.findMany({
      where: { seekerId: userId },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        status: true,
        coverLetter: true,
        cvSource: true,
        cvFileName: true,
        createdAt: true,
        statusChangedAt: true,
        job: { select: { id: true, title: true, location: true, employer: { select: { employerProfile: { select: { companyName: true } } } } } },
      },
    }),
    prisma.savedSearch.findMany({
      where: { userId },
      select: { query: true, location: true, jobType: true, emailAlerts: true, createdAt: true },
    }),
    prisma.savedJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { createdAt: true, job: { select: { id: true, title: true, employer: { select: { employerProfile: { select: { companyName: true } } } } } } },
    }),
    prisma.seekerCv.findUnique({ where: { userId } }),
    prisma.cVGeneration.findMany({ where: { userId }, select: { prompt: true, createdAt: true }, take: LIMIT }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { type: true, title: true, message: true, read: true, createdAt: true },
    }),
    prisma.job.findMany({
      where: { employerId: userId },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        type: true,
        salary: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        category: true,
        status: true,
        closesAt: true,
        createdAt: true,
        _count: { select: { applications: true } },
      },
    }),
    prisma.verificationRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        type: true,
        status: true,
        details: true,
        documentUrl: true,
        registrationNumber: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        contactVerifiedAt: true,
        reviewNote: true,
        reviewedAt: true,
        createdAt: true,
      },
    }),
    prisma.message.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { conversationId: true, content: true, attachmentName: true, createdAt: true },
    }),
    prisma.report.findMany({
      where: { reporterId: userId },
      select: { jobId: true, serviceId: true, reportedUserId: true, reason: true, status: true, createdAt: true },
    }),
    prisma.proposal.findMany({
      where: { OR: [partyOf('creatorId'), partyOf('recipientId')] },
      take: LIMIT,
      select: { id: true, title: true, summary: true, amount: true, timeline: true, createdAt: true, creatorId: true, recipientId: true },
    }),
    prisma.agreement.findMany({
      where: { OR: [partyOf('employerId'), partyOf('seekerId'), partyOf('freelancerId'), partyOf('clientId')] },
      take: LIMIT,
      select: { id: true, type: true, title: true, summary: true, amount: true, currency: true, status: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: { OR: [partyOf('payerId'), partyOf('payeeId')] },
      take: LIMIT,
      select: { id: true, agreementId: true, amount: true, currency: true, status: true, payoutStatus: true, createdAt: true, completedAt: true },
    }),
    prisma.review.findMany({
      where: { OR: [partyOf('reviewerId'), partyOf('revieweeId')] },
      select: { agreementId: true, rating: true, comment: true, reviewerId: true, revieweeId: true, createdAt: true },
    }),
    prisma.payoutAccount.findUnique({ where: { userId }, select: { bankName: true, accountName: true, accountNumber: true, currency: true } }),
    prisma.freelanceService.findMany({ where: { freelancerId: userId }, take: LIMIT }),
    prisma.serviceRequest.findMany({
      where: { clientId: userId },
      take: LIMIT,
      select: { id: true, serviceId: true, message: true, budget: true, timeline: true, createdAt: true },
    }),
    // Waitlist sign-ups are not linked to an account, so find them by the contact details we have.
    prisma.interestSignup.findMany({
      where: { OR: [...(user.email ? [{ email: user.email.toLowerCase() }] : []), ...(user.phone ? [{ phone: user.phone }] : [])] },
      select: { source: true, createdAt: true },
    }),
  ]);

  return {
    about: {
      generatedAt: now.toISOString(),
      format: 'JSON',
      note:
        'This file is a copy of the personal data JobWahala holds about you. It does not include other people\'s data (for example the ' +
        'applicants to your jobs), your password, or internal security records. Bank account numbers are shortened to the last four digits.',
    },
    account: user,
    profile: { jobSeeker: jobSeekerProfile, employer: employerProfile, freelancer: freelancerProfile },
    applications: applications.map((application) => ({
      id: application.id,
      jobTitle: application.job.title,
      jobLocation: application.job.location,
      company: application.job.employer.employerProfile?.companyName ?? null,
      status: application.status,
      coverLetter: application.coverLetter,
      cvSent: application.cvSource ? { source: application.cvSource, fileName: application.cvFileName } : null,
      appliedAt: application.createdAt,
      statusLastChangedAt: application.statusChangedAt,
    })),
    savedSearches,
    savedJobs: savedJobs.map((saved) => ({
      jobId: saved.job.id,
      jobTitle: saved.job.title,
      company: saved.job.employer.employerProfile?.companyName ?? null,
      savedAt: saved.createdAt,
    })),
    // The CV files themselves are not in this file (they are documents); this lists what is kept.
    cvFiles: cvFiles
      ? {
          uploaded: cvFiles.uploadedFileName ? { fileName: cvFiles.uploadedFileName, uploadedAt: cvFiles.uploadedAt } : null,
          builder: cvFiles.builderFileName ? { fileName: cvFiles.builderFileName, savedAt: cvFiles.builderSavedAt } : null,
        }
      : null,
    cvRequests,
    notifications,
    jobsPosted: jobsPosted.map(({ _count, ...job }) => ({ ...job, applicants: _count.applications })),
    verificationRequests,
    messagesSent: messages,
    reportsMade,
    proposals,
    agreements,
    payments,
    reviews,
    payoutAccount: payoutAccount
      ? { ...payoutAccount, accountNumber: `****${payoutAccount.accountNumber.slice(-4)}` }
      : null,
    freelanceServices,
    serviceRequests,
    waitlistSignups,
  };
};

// ── Delete my account ─────────────────────────────────────────────────

export type DeletionPreview = {
  role: string;
  /** Email accounts confirm with their password; phone-only accounts with a text code. */
  confirmWith: 'PASSWORD' | 'SMS_CODE';
  hasPhone: boolean;
  applicationsMade: number;
  /** For employers: open jobs that will be closed, and the people waiting on them. */
  openJobs: number;
  applicantsOnOpenJobs: number;
  /** Things that must be finished before the account can go. Empty means it can be deleted now. */
  blockers: string[];
};

export const getDeletionPreview = async (userId: string): Promise<DeletionPreview | null> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true, phone: true } });
  if (!user) return null;

  const [applicationsMade, openJobs, applicantsOnOpenJobs, activeAgreements, pendingPayouts, openDisputes] = await Promise.all([
    prisma.application.count({ where: { seekerId: userId } }),
    prisma.job.count({ where: { employerId: userId, status: { in: OPEN_JOB_STATUSES } } }),
    prisma.application.count({ where: { job: { employerId: userId, status: { in: OPEN_JOB_STATUSES } } } }),
    prisma.agreement.count({
      where: { status: 'ACTIVE', OR: [{ employerId: userId }, { seekerId: userId }, { freelancerId: userId }, { clientId: userId }] },
    }),
    prisma.payment.count({ where: { payeeId: userId, status: 'SUCCEEDED', payoutStatus: { in: ['PENDING', 'PROCESSING'] } } }),
    prisma.agreementDispute.count({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW'] }, OR: [{ creatorId: userId }, { counterpartyId: userId }] },
    }),
  ]);

  const blockers: string[] = [];
  if (user.role === 'ADMIN') blockers.push('Administrator accounts cannot be deleted from here. Ask another administrator.');
  if (activeAgreements > 0) blockers.push('You have active work agreements. Finish or cancel them first.');
  if (pendingPayouts > 0) blockers.push('You have a payout that has not been paid out yet. Wait for it to arrive first.');
  if (openDisputes > 0) blockers.push('You have a dispute that is still open. Wait for it to be resolved first.');

  return {
    role: user.role,
    confirmWith: user.email ? 'PASSWORD' : 'SMS_CODE',
    hasPhone: Boolean(user.phone),
    applicationsMade,
    openJobs,
    applicantsOnOpenJobs,
    blockers,
  };
};

export type DeleteResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' }
  | { ok: false; reason: 'BLOCKED'; blockers: string[] }
  | { ok: false; reason: 'ACKNOWLEDGE_COMPANY'; openJobs: number; applicantsOnOpenJobs: number };

/**
 * Erases a member's personal data.
 *
 * The account row itself is kept, emptied (no email, phone, name, or usable password, status DELETED),
 * because other people's records point at it: an employer's applicants, a conversation, an agreement
 * or payment that must be kept for the books. Those records then show a nameless former member.
 * Everything that is the member's own personal content is deleted.
 *
 * An employer owns their company, and there are no teams yet, so nobody can inherit it: their open jobs
 * are closed and the company page is emptied and hidden. They must confirm that first.
 */
export const deleteAccount = async (
  userId: string,
  options: { acknowledgeCompany?: boolean } = {},
): Promise<DeleteResult> => {
  const preview = await getDeletionPreview(userId);
  if (!preview) return { ok: false, reason: 'NOT_FOUND' };
  if (preview.blockers.length > 0) return { ok: false, reason: 'BLOCKED', blockers: preview.blockers };

  const ownsCompany = preview.role === 'EMPLOYER';
  if (ownsCompany && (preview.openJobs > 0 || preview.applicantsOnOpenJobs > 0) && !options.acknowledgeCompany) {
    return {
      ok: false,
      reason: 'ACKNOWLEDGE_COMPANY',
      openJobs: preview.openJobs,
      applicantsOnOpenJobs: preview.applicantsOnOpenJobs,
    };
  }

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } });
  // The member can never log in with this again; nobody knows it.
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  await prisma.$transaction(async (tx) => {
    // Alerts stop, and so does everything addressed to the member.
    await tx.savedSearch.deleteMany({ where: { userId } });
    await tx.savedJob.deleteMany({ where: { userId } });
    await tx.seekerCv.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.emailVerificationToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });

    // Their own personal content.
    await tx.jobSeekerProfile.deleteMany({ where: { userId } });
    await tx.freelancerProfile.deleteMany({ where: { userId } });
    await tx.cVGeneration.deleteMany({ where: { userId } });
    await tx.payoutAccount.deleteMany({ where: { userId } });
    await tx.verificationRequest.deleteMany({ where: { userId } });
    await tx.freelanceService.updateMany({ where: { freelancerId: userId, status: 'ACTIVE' }, data: { status: 'CLOSED' } });

    // Applications: withdrawn, unless a work agreement hangs off one, in which case only the personal text goes.
    await tx.application.deleteMany({ where: { seekerId: userId, agreement: { is: null } } });
    await tx.application.updateMany({ where: { seekerId: userId }, data: { coverLetter: null, cvSource: null, cvFileUrl: null, cvFileName: null } });

    // Messages stay in the other person's conversation, but what the member wrote and attached is removed.
    await tx.message.updateMany({
      where: { senderId: userId },
      data: { content: null, attachmentUrl: null, attachmentName: null, attachmentContentType: null, attachmentSizeBytes: null },
    });

    // The company: its open jobs close and its page is emptied. (Account status below hides it from the public.)
    if (ownsCompany) {
      await tx.job.updateMany({ where: { employerId: userId, status: { in: OPEN_JOB_STATUSES } }, data: { status: 'CLOSED' } });
      await tx.employerProfile.updateMany({
        where: { userId },
        data: { companyName: 'Former employer', industry: null, logoUrl: null, website: null, description: null, avgResponseHours: null, responseCount: 0 },
      });
    }

    // One-time codes and waitlist entries tied to their contact details.
    await tx.phoneOtp.deleteMany({ where: { OR: [{ subjectId: userId }, ...(current?.phone ? [{ phone: current.phone }] : [])] } });
    await tx.interestSignup.deleteMany({
      where: { OR: [...(current?.email ? [{ email: current.email.toLowerCase() }] : []), ...(current?.phone ? [{ phone: current.phone }] : [])] },
    });

    // The account itself: emptied, closed, and every signed-in session ended.
    await tx.user.update({
      where: { id: userId },
      data: {
        email: null,
        phone: null,
        phoneVerifiedAt: null,
        password: unusablePassword,
        status: 'DELETED',
        emailVerified: false,
        identityVerified: false,
        tokenVersion: { increment: 1 },
      },
    });
  });

  // No personal data in the log: the id alone.
  logger.info('account_deleted', { userId });
  return { ok: true };
};
