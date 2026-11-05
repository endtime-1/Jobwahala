import logger from '../config/logger';
import prisma from '../config/prisma';
import { getErrorMessage } from '../utils/errors';
import { NEW_REMINDER_DAYS, reminderCutoff } from '../utils/applicationStatus';
import { sendApplicationReminderEmail } from './emailService';

/**
 * Reminds employers about applications that have sat in New for 14 days.
 * One email per employer covers all their waiting applicants, and each application is only
 * ever counted once (newReminderSentAt), so the daily run never nags.
 */
export const runApplicationReminders = async (now: Date = new Date()) => {
  const stale = await prisma.application.findMany({
    where: { status: 'SUBMITTED', createdAt: { lte: reminderCutoff(now) }, newReminderSentAt: null },
    select: {
      id: true,
      job: { select: { id: true, title: true, employerId: true, employer: { select: { email: true, status: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: 2000,
  });

  type Group = { email: string; ids: string[]; jobs: Map<string, { title: string; waiting: number }> };
  const byEmployer = new Map<string, Group>();
  for (const application of stale) {
    const { job } = application;
    if (job.employer.status !== 'ACTIVE' || !job.employer.email) continue;

    const group: Group = byEmployer.get(job.employerId) ?? { email: job.employer.email, ids: [], jobs: new Map() };
    group.ids.push(application.id);
    const entry = group.jobs.get(job.id) ?? { title: job.title, waiting: 0 };
    entry.waiting += 1;
    group.jobs.set(job.id, entry);
    byEmployer.set(job.employerId, group);
  }

  let employers = 0;
  let applications = 0;

  for (const group of byEmployer.values()) {
    // Claim first so two overlapping runs cannot both send.
    const claim = await prisma.application.updateMany({
      where: { id: { in: group.ids }, newReminderSentAt: null },
      data: { newReminderSentAt: now },
    });
    if (claim.count === 0) continue;

    try {
      await sendApplicationReminderEmail(group.email, {
        waiting: claim.count,
        days: NEW_REMINDER_DAYS,
        jobs: [...group.jobs.values()].sort((a, b) => b.waiting - a.waiting).slice(0, 5),
      });
      employers += 1;
      applications += claim.count;
    } catch (error) {
      // Let tomorrow's run try again.
      await prisma.application
        .updateMany({ where: { id: { in: group.ids } }, data: { newReminderSentAt: null } })
        .catch(() => undefined);
      logger.error('application_reminder_email_failed', { error: getErrorMessage(error) });
    }
  }

  return { employers, applications };
};

export const runApplicationRemindersSafely = async () => {
  try {
    const result = await runApplicationReminders();
    if (result.employers) logger.info('application_reminders_sent', result);
  } catch (error) {
    logger.error('application_reminders_failed', { error: getErrorMessage(error) });
  }
};
