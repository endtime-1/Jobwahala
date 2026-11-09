import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import logger from '../config/logger';
import prisma from '../config/prisma';
import { recordAdminAction } from '../utils/adminAudit';
import { getErrorMessage } from '../utils/errors';
import { publicJobWhere } from '../utils/jobLifecycle';
import { createNotification } from '../utils/notifications';
import {
  buildWeeklyReport,
  claimExpiry,
  claimMessage,
  claimState,
  claimUrl,
  hashToken,
  isEmptyReport,
  lastWeek,
  newReferralCode,
  newToken,
  normalizeReferralCode,
  referralShareText,
  referralUrl,
  reportShareText,
  whatsappLink,
  type WeeklyReport,
} from '../utils/acquisition';
import { normalizeGhanaPhone } from '../utils/phone';
import { BillingError } from './billingErrors';
import { grantCredits } from './creditService';
import { sendCompanyClaimEmail, sendVerificationEmail, sendWeeklyReportEmail } from './emailService';

type Admin = { id: string; email: string };

// ------------------------------------------------------------------ 1. a company an admin sets up

export type NewManagedCompany = {
  companyName: string;
  industry?: string | null;
  website?: string | null;
  description?: string | null;
  contactPhone?: string | null;
};

/**
 * Creates a company page for an employer who sends vacancies by WhatsApp. It has no email and no password anyone knows, so nobody
 * can log in to it; the owner takes it over with a claim link. Admin-posted jobs show "posted by JobWahala on behalf of the company".
 */
export const createManagedCompany = async (admin: Admin, input: NewManagedCompany) => {
  const phone = input.contactPhone ? normalizeGhanaPhone(input.contactPhone) ?? input.contactPhone.trim() : null;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      // A random password nobody sees: logging in is only possible after the owner claims the company and sets their own.
      data: { password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10), role: 'EMPLOYER', status: 'ACTIVE' },
    });
    const profile = await tx.employerProfile.create({
      data: {
        userId: user.id,
        companyName: input.companyName.trim(),
        industry: input.industry?.trim() || null,
        website: input.website?.trim() || null,
        description: input.description?.trim() || null,
        contactPhone: phone,
        claimStatus: 'UNCLAIMED',
        createdByAdminId: admin.id,
      },
    });
    await recordAdminAction(tx, { admin, action: 'COMPANY_CREATED_FOR_EMPLOYER', targetType: 'User', targetId: user.id, metadata: { companyName: profile.companyName } });
    return { id: user.id, companyName: profile.companyName, claimStatus: profile.claimStatus };
  });
};

// ------------------------------------------------------------------ 2. claim links

export type ClaimChannel = 'EMAIL' | 'WHATSAPP' | 'LINK';

/**
 * Makes a new claim link for a company waiting to be claimed. Any earlier link is revoked first, so "resend" always leaves exactly one
 * working link. Email is sent from here; for WhatsApp the admin gets a ready-to-send message and link.
 */
export const issueClaimLink = async (admin: Admin, companyId: string, input: { channel: ClaimChannel; email?: string | null; phone?: string | null }, now = new Date()) => {
  const company = await prisma.employerProfile.findUnique({ where: { userId: companyId }, select: { companyName: true, claimStatus: true, contactPhone: true } });
  if (!company) throw new BillingError(404, 'COMPANY_NOT_FOUND', 'No such company.');
  if (company.claimStatus !== 'UNCLAIMED') throw new BillingError(409, 'ALREADY_CLAIMED', 'This company has already been taken over by its owner.');

  const email = input.channel === 'EMAIL' ? (input.email || '').trim().toLowerCase() : null;
  if (input.channel === 'EMAIL' && !email) throw new BillingError(400, 'EMAIL_REQUIRED', 'Enter the email address to send the link to.');
  const phone = input.channel === 'WHATSAPP' ? (input.phone ? normalizeGhanaPhone(input.phone) ?? input.phone.trim() : company.contactPhone) : null;
  if (input.channel === 'WHATSAPP' && !phone) throw new BillingError(400, 'PHONE_REQUIRED', 'Enter the WhatsApp number to send the link to.');

  const token = newToken();
  const previous = await prisma.companyClaim.findMany({ where: { companyId }, select: { sendCount: true } });
  const claim = await prisma.$transaction(async (tx) => {
    await tx.companyClaim.updateMany({ where: { companyId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: now } });
    const created = await tx.companyClaim.create({
      data: { companyId, tokenHash: hashToken(token), channel: input.channel, sentTo: email ?? phone, expiresAt: claimExpiry(now), createdById: admin.id, sendCount: previous.length + 1, lastSentAt: now },
    });
    await recordAdminAction(tx, { admin, action: previous.length ? 'CLAIM_LINK_RESENT' : 'CLAIM_LINK_CREATED', targetType: 'User', targetId: companyId, metadata: { channel: input.channel, claimId: created.id } });
    return created;
  });

  const url = claimUrl(env.frontendBaseUrl, token);
  let emailed = false;
  if (email) {
    try {
      await sendCompanyClaimEmail(email, { company: company.companyName, url });
      emailed = true;
    } catch (error) {
      logger.error('claim_email_failed', { error: getErrorMessage(error) });
    }
  }

  return {
    claimId: claim.id,
    url,
    emailed,
    whatsappUrl: input.channel === 'WHATSAPP' ? whatsappLink(claimMessage(company.companyName, url), phone) : null,
    expiresAt: claim.expiresAt,
  };
};

export const revokeClaimLink = async (admin: Admin, claimId: string) => {
  const claim = await prisma.companyClaim.findUnique({ where: { id: claimId } });
  if (!claim) throw new BillingError(404, 'CLAIM_NOT_FOUND', 'No such link.');
  if (claim.status !== 'ACTIVE') throw new BillingError(409, 'NOT_ACTIVE', 'That link is not active any more.');
  await prisma.$transaction(async (tx) => {
    await tx.companyClaim.update({ where: { id: claimId }, data: { status: 'REVOKED', revokedAt: new Date() } });
    await recordAdminAction(tx, { admin, action: 'CLAIM_LINK_REVOKED', targetType: 'User', targetId: claim.companyId, metadata: { claimId } });
  });
};

/** What the person opening a claim link sees before they decide: the company and what is waiting for them. Nothing private. */
export const previewClaim = async (token: string, now = new Date()) => {
  const claim = await prisma.companyClaim.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!claim) throw new BillingError(404, 'LINK_NOT_FOUND', 'This link is not valid. Ask JobWahala to send you a new one.');
  const state = claimState(claim, now);
  if (state !== 'ACTIVE') {
    const message = state === 'CLAIMED' ? 'This company has already been taken over. Log in to open it.' : state === 'EXPIRED' ? 'This link has expired. Ask JobWahala to send you a new one.' : 'This link was cancelled. Ask JobWahala to send you a new one.';
    throw new BillingError(410, `LINK_${state}`, message);
  }
  const profile = await prisma.employerProfile.findUnique({ where: { userId: claim.companyId }, select: { companyName: true, industry: true } });
  const [jobs, applicants] = await Promise.all([
    prisma.job.count({ where: { employerId: claim.companyId, ...publicJobWhere(now) } }),
    prisma.application.count({ where: { job: { employerId: claim.companyId } } }),
  ]);
  return { company: { name: profile?.companyName ?? 'Your company', industry: profile?.industry ?? null }, openJobs: jobs, applicants, emailHint: claim.channel === 'EMAIL' ? claim.sentTo : null, expiresAt: claim.expiresAt };
};

const signToken = (id: string, role: string, tokenVersion: number) =>
  jwt.sign({ id, role, tokenVersion }, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });

/**
 * The owner takes the company over: they choose the email and password it will have from now on. The link works once; every
 * other link for the company is cancelled. If the link was emailed to that same address, the address is already confirmed.
 */
export const acceptClaim = async (token: string, input: { email: string; password: string }, now = new Date()) => {
  const claim = await prisma.companyClaim.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!claim) throw new BillingError(404, 'LINK_NOT_FOUND', 'This link is not valid. Ask JobWahala to send you a new one.');
  if (claimState(claim, now) !== 'ACTIVE') throw new BillingError(410, 'LINK_NOT_ACTIVE', 'This link can no longer be used. Ask JobWahala to send you a new one.');

  const email = input.email.trim().toLowerCase();
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) throw new BillingError(409, 'EMAIL_TAKEN', 'There is already an account with that email. Log in to it, or use a different email for this company.');

  const profile = await prisma.employerProfile.findUnique({ where: { userId: claim.companyId }, select: { claimStatus: true, companyName: true } });
  if (!profile || profile.claimStatus !== 'UNCLAIMED') throw new BillingError(409, 'ALREADY_CLAIMED', 'This company has already been taken over.');

  const confirmed = claim.channel === 'EMAIL' && (claim.sentTo || '').toLowerCase() === email;
  const password = await bcrypt.hash(input.password, 10);

  const user = await prisma.$transaction(async (tx) => {
    // Only one person can win: the link changes from ACTIVE to CLAIMED in the same step, and only if it is still ACTIVE.
    const won = await tx.companyClaim.updateMany({ where: { id: claim.id, status: 'ACTIVE' }, data: { status: 'CLAIMED', claimedAt: now } });
    if (won.count !== 1) throw new BillingError(410, 'LINK_NOT_ACTIVE', 'This link can no longer be used. Ask JobWahala to send you a new one.');
    await tx.companyClaim.updateMany({ where: { companyId: claim.companyId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: now } });
    const updated = await tx.user.update({ where: { id: claim.companyId }, data: { email, password, emailVerified: confirmed, tokenVersion: { increment: 1 } } });
    await tx.employerProfile.update({ where: { userId: claim.companyId }, data: { claimStatus: 'CLAIMED' } });
    return updated;
  });

  if (!confirmed) {
    try {
      const verification = newToken();
      await prisma.emailVerificationToken.create({ data: { token: verification, userId: user.id, expiresAt: new Date(now.getTime() + 24 * 3_600_000) } });
      await sendVerificationEmail(email, verification);
    } catch (error) {
      logger.error('claim_verification_email_failed', { error: getErrorMessage(error) });
    }
  }

  await createNotification(prisma, { userId: user.id, type: 'COMPANY_CLAIMED', title: `Welcome, ${profile.companyName}`, message: 'You now run this company page. Check your jobs and applicants.', actionUrl: '/dashboard' }).catch(() => undefined);

  return { token: signToken(user.id, user.role, user.tokenVersion), user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified }, companyName: profile.companyName };
};

/** The companies an admin set up, with where each claim link stands. */
export const listManagedCompanies = async (now = new Date()) => {
  const rows = await prisma.employerProfile.findMany({
    where: { createdByAdminId: { not: null } },
    orderBy: { companyName: 'asc' },
    take: 300,
    select: {
      userId: true,
      companyName: true,
      industry: true,
      contactPhone: true,
      contactEmail: true,
      claimStatus: true,
      isFoundingEmployer: true,
      foundingNumber: true,
      user: { select: { createdAt: true, email: true } },
    },
  });
  const ids = rows.map((row) => row.userId);
  const [claims, jobs] = await Promise.all([
    prisma.companyClaim.findMany({ where: { companyId: { in: ids } }, orderBy: { createdAt: 'desc' } }),
    prisma.job.groupBy({ by: ['employerId'], where: { employerId: { in: ids } }, _count: { _all: true } }),
  ]);
  return rows.map((row) => {
    const mine = claims.filter((claim) => claim.companyId === row.userId);
    const latest = mine[0];
    return {
      id: row.userId,
      companyName: row.companyName,
      industry: row.industry,
      contactPhone: row.contactPhone,
      email: row.user.email ?? row.contactEmail,
      claimStatus: row.claimStatus,
      isFoundingEmployer: row.isFoundingEmployer,
      foundingNumber: row.foundingNumber,
      jobs: jobs.find((job) => job.employerId === row.userId)?._count._all ?? 0,
      claim: latest ? { id: latest.id, state: claimState(latest, now), channel: latest.channel, sentTo: latest.sentTo, sendCount: latest.sendCount, lastSentAt: latest.lastSentAt, expiresAt: latest.expiresAt } : null,
    };
  });
};

// ------------------------------------------------------------------ 3. Founding Employers

export const getFoundingSettings = async () => {
  const settings = await prisma.billingSettings.findUnique({ where: { id: 'default' } });
  return { limit: settings?.foundingLimit ?? 50, featuredCredits: settings?.foundingFeaturedCredits ?? 3 };
};

export const saveFoundingSettings = async (admin: Admin, input: { limit: number; featuredCredits: number }) => {
  await prisma.$transaction(async (tx) => {
    await tx.billingSettings.upsert({ where: { id: 'default' }, create: { id: 'default', foundingLimit: input.limit, foundingFeaturedCredits: input.featuredCredits }, update: { foundingLimit: input.limit, foundingFeaturedCredits: input.featuredCredits } });
    await recordAdminAction(tx, { admin, action: 'FOUNDING_SETTINGS_CHANGED', targetType: 'BillingSettings', targetId: 'default', metadata: input });
  });
  return getFoundingSettings();
};

/** The lowest number from 1 to the limit that no Founding Employer has, or null when all are taken. */
export const nextFoundingNumber = (taken: number[], limit: number) => {
  const used = new Set(taken);
  for (let n = 1; n <= limit; n += 1) if (!used.has(n)) return n;
  return null;
};

/**
 * Makes a company a Founding Employer (badge + free featured credits) or takes the badge away. The programme has a limit; when
 * every place is taken this refuses. Taking the badge away leaves the credits already given, and frees the number.
 */
export const setFoundingEmployer = async (admin: Admin, companyId: string, founding: boolean) => {
  const settings = await getFoundingSettings();
  return prisma.$transaction(async (tx) => {
    const profile = await tx.employerProfile.findUnique({ where: { userId: companyId }, select: { isFoundingEmployer: true, foundingNumber: true, companyName: true } });
    if (!profile) throw new BillingError(404, 'COMPANY_NOT_FOUND', 'No such company.');

    if (!founding) {
      if (profile.isFoundingEmployer) {
        await tx.employerProfile.update({ where: { userId: companyId }, data: { isFoundingEmployer: false, foundingNumber: null, foundingAt: null } });
        await recordAdminAction(tx, { admin, action: 'FOUNDING_EMPLOYER_REMOVED', targetType: 'User', targetId: companyId, metadata: { number: profile.foundingNumber } });
      }
      return { isFoundingEmployer: false, foundingNumber: null as number | null, creditsGiven: 0 };
    }

    if (profile.isFoundingEmployer) return { isFoundingEmployer: true, foundingNumber: profile.foundingNumber, creditsGiven: 0 };

    const taken = await tx.employerProfile.findMany({ where: { isFoundingEmployer: true }, select: { foundingNumber: true } });
    const number = nextFoundingNumber(taken.map((row) => row.foundingNumber).filter((n): n is number => typeof n === 'number'), settings.limit);
    if (number === null) throw new BillingError(409, 'FOUNDING_FULL', `All ${settings.limit} Founding Employer places are taken. Raise the limit in the settings first.`);

    await tx.employerProfile.update({ where: { userId: companyId }, data: { isFoundingEmployer: true, foundingNumber: number, foundingAt: new Date() } });
    await grantCredits(tx, { userId: companyId, featured: settings.featuredCredits, reason: 'FOUNDING_EMPLOYER', adminId: admin.id, note: `Founding Employer #${number}` });
    await recordAdminAction(tx, { admin, action: 'FOUNDING_EMPLOYER_ADDED', targetType: 'User', targetId: companyId, metadata: { number, credits: settings.featuredCredits } });
    return { isFoundingEmployer: true, foundingNumber: number as number | null, creditsGiven: settings.featuredCredits };
  });
};

export const listFoundingEmployers = async () => {
  const [settings, rows] = await Promise.all([
    getFoundingSettings(),
    prisma.employerProfile.findMany({ where: { isFoundingEmployer: true }, orderBy: { foundingNumber: 'asc' }, select: { userId: true, companyName: true, foundingNumber: true, foundingAt: true } }),
  ]);
  return { ...settings, taken: rows.length, companies: rows.map((row) => ({ id: row.userId, companyName: row.companyName, number: row.foundingNumber, since: row.foundingAt })) };
};

// ------------------------------------------------------------------ 5. referral

/** The company's own referral code, made the first time it is asked for. */
export const ensureReferralCode = async (userId: string) => {
  const profile = await prisma.employerProfile.findUnique({ where: { userId }, select: { referralCode: true } });
  if (!profile) throw new BillingError(404, 'COMPANY_NOT_FOUND', 'No company page yet.');
  if (profile.referralCode) return profile.referralCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newReferralCode();
    try {
      await prisma.employerProfile.update({ where: { userId }, data: { referralCode: code } });
      return code;
    } catch {
      // The code was taken (a very rare clash); try another.
    }
  }
  throw new BillingError(500, 'CODE_FAILED', 'Could not make a referral code. Try again.');
};

export const getReferralInfo = async (userId: string) => {
  const code = await ensureReferralCode(userId);
  const profile = await prisma.employerProfile.findUnique({ where: { userId }, select: { companyName: true } });
  const [referred, rewarded] = await Promise.all([
    prisma.employerProfile.count({ where: { referredById: userId } }),
    prisma.employerProfile.count({ where: { referredById: userId, referralRewardedAt: { not: null } } }),
  ]);
  const url = referralUrl(env.frontendBaseUrl, code);
  return { code, url, referred, rewarded, creditsEarned: rewarded, whatsappUrl: whatsappLink(referralShareText(profile?.companyName || 'a JobWahala employer', url)) };
};

/**
 * Records who referred a new company. Allowed once, in the first 14 days of the account, before it has posted a job, and never to
 * itself, so a code cannot be added later to farm a reward.
 */
export const attachReferral = async (userId: string, rawCode: string, now = new Date()) => {
  const code = normalizeReferralCode(rawCode);
  const [mine, referrer] = await Promise.all([
    prisma.employerProfile.findUnique({ where: { userId }, select: { referredById: true, user: { select: { createdAt: true } } } }),
    prisma.employerProfile.findUnique({ where: { referralCode: code }, select: { userId: true, user: { select: { status: true } } } }),
  ]);
  if (!mine) throw new BillingError(404, 'COMPANY_NOT_FOUND', 'No company page yet.');
  if (!referrer || referrer.user.status !== 'ACTIVE') throw new BillingError(404, 'CODE_NOT_FOUND', 'That referral code is not valid.');
  if (referrer.userId === userId) throw new BillingError(400, 'OWN_CODE', 'You cannot use your own referral code.');
  if (mine.referredById) return { attached: false };
  if (now.getTime() - mine.user.createdAt.getTime() > 14 * 86_400_000) throw new BillingError(400, 'TOO_LATE', 'A referral code can only be added in the first 14 days.');
  if ((await prisma.job.count({ where: { employerId: userId } })) > 0) throw new BillingError(400, 'ALREADY_POSTED', 'A referral code can only be added before the first job is posted.');
  await prisma.employerProfile.update({ where: { userId }, data: { referredById: referrer.userId } });
  return { attached: true };
};

/**
 * When a referred company posts its first job, the company that referred it gets one free featured credit. The reward is claimed with
 * one conditional update, so it is given once even if the job is posted twice at the same moment. Never throws: posting a job must not fail
 * because of a referral.
 */
export const rewardReferralForFirstJob = async (employerId: string) => {
  try {
    const profile = await prisma.employerProfile.findUnique({ where: { userId: employerId }, select: { referredById: true, referralRewardedAt: true, companyName: true } });
    if (!profile?.referredById || profile.referralRewardedAt) return false;
    const referrer = await prisma.user.findUnique({ where: { id: profile.referredById }, select: { id: true, status: true } });
    if (!referrer || referrer.status !== 'ACTIVE' || referrer.id === employerId) return false;

    return await prisma.$transaction(async (tx) => {
      const claimed = await tx.employerProfile.updateMany({ where: { userId: employerId, referralRewardedAt: null }, data: { referralRewardedAt: new Date() } });
      if (claimed.count !== 1) return false;
      await grantCredits(tx, { userId: referrer.id, featured: 1, reason: 'REFERRAL', note: `${profile.companyName} posted its first job` });
      await createNotification(tx, { userId: referrer.id, type: 'REFERRAL_REWARD', title: 'You earned a free featured listing', message: `${profile.companyName}, a company you referred, posted its first job. You now have one more featured credit.`, actionUrl: '/billing' });
      return true;
    });
  } catch (error) {
    logger.error('referral_reward_failed', { error: getErrorMessage(error) });
    return false;
  }
};

// ------------------------------------------------------------------ 4. the weekly employer report

/** The report for one company for the given week: its active jobs (the ones that existed during the week), with views and applicants. */
export const buildCompanyReport = async (employerId: string, week = lastWeek()): Promise<WeeklyReport> => {
  const jobs = await prisma.job.findMany({ where: { employerId, ...publicJobWhere(), createdAt: { lt: week.end } }, select: { id: true, title: true }, orderBy: { createdAt: 'desc' }, take: 50 });
  const ids = jobs.map((job) => job.id);
  const [applications, views] = ids.length
    ? await Promise.all([
        prisma.application.findMany({ where: { jobId: { in: ids } }, select: { jobId: true, createdAt: true, status: true } }),
        prisma.jobView.findMany({ where: { jobId: { in: ids }, createdAt: { gte: week.start, lt: week.end } }, select: { jobId: true, createdAt: true } }),
      ])
    : [[], []];
  return buildWeeklyReport({ jobs, applications, views, start: week.start, end: week.end });
};

/** What the employer's dashboard shows: the saved report for last week if there is one, otherwise worked out now. Plus a WhatsApp share link. */
export const getEmployerWeeklyReport = async (employerId: string, now = new Date()) => {
  const week = lastWeek(now);
  const saved = await prisma.employerWeeklyReport.findUnique({ where: { employerId_weekStart: { employerId, weekStart: week.start } } });
  let report: WeeklyReport;
  try {
    report = saved ? (JSON.parse(saved.dataJson) as WeeklyReport) : await buildCompanyReport(employerId, week);
  } catch {
    report = await buildCompanyReport(employerId, week);
  }
  const profile = await prisma.employerProfile.findUnique({ where: { userId: employerId }, select: { companyName: true } });
  return { report, whatsappUrl: whatsappLink(reportShareText(profile?.companyName || 'Our company', report, env.frontendBaseUrl)) };
};

/**
 * Builds and emails last week's report for every company with an active job. Safe to run any number of times: a company's report is
 * saved once per week, and the email is sent once. Companies an admin set up and nobody has claimed are skipped (they have no inbox).
 */
export const runWeeklyEmployerReports = async (now = new Date()) => {
  const week = lastWeek(now);
  const employers = await prisma.user.findMany({
    where: { role: 'EMPLOYER', status: 'ACTIVE', employerProfile: { is: { claimStatus: 'CLAIMED' } }, jobsPosted: { some: { ...publicJobWhere(now), createdAt: { lt: week.end } } } },
    select: { id: true, email: true, employerProfile: { select: { companyName: true } } },
    take: 2000,
  });

  let built = 0;
  let emailed = 0;
  for (const employer of employers) {
    try {
      const existing = await prisma.employerWeeklyReport.findUnique({ where: { employerId_weekStart: { employerId: employer.id, weekStart: week.start } } });
      if (existing?.emailSentAt) continue;

      const report = await buildCompanyReport(employer.id, week);
      if (isEmptyReport(report)) continue;
      const row = existing ?? (await prisma.employerWeeklyReport.create({ data: { employerId: employer.id, weekStart: week.start, dataJson: JSON.stringify(report) } }));
      if (!existing) built += 1;

      const company = employer.employerProfile?.companyName || 'your company';
      // Record the send first: if the mail provider is slow, a second run must not send it twice.
      const marked = await prisma.employerWeeklyReport.updateMany({ where: { id: row.id, emailSentAt: null }, data: { emailSentAt: new Date() } });
      if (marked.count !== 1) continue;
      if (employer.email) {
        await sendWeeklyReportEmail(employer.email, { company, report, dashboardUrl: `${env.frontendBaseUrl}/dashboard`, whatsappUrl: whatsappLink(reportShareText(company, report, env.frontendBaseUrl)) });
        emailed += 1;
      }
      await createNotification(prisma, { userId: employer.id, type: 'WEEKLY_REPORT', title: 'Your weekly hiring report', message: `${report.totals.views} views and ${report.totals.newApplicants} new applicants last week.`, actionUrl: '/dashboard' }).catch(() => undefined);
    } catch (error) {
      logger.error('weekly_report_failed', { employerId: employer.id, error: getErrorMessage(error) });
    }
  }
  return { employers: employers.length, built, emailed };
};

export const runWeeklyEmployerReportsSafely = async () => {
  try {
    const result = await runWeeklyEmployerReports();
    if (result.built || result.emailed) logger.info('weekly_reports_done', result);
  } catch (error) {
    logger.error('weekly_reports_error', { error: getErrorMessage(error) });
  }
};
