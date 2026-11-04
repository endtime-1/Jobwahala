import prisma from '../config/prisma';
import logger from '../config/logger';
import { createNotification } from '../utils/notifications';
import { describeCriteria, searchMatchesJob } from '../utils/jobAlerts';
import { getErrorMessage } from '../utils/errors';
import { sendJobAlertEmail } from './emailService';

export const DAILY_ALERT_CAP = 10;

type NewJob = {
  id: string;
  employerId: string;
  title: string;
  description: string;
  location?: string | null;
  type?: string | null;
  category?: string | null;
};

/**
 * Tells seekers whose saved searches match a newly posted job: always an in-app notification,
 * plus an email when they have email alerts on. Runs in the background; it never throws.
 */
export const notifyJobAlerts = async (job: NewJob) => {
  try {
    const searches = await prisma.savedSearch.findMany({
      take: 5000,
      include: { user: { select: { id: true, email: true, role: true, status: true, emailVerified: true } } },
    });

    const matchesByUser = new Map<string, typeof searches>();
    for (const search of searches) {
      const { user } = search;
      if (user.role !== 'SEEKER' || user.status !== 'ACTIVE' || user.id === job.employerId) continue;
      if (!searchMatchesJob(search, job)) continue;
      matchesByUser.set(user.id, [...(matchesByUser.get(user.id) || []), search]);
    }

    if (matchesByUser.size === 0) return { notified: 0 };

    const employerProfile = await prisma.employerProfile.findUnique({
      where: { userId: job.employerId },
      select: { companyName: true },
    });
    const company = employerProfile?.companyName || 'An employer';
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let notified = 0;

    for (const [userId, matches] of matchesByUser) {
      const alertsToday = await prisma.notification.count({
        where: { userId, type: 'JOB_ALERT', createdAt: { gte: since } },
      });
      if (alertsToday >= DAILY_ALERT_CAP) continue;

      const first = matches[0];
      const alertName = describeCriteria(first);

      await createNotification(prisma, {
        userId,
        type: 'JOB_ALERT',
        title: `New job for "${alertName}"`,
        message: `${job.title} at ${company}${job.location ? ` · ${job.location}` : ''}`,
        actionUrl: `/jobs/${job.id}`,
      });
      notified += 1;

      await prisma.savedSearch.updateMany({
        where: { id: { in: matches.map((match) => match.id) } },
        data: { lastAlertedAt: new Date() },
      });

      if (first.user.emailVerified && matches.some((match) => match.emailAlerts)) {
        sendJobAlertEmail(first.user.email, {
          alertName,
          jobTitle: job.title,
          company,
          location: job.location,
          jobId: job.id,
        }).catch((error) => logger.error('job_alert_email_failed', { error: getErrorMessage(error) }));
      }
    }

    return { notified };
  } catch (error) {
    logger.error('job_alert_error', { error: getErrorMessage(error) });
    return { notified: 0 };
  }
};
