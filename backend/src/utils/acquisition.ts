import crypto from 'crypto';

/**
 * Employer-acquisition helpers that need no database: claim links, referral codes, the weekly report maths and the WhatsApp texts.
 * Pure functions, so they are easy to test.
 */

export const DAY_MS = 86_400_000;
export const CLAIM_LINK_DAYS = 14;

// ------------------------------------------------------------------ claim links

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
/** A long random token. Only its hash is stored, so a copy of the database cannot be used to take over a company. */
export const newToken = () => crypto.randomBytes(32).toString('hex');
export const claimUrl = (baseUrl: string, token: string) => `${baseUrl.replace(/\/$/, '')}/claim/${token}`;
export const claimExpiry = (now = new Date()) => new Date(now.getTime() + CLAIM_LINK_DAYS * DAY_MS);

/** A claim link can be used while it is ACTIVE and not past its date. */
export const claimState = (claim: { status: string; expiresAt: Date }, now = new Date()): 'ACTIVE' | 'CLAIMED' | 'REVOKED' | 'EXPIRED' => {
  if (claim.status === 'CLAIMED') return 'CLAIMED';
  if (claim.status === 'REVOKED') return 'REVOKED';
  return claim.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : 'ACTIVE';
};

/** The words the admin sends with the claim link. */
export const claimMessage = (company: string, url: string) =>
  `Hello! We have put ${company} on JobWahala, the job site for Africa, so people can find and apply to your vacancies. ` +
  `Use this private link to take over the page, see your applicants and post more jobs for free: ${url} (the link is for you only and works for ${CLAIM_LINK_DAYS} days).`;

/** Opens WhatsApp (to that number when there is one) with the text ready to send. */
export const whatsappLink = (text: string, phone?: string | null) => {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

// ------------------------------------------------------------------ referral

// No 0/O/1/I, so a code read out loud or typed from a flyer is not misread.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newReferralCode = () => `JW-${Array.from(crypto.randomBytes(6), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')}`;
export const isReferralCode = (value: unknown): value is string => typeof value === 'string' && /^JW-[A-Z2-9]{6}$/.test(value.trim().toUpperCase());
export const normalizeReferralCode = (value: string) => value.trim().toUpperCase();
export const referralUrl = (baseUrl: string, code: string) => `${baseUrl.replace(/\/$/, '')}/signup?role=employer&ref=${code}`;

export const referralShareText = (company: string, url: string) =>
  `I post my jobs on JobWahala and it works well. Post yours free, with employers you can check and applicants in one place: ${url} (from ${company})`;

// ------------------------------------------------------------------ the weekly report

const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/** The last full Monday-to-Sunday week (UTC) before `now`. Run on a Monday, it is the week that just ended. */
export const lastWeek = (now = new Date()) => {
  const today = startOfUtcDay(now);
  const sinceMonday = (today.getUTCDay() + 6) % 7; // Monday = 0
  const thisMonday = new Date(today.getTime() - sinceMonday * DAY_MS);
  const start = new Date(thisMonday.getTime() - 7 * DAY_MS);
  return { start, end: thisMonday };
};

export type ReportJobRow = { id: string; title: string };
export type ReportApplicationRow = { jobId: string; createdAt: Date; status: string };
export type ReportViewRow = { jobId: string; createdAt: Date };

export type WeeklyJobLine = { jobId: string; title: string; views: number; newApplicants: number; totalApplicants: number; awaitingReview: number };
export type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  jobs: WeeklyJobLine[];
  totals: { views: number; newApplicants: number; totalApplicants: number; awaitingReview: number; activeJobs: number };
};

/**
 * Views, new applicants (they applied this week), all applicants and the ones still waiting for an answer, for each active job.
 * Views and new applicants are for the week; the other two are as of now.
 */
export const buildWeeklyReport = (input: { jobs: ReportJobRow[]; applications: ReportApplicationRow[]; views: ReportViewRow[]; start: Date; end: Date }): WeeklyReport => {
  const inWeek = (date: Date) => date.getTime() >= input.start.getTime() && date.getTime() < input.end.getTime();
  const jobs = input.jobs.map((job) => {
    const mine = input.applications.filter((application) => application.jobId === job.id);
    return {
      jobId: job.id,
      title: job.title,
      views: input.views.filter((view) => view.jobId === job.id && inWeek(view.createdAt)).length,
      newApplicants: mine.filter((application) => inWeek(application.createdAt)).length,
      totalApplicants: mine.length,
      awaitingReview: mine.filter((application) => application.status === 'SUBMITTED').length,
    };
  });
  const sum = (pick: (line: WeeklyJobLine) => number) => jobs.reduce((total, line) => total + pick(line), 0);
  return {
    weekStart: input.start.toISOString(),
    weekEnd: input.end.toISOString(),
    jobs,
    totals: { views: sum((line) => line.views), newApplicants: sum((line) => line.newApplicants), totalApplicants: sum((line) => line.totalApplicants), awaitingReview: sum((line) => line.awaitingReview), activeJobs: jobs.length },
  };
};

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The week as a short title, for example "5 Oct to 11 Oct". The end is the last day of the week, not the Monday after. */
export const weekLabel = (report: Pick<WeeklyReport, 'weekStart' | 'weekEnd'>) =>
  `${dayLabel(report.weekStart)} to ${dayLabel(new Date(new Date(report.weekEnd).getTime() - DAY_MS).toISOString())}`;

/** True when there is nothing worth emailing: no active jobs. A quiet week with open jobs is still reported (that is useful too). */
export const isEmptyReport = (report: WeeklyReport) => report.jobs.length === 0;

/** The summary an employer can forward on WhatsApp. */
export const reportShareText = (company: string, report: WeeklyReport, siteUrl: string) => {
  const lines = report.jobs.slice(0, 5).map((job) => `- ${job.title}: ${plural(job.views, 'view')}, ${plural(job.newApplicants, 'new applicant')}`);
  return [
    `${company} on JobWahala, ${weekLabel(report)}:`,
    `${plural(report.totals.views, 'person', 'people')} looked at our jobs and ${plural(report.totals.newApplicants, 'new person', 'new people')} applied.`,
    ...lines,
    `See and apply: ${siteUrl.replace(/\/$/, '')}`,
  ].join('\n');
};
