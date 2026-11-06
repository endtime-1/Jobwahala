import { Response } from 'express';
import env from '../config/env';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { paystackMode } from '../services/paystackBilling';
import { bucketByDay, evaluateHealth, healthSummary, startOfMonthUtc } from '../utils/adminOverview';
import { getErrorMessage } from '../utils/errors';
import { publicJobWhere } from '../utils/jobLifecycle';

const DAY_MS = 86_400_000;

/**
 * The admin landing page: how big the platform is, how it moved, what money came in, and what is waiting for a decision.
 * Counts only; no personal data.
 */
export const getAdminOverview = async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const since7 = new Date(now.getTime() - 7 * DAY_MS);
    const since14 = new Date(now.getTime() - 14 * DAY_MS);
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const monthStart = startOfMonthUtc(now);
    const lastMonthStart = startOfMonthUtc(now, 1);

    const [
      seekers,
      employers,
      freelancers,
      admins,
      newUsers7,
      newUsers30,
      activeJobs,
      newJobs7,
      applicationsTotal,
      applications7,
      verifiedEmployers,
      pendingVerifications,
      pendingReports,
      pendingCourses,
      pendingProviders,
      openDisputes,
      revenueThisMonth,
      revenueLastMonth,
      userDates,
      applicationDates,
      jobDates,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'SEEKER' } }),
      prisma.user.count({ where: { role: 'EMPLOYER' } }),
      prisma.user.count({ where: { role: 'FREELANCER' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { createdAt: { gte: since7 } } }),
      prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      prisma.job.count({ where: publicJobWhere(now) }),
      prisma.job.count({ where: { createdAt: { gte: since7 } } }),
      prisma.application.count(),
      prisma.application.count({ where: { createdAt: { gte: since7 } } }),
      prisma.user.count({ where: { role: 'EMPLOYER', verificationRequests: { some: { status: 'APPROVED', type: 'BUSINESS' } } } }),
      prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.course.count({ where: { reviewStatus: 'PENDING', status: { not: 'REMOVED' } } }),
      prisma.employerProfile.count({ where: { providerStatus: 'PENDING' } }),
      prisma.agreementDispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.billingPayment.aggregate({ where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] }, paidAt: { gte: monthStart } }, _sum: { totalPesewas: true, refundedPesewas: true }, _count: true }),
      prisma.billingPayment.aggregate({ where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] }, paidAt: { gte: lastMonthStart, lt: monthStart } }, _sum: { totalPesewas: true, refundedPesewas: true } }),
      prisma.user.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true }, take: 5000 }),
      prisma.application.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true }, take: 5000 }),
      prisma.job.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true }, take: 5000 }),
    ]);

    const net = (sum: { totalPesewas: number | null; refundedPesewas: number | null }) => (sum.totalPesewas ?? 0) - (sum.refundedPesewas ?? 0);

    return res.json({
      success: true,
      generatedAt: now.toISOString(),
      users: { total: seekers + employers + freelancers + admins, seekers, employers, freelancers, admins, new7: newUsers7, new30: newUsers30 },
      employers: { total: employers, verified: verifiedEmployers, unverified: Math.max(0, employers - verifiedEmployers) },
      jobs: { active: activeJobs, new7: newJobs7 },
      applications: { total: applicationsTotal, new7: applications7 },
      revenue: {
        thisMonthPesewas: net(revenueThisMonth._sum),
        lastMonthPesewas: net(revenueLastMonth._sum),
        paymentsThisMonth: revenueThisMonth._count,
        mode: paystackMode(),
      },
      // What is waiting for an admin decision, most important first.
      queues: {
        verifications: pendingVerifications,
        reports: pendingReports,
        courses: pendingCourses,
        providers: pendingProviders,
        disputes: openDisputes,
      },
      series: {
        signups: bucketByDay(userDates.map((row) => row.createdAt), now),
        applications: bucketByDay(applicationDates.map((row) => row.createdAt), now),
        jobs: bucketByDay(jobDates.map((row) => row.createdAt), now),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Is everything the site depends on set up and working? Reports each item as ok, warn, error or off. Never returns a secret. */
export const getSystemHealth = async (_req: AuthRequest, res: Response) => {
  try {
    let databaseOk = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseOk = false;
    }

    const items = evaluateHealth({
      databaseOk,
      brevoApiKey: Boolean(env.brevoApiKey),
      smtpUser: Boolean(env.smtpUser),
      smtpHost: env.smtpHost,
      storageProvider: env.evidenceStorageProvider,
      storageDir: env.evidenceStorageLocalDir,
      turnstileSecret: Boolean(env.turnstileSecretKey),
      paystackMode: paystackMode(),
      frontendBaseUrl: env.frontendBaseUrl,
      smsProvider: env.smsProvider,
      smsConfigured: env.smsProvider === 'ARKESEL' && Boolean(env.arkeselApiKey),
      googleConfigured: Boolean(env.googleClientId),
      sentryConfigured: Boolean(env.sentryDsn),
      freelanceEnabled: env.freelanceEnabled,
      isProduction: env.isProduction,
    });

    return res.json({ success: true, checkedAt: new Date().toISOString(), summary: healthSummary(items), items });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
