import prisma from '../config/prisma';
import { createNotification } from '../utils/notifications';
import {
  MAX_PAGES,
  MAX_SAVED_SEARCHES,
  PAGE_SIZE,
  cleanFilters,
  dayKey,
  levelsFrom,
  monthStart,
  nextMonthStart,
  summarise,
  type CandidateFilters,
} from '../utils/cvDatabase';
import { publicJobWhere } from '../utils/jobLifecycle';
import { sendCandidateAlertEmail } from './emailService';
import { BillingError } from './billingErrors';
import { getEntitlements } from './planService';
import env from '../config/env';
import logger from '../config/logger';
import { getErrorMessage } from '../utils/errors';

const DAY_MS = 86_400_000;
const POOL = 2000;

/** Only a VERIFIED employer on a plan that includes the CV database may search. Both are checked here, on the server. */
export const requireCvAccess = async (ownerId: string, now = new Date()) => {
  const entitlements = await getEntitlements(ownerId, now);
  if (!entitlements.cvDatabase) throw new BillingError(403, 'PLAN_REQUIRED', 'The CV database is part of the Business plan.');
  const verified = await prisma.verificationRequest.findFirst({ where: { userId: ownerId, type: 'BUSINESS', status: 'APPROVED' }, select: { id: true } });
  if (!verified) throw new BillingError(403, 'VERIFICATION_REQUIRED', 'Only verified employers can search the CV database. Verify your business first.');
  return entitlements;
};

export const unlockAllowance = async (ownerId: string, limit: number, now = new Date()) => {
  const used = await prisma.cvUnlock.count({ where: { employerId: ownerId, createdAt: { gte: monthStart(now) } } });
  return { limit, used, remaining: Math.max(0, limit - used), resetsOn: nextMonthStart(now) };
};

type Row = {
  id: string;
  userId: string;
  headline: string | null;
  skills: string;
  experience: string | null;
  location: string | null;
  educationLevel: string | null;
  availability: string | null;
  yearsExperience: number | null;
  jobCategory: string | null;
  lastActiveAt: Date | null;
  cvVisibleSince: Date | null;
  profileBoostedUntil: Date | null;
  user: { learnerCourses: { id: string }[] };
};

/** The limited profile an employer sees before unlocking: nothing that says who the person is or how to reach them. */
export const limitedProfile = (row: Row, now: Date, unlocked: boolean) => ({
  id: row.id,
  headline: summarise(row.headline, 120) || (row.jobCategory ? `${row.jobCategory} job seeker` : 'Job seeker'),
  skills: summarise(row.skills, 200),
  experienceSummary: summarise(row.experience, 240),
  location: row.location,
  educationLevel: row.educationLevel,
  availability: row.availability,
  yearsExperience: row.yearsExperience,
  jobCategory: row.jobCategory,
  hasVerifiedCertificate: row.user.learnerCourses.length > 0,
  lastActiveAt: row.lastActiveAt,
  boosted: Boolean(row.profileBoostedUntil && row.profileBoostedUntil.getTime() > now.getTime()),
  unlocked,
});

const contains = (haystack: string | null | undefined, needle: string) => (haystack ?? '').toLowerCase().includes(needle.toLowerCase());

/**
 * Everyone who matches, boosted first and then the most recently active. Hidden profiles, inactive accounts and people who
 * blocked this company never appear. `since` keeps only people who became visible after that time (used for alerts).
 */
const findMatching = async (ownerId: string, filters: CandidateFilters, now: Date, since?: Date) => {
  const rows = (await prisma.jobSeekerProfile.findMany({
    where: {
      cvVisibility: 'VERIFIED_EMPLOYERS',
      user: { status: 'ACTIVE', role: 'SEEKER', cvBlocksMade: { none: { employerId: ownerId } } },
      ...(filters.minYears !== undefined ? { yearsExperience: { gte: filters.minYears } } : {}),
      ...(filters.education ? { educationLevel: { in: [...levelsFrom(filters.education)] } } : {}),
      ...(filters.availability ? { availability: filters.availability } : {}),
      ...(filters.activeWithinDays ? { lastActiveAt: { gte: new Date(now.getTime() - filters.activeWithinDays * DAY_MS) } } : {}),
      ...(since ? { cvVisibleSince: { gt: since } } : {}),
      ...(filters.certificate ? { user: { status: 'ACTIVE', role: 'SEEKER', cvBlocksMade: { none: { employerId: ownerId } }, learnerCourses: { some: { status: 'CONFIRMED', certificateUrl: { not: null } } } } } : {}),
    },
    select: {
      id: true,
      userId: true,
      headline: true,
      skills: true,
      experience: true,
      location: true,
      educationLevel: true,
      availability: true,
      yearsExperience: true,
      jobCategory: true,
      lastActiveAt: true,
      cvVisibleSince: true,
      profileBoostedUntil: true,
      user: { select: { learnerCourses: { where: { status: 'CONFIRMED', certificateUrl: { not: null } }, select: { id: true }, take: 1 } } },
    },
    orderBy: { lastActiveAt: 'desc' },
    take: POOL,
  })) as Row[];

  // Words are matched here so case never matters, on any database. Every skill asked for has to appear.
  const words = (filters.skills ?? '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  const matching = rows.filter((row) => {
    if (filters.location && !contains(row.location, filters.location)) return false;
    if (filters.category && !contains(row.jobCategory, filters.category)) return false;
    const haystack = [row.skills, row.headline, row.experience].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });

  const boosted = (row: Row) => Number(Boolean(row.profileBoostedUntil && row.profileBoostedUntil.getTime() > now.getTime()));
  return matching.sort((a, b) => boosted(b) - boosted(a));
};

export const searchCandidates = async (ownerId: string, filters: CandidateFilters, page: number, now = new Date()) => {
  const entitlements = await requireCvAccess(ownerId, now);
  const safePage = Math.min(MAX_PAGES, Math.max(1, page));
  const matching = await findMatching(ownerId, filters, now);
  const slice = matching.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const unlocks = slice.length ? await prisma.cvUnlock.findMany({ where: { employerId: ownerId, seekerId: { in: slice.map((row) => row.userId) } }, select: { seekerId: true } }) : [];
  const unlockedIds = new Set(unlocks.map((unlock) => unlock.seekerId));

  return {
    // Only the first MAX_PAGES pages are ever reachable, so a search cannot be used to copy the whole database.
    total: Math.min(matching.length, MAX_PAGES * PAGE_SIZE),
    matching: matching.length,
    page: safePage,
    pageSize: PAGE_SIZE,
    entries: slice.map((row) => limitedProfile(row, now, unlockedIds.has(row.userId))),
    allowance: await unlockAllowance(ownerId, entitlements.monthlyUnlocks, now),
  };
};

const loadCandidate = async (ownerId: string, profileId: string) => {
  const profile = await prisma.jobSeekerProfile.findFirst({
    where: { id: profileId, cvVisibility: 'VERIFIED_EMPLOYERS', user: { status: 'ACTIVE', role: 'SEEKER', cvBlocksMade: { none: { employerId: ownerId } } } },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      headline: true,
      skills: true,
      experience: true,
      location: true,
      educationLevel: true,
      availability: true,
      yearsExperience: true,
      jobCategory: true,
      lastActiveAt: true,
      cvVisibleSince: true,
      profileBoostedUntil: true,
      user: { select: { email: true, phone: true, learnerCourses: { where: { status: 'CONFIRMED', certificateUrl: { not: null } }, select: { id: true }, take: 1 }, seekerCv: { select: { uploadedUrl: true, uploadedFileName: true, builderUrl: true, builderFileName: true } } } },
    },
  });
  if (!profile) throw new BillingError(404, 'CANDIDATE_NOT_FOUND', 'That profile is no longer available.');
  return profile;
};

/** Opens one limited profile. The view is recorded (once a day per company) so the person can see who looked. */
export const viewCandidate = async (ownerId: string, profileId: string, now = new Date()) => {
  const entitlements = await requireCvAccess(ownerId, now);
  const profile = await loadCandidate(ownerId, profileId);

  await prisma.cvProfileView.create({ data: { employerId: ownerId, seekerId: profile.userId, day: dayKey(now) } }).catch((error: { code?: string }) => {
    if (error.code !== 'P2002') throw error;
  });

  const unlock = await prisma.cvUnlock.findUnique({ where: { employerId_seekerId: { employerId: ownerId, seekerId: profile.userId } }, select: { id: true } });
  const base = limitedProfile(profile as unknown as Row, now, Boolean(unlock));
  const cv = profile.user.seekerCv;
  const file = cv?.uploadedUrl ? { url: cv.uploadedUrl, fileName: cv.uploadedFileName } : cv?.builderUrl ? { url: cv.builderUrl, fileName: cv.builderFileName } : null;

  return {
    profile: base,
    // Name, phone, email and the CV file only come back once this company has unlocked the profile.
    contact: unlock ? { name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Job seeker', email: profile.user.email, phone: profile.user.phone, cv: file } : null,
    allowance: await unlockAllowance(ownerId, entitlements.monthlyUnlocks, now),
  };
};

/** Spends one of the plan's monthly unlocks. Unlocking someone again is free. Every unlock is logged. */
export const unlockCandidate = async (ownerId: string, actorId: string | undefined, profileId: string, now = new Date()) => {
  const entitlements = await requireCvAccess(ownerId, now);
  const profile = await loadCandidate(ownerId, profileId);

  const existing = await prisma.cvUnlock.findUnique({ where: { employerId_seekerId: { employerId: ownerId, seekerId: profile.userId } }, select: { id: true } });
  if (existing) return { alreadyUnlocked: true, ...(await viewCandidate(ownerId, profileId, now)) };

  const before = await unlockAllowance(ownerId, entitlements.monthlyUnlocks, now);
  if (before.remaining <= 0) {
    throw new BillingError(403, 'NO_UNLOCKS_LEFT', `You have used all ${before.limit} profile unlocks in your plan this month. They renew on ${before.resetsOn.toISOString().slice(0, 10)}.`);
  }

  await prisma.cvUnlock.create({ data: { employerId: ownerId, seekerId: profile.userId, actorId: actorId && actorId !== ownerId ? actorId : null } });

  // Two unlocks at the same moment could both pass the check above; the one that goes over the limit is taken back.
  const after = await unlockAllowance(ownerId, entitlements.monthlyUnlocks, now);
  if (after.used > after.limit) {
    await prisma.cvUnlock.delete({ where: { employerId_seekerId: { employerId: ownerId, seekerId: profile.userId } } });
    throw new BillingError(403, 'NO_UNLOCKS_LEFT', 'You have used all the profile unlocks in your plan this month.');
  }

  const company = await prisma.employerProfile.findUnique({ where: { userId: ownerId }, select: { companyName: true } });
  void createNotification(prisma, { userId: profile.userId, type: 'CV_UNLOCKED', title: 'A verified employer unlocked your profile', message: `${company?.companyName ?? 'A company'} can now see your name and contact details. You can see who has looked, and block a company, in your privacy settings.`, actionUrl: '/dashboard' }).catch(() => undefined);

  return { alreadyUnlocked: false, ...(await viewCandidate(ownerId, profileId, now)) };
};

/** Invites a person to apply to one of the company's open jobs. They get a notification; no contact details change hands. */
export const inviteCandidate = async (ownerId: string, profileId: string, jobId: string, message: string | undefined, now = new Date()) => {
  await requireCvAccess(ownerId, now);
  const profile = await loadCandidate(ownerId, profileId);
  const job = await prisma.job.findFirst({ where: { id: jobId, employerId: ownerId, ...publicJobWhere(now) }, select: { id: true, title: true } });
  if (!job) throw new BillingError(400, 'JOB_REQUIRED', 'Choose one of your open jobs.');

  const already = await prisma.candidateInvite.findUnique({ where: { employerId_seekerId_jobId: { employerId: ownerId, seekerId: profile.userId, jobId } }, select: { id: true } });
  if (already) throw new BillingError(409, 'ALREADY_INVITED', 'You already invited this person to that job.');

  await prisma.candidateInvite.create({ data: { employerId: ownerId, seekerId: profile.userId, jobId, message: message?.trim() || null } });
  const company = await prisma.employerProfile.findUnique({ where: { userId: ownerId }, select: { companyName: true } });
  await createNotification(prisma, {
    userId: profile.userId,
    type: 'CANDIDATE_INVITE',
    title: `${company?.companyName ?? 'A company'} invited you to apply`,
    message: `${job.title}${message?.trim() ? `: "${message.trim().slice(0, 200)}"` : ''}`,
    actionUrl: `/jobs/${job.id}`,
  });
  return { invited: true };
};

// ------------------------------------------------------------------ saved searches

export const listSavedSearches = (ownerId: string) => prisma.savedCandidateSearch.findMany({ where: { employerId: ownerId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, filtersJson: true, alertsEnabled: true, lastAlertAt: true, createdAt: true } });

export const createSavedSearch = async (ownerId: string, input: { name: string; filters: Record<string, unknown>; alertsEnabled: boolean }) => {
  await requireCvAccess(ownerId);
  if ((await prisma.savedCandidateSearch.count({ where: { employerId: ownerId } })) >= MAX_SAVED_SEARCHES) {
    throw new BillingError(400, 'TOO_MANY_SEARCHES', `You can keep up to ${MAX_SAVED_SEARCHES} saved searches. Delete one first.`);
  }
  const filters = cleanFilters(input.filters);
  return prisma.savedCandidateSearch.create({ data: { employerId: ownerId, name: input.name, filtersJson: JSON.stringify(filters), alertsEnabled: input.alertsEnabled, lastAlertAt: new Date() } });
};

/** Daily: email each company that has alerts on, once, when new matching people became visible since the last alert. */
export const runCandidateAlerts = async (now = new Date()) => {
  const searches = await prisma.savedCandidateSearch.findMany({ where: { alertsEnabled: true }, include: { employer: { select: { email: true, status: true } } }, take: 1000 });
  let sent = 0;
  for (const search of searches) {
    if (!search.employer.email || search.employer.status !== 'ACTIVE') continue;
    const since = search.lastAlertAt ?? search.createdAt;
    if (now.getTime() - since.getTime() < 20 * 60 * 60 * 1000) continue;
    try {
      await requireCvAccess(search.employerId, now);
      let filters: CandidateFilters;
      try {
        filters = cleanFilters(JSON.parse(search.filtersJson) as Record<string, unknown>);
      } catch {
        continue;
      }
      const fresh = await findMatching(search.employerId, filters, now, since);
      if (fresh.length === 0) continue;
      await prisma.savedCandidateSearch.update({ where: { id: search.id }, data: { lastAlertAt: now } });
      void sendCandidateAlertEmail(search.employer.email, { searchName: search.name, count: fresh.length, url: `${env.frontendBaseUrl}/cv-database?saved=${search.id}` })?.catch?.(() => undefined);
      sent += 1;
    } catch (error) {
      // A company that lost its plan or verification simply gets no alerts.
      if (!(error instanceof BillingError)) logger.error('candidate_alert_failed', { searchId: search.id, error: getErrorMessage(error) });
    }
  }
  return { sent };
};

export const runCandidateAlertsSafely = async () => {
  try {
    const result = await runCandidateAlerts();
    if (result.sent) logger.info('candidate_alerts', result);
  } catch (error) {
    logger.error('candidate_alerts_failed', { error: getErrorMessage(error) });
  }
};

// ------------------------------------------------------------------ the job seeker's side

/** Which companies looked at or unlocked this person's profile, newest first, and which companies they blocked. */
export const getMyCvActivity = async (seekerId: string) => {
  const [views, unlocks, blocks] = await Promise.all([
    prisma.cvProfileView.findMany({ where: { seekerId }, orderBy: { createdAt: 'desc' }, take: 100, select: { employerId: true, createdAt: true, employer: { select: { employerProfile: { select: { companyName: true } } } } } }),
    prisma.cvUnlock.findMany({ where: { seekerId }, orderBy: { createdAt: 'desc' }, take: 100, select: { employerId: true, createdAt: true, employer: { select: { employerProfile: { select: { companyName: true } } } } } }),
    prisma.cvBlock.findMany({ where: { seekerId }, orderBy: { createdAt: 'desc' }, select: { employerId: true, createdAt: true, employer: { select: { employerProfile: { select: { companyName: true } } } } } }),
  ]);
  const name = (row: { employer: { employerProfile: { companyName: string } | null } }) => row.employer.employerProfile?.companyName ?? 'A company';
  const activity = [
    ...unlocks.map((row) => ({ kind: 'UNLOCKED' as const, employerId: row.employerId, company: name(row), at: row.createdAt })),
    ...views.map((row) => ({ kind: 'VIEWED' as const, employerId: row.employerId, company: name(row), at: row.createdAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  return { activity, blocked: blocks.map((row) => ({ employerId: row.employerId, company: name(row), at: row.createdAt })) };
};

export const blockCompany = async (seekerId: string, employerId: string) => {
  const employer = await prisma.user.findFirst({ where: { id: employerId, role: 'EMPLOYER' }, select: { id: true } });
  if (!employer) throw new BillingError(404, 'COMPANY_NOT_FOUND', 'We could not find that company.');
  await prisma.cvBlock.upsert({ where: { seekerId_employerId: { seekerId, employerId } }, update: {}, create: { seekerId, employerId } });
  return { blocked: true };
};

export const unblockCompany = async (seekerId: string, employerId: string) => {
  await prisma.cvBlock.deleteMany({ where: { seekerId, employerId } });
  return { blocked: false };
};
