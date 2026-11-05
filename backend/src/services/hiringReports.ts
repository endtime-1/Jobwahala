import prisma from '../config/prisma';

/** Hiring reports for plans that include them: jobs posted, views, applications, time to first response and hires, by job and by month. */

export type ReportJob = { id: string; title: string; status: string; createdAt: Date };
export type ReportApplication = { jobId: string; createdAt: Date; firstRespondedAt: Date | null; status: string; statusChangedAt: Date | null };
export type ReportView = { jobId: string; createdAt: Date };

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const HOUR = 3_600_000;

/** Average hours from applying to the first answer, over the applications that have had one. null when none has. */
const averageResponseHours = (applications: ReportApplication[]) => {
  const hours = applications.filter((application) => application.firstRespondedAt).map((application) => Math.max(0, (application.firstRespondedAt!.getTime() - application.createdAt.getTime()) / HOUR));
  return hours.length ? Math.round((hours.reduce((sum, value) => sum + value, 0) / hours.length) * 10) / 10 : null;
};

export const buildHiringReport = (input: { jobs: ReportJob[]; applications: ReportApplication[]; views: ReportView[]; months: number; now?: Date }) => {
  const now = input.now ?? new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (input.months - 1), 1));
  const inWindow = (date: Date) => date.getTime() >= from.getTime();

  const jobIds = new Set(input.jobs.map((job) => job.id));
  const applications = input.applications.filter((application) => jobIds.has(application.jobId) && inWindow(application.createdAt));
  const views = input.views.filter((view) => jobIds.has(view.jobId) && inWindow(view.createdAt));

  const byJob = input.jobs
    .map((job) => {
      const mine = applications.filter((application) => application.jobId === job.id);
      return {
        id: job.id,
        title: job.title,
        status: job.status,
        postedAt: job.createdAt,
        views: views.filter((view) => view.jobId === job.id).length,
        applications: mine.length,
        hires: mine.filter((application) => application.status === 'HIRED').length,
        avgFirstResponseHours: averageResponseHours(mine),
      };
    })
    .sort((a, b) => b.applications - a.applications || b.views - a.views || new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

  const byMonth = Array.from({ length: input.months }, (_, index) => {
    const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + index, 1));
    const key = monthKey(start);
    const apps = applications.filter((application) => monthKey(application.createdAt) === key);
    return {
      month: key,
      jobsPosted: input.jobs.filter((job) => monthKey(job.createdAt) === key).length,
      views: views.filter((view) => monthKey(view.createdAt) === key).length,
      applications: apps.length,
      // Hires are counted in the month the person was hired, not the month they applied.
      hires: applications.filter((application) => application.status === 'HIRED' && application.statusChangedAt && monthKey(application.statusChangedAt) === key).length,
      avgFirstResponseHours: averageResponseHours(apps),
    };
  });

  return {
    totals: {
      jobsPosted: input.jobs.filter((job) => inWindow(job.createdAt)).length,
      views: views.length,
      applications: applications.length,
      hires: applications.filter((application) => application.status === 'HIRED').length,
      avgFirstResponseHours: averageResponseHours(applications),
    },
    byJob,
    byMonth,
  };
};

export const loadHiringReport = async (ownerId: string, months: number, now = new Date()) => {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const [jobs, applications, views] = await Promise.all([
    prisma.job.findMany({ where: { employerId: ownerId }, select: { id: true, title: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.application.findMany({ where: { job: { employerId: ownerId }, createdAt: { gte: from } }, select: { jobId: true, createdAt: true, firstRespondedAt: true, status: true, statusChangedAt: true }, take: 20000 }),
    prisma.jobView.findMany({ where: { job: { employerId: ownerId }, createdAt: { gte: from } }, select: { jobId: true, createdAt: true }, take: 50000 }),
  ]);
  return buildHiringReport({ jobs, applications, views, months, now });
};
