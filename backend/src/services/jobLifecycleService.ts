import env from '../config/env';
import logger from '../config/logger';
import prisma from '../config/prisma';
import { getErrorMessage } from '../utils/errors';
import { EXPIRY_WARNING_DAYS, addDays } from '../utils/jobLifecycle';
import { sendJobExpiryWarningEmail } from './emailService';

export const JOB_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * The daily job sweep. Safe to run any number of times (it is idempotent):
 *  1. ACTIVE or PAUSED jobs past their closing date become EXPIRED. Applicants are not touched.
 *  2. ACTIVE jobs closing within 3 days get one warning email to the employer, with a link to extend.
 * Drafts and closed jobs are left alone.
 */
export const runJobLifecycleSweep = async (now: Date = new Date()) => {
  const expired = await prisma.job.updateMany({
    where: { status: { in: ['ACTIVE', 'PAUSED'] }, closesAt: { lte: now } },
    data: { status: 'EXPIRED' },
  });

  const closingSoon = await prisma.job.findMany({
    where: {
      status: 'ACTIVE',
      closesAt: { gt: now, lte: addDays(now, EXPIRY_WARNING_DAYS) },
      expiryWarningSentAt: null,
    },
    select: {
      id: true,
      title: true,
      closesAt: true,
      employer: { select: { email: true, status: true, employerProfile: { select: { companyName: true } } } },
    },
    take: 500,
  });

  let warned = 0;
  for (const job of closingSoon) {
    if (job.employer.status !== 'ACTIVE') continue;

    // Claim the job first so two overlapping runs cannot both send the email.
    const claim = await prisma.job.updateMany({
      where: { id: job.id, expiryWarningSentAt: null },
      data: { expiryWarningSentAt: now },
    });
    if (claim.count !== 1) continue;

    try {
      await sendJobExpiryWarningEmail(job.employer.email, {
        title: job.title,
        closesAt: job.closesAt,
        company: job.employer.employerProfile?.companyName,
        extendUrl: `${env.frontendBaseUrl}/dashboard?extend=${job.id}`,
      });
      warned += 1;
    } catch (error) {
      // Let tomorrow's run try again.
      await prisma.job.update({ where: { id: job.id }, data: { expiryWarningSentAt: null } }).catch(() => undefined);
      logger.error('job_expiry_email_failed', { jobId: job.id, error: getErrorMessage(error) });
    }
  }

  return { expired: expired.count, warned };
};

export const runJobLifecycleSweepSafely = async () => {
  try {
    const result = await runJobLifecycleSweep();
    if (result.expired || result.warned) logger.info('job_lifecycle_sweep', result);
  } catch (error) {
    logger.error('job_lifecycle_sweep_failed', { error: getErrorMessage(error) });
  }
};
