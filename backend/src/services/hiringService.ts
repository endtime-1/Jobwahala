import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import env from '../config/env';
import logger from '../config/logger';
import prisma from '../config/prisma';
import { recordAdminAction } from '../utils/adminAudit';
import { cleanFilters, PAGE_SIZE, type CandidateFilters } from '../utils/cvDatabase';
import { getErrorMessage } from '../utils/errors';
import {
  CONSENT_VERSION,
  DEFAULT_GUARANTEE_DAYS,
  OPEN_STATUSES,
  OUT_STAGES,
  STATUS_LABEL,
  WORKING_STATUSES,
  briefKeywords,
  canMoveStatus,
  canRequestReplacement,
  cleanMustHaves,
  cleanRatings,
  clientCandidateView,
  feeSummary,
  fitScore,
  formatGhs,
  ghsToPesewas,
  guaranteeDaysLeft,
  guaranteeEnd,
  guaranteeReminderDue,
  isClientVisible,
  opportunityView,
  parseJsonList,
  parseRatings,
  referenceFor,
  relevance,
  shortlistBlocker,
  staffCandidateView,
  type ProfileFacts,
} from '../utils/hiring';
import { createNotification } from '../utils/notifications';
import { resolvePay } from '../utils/salary';
import { BillingError } from './billingErrors';
import { findMatching, limitedProfile } from './cvDatabaseService';
import { notifyJobAlerts } from './jobAlertService';
import { sendGuaranteeReminderEmail, sendHiringShortlistEmail, sendHiringStatusEmail, sendOpportunityEmail, sendPasswordResetEmail } from './emailService';

export type Actor = { id: string; role: string; email?: string | null };

const STAFF_ROLES = ['ADMIN', 'RECRUITER'];
const textOf = (value: string | null | undefined) => (value ?? '').trim();
const mail = <T>(task: Promise<T>) => task.catch((error) => logger.error('hiring_email_failed', { error: getErrorMessage(error) }));
const day = (date: Date) => date.toISOString().slice(0, 10);

/** Writes the audit line for a staff action, in the caller's transaction. Recruiters leave the same trail admins do. */
const audit = (tx: Parameters<typeof recordAdminAction>[0], actor: Actor, action: string, targetType: string, targetId: string, metadata?: Record<string, unknown>) =>
  recordAdminAction(tx, { admin: { id: actor.id, email: actor.email ?? 'unknown' }, actorRole: actor.role, action, targetType, targetId, metadata });

type EventClient = Pick<typeof prisma, 'hiringEvent'>;
const event = (client: EventClient, input: { requestId: string; candidateId?: string | null; actor?: Actor | null; kind: string; body: string; visibility?: 'STAFF' | 'CLIENT' }) =>
  client.hiringEvent.create({ data: { requestId: input.requestId, candidateId: input.candidateId ?? null, actorId: input.actor?.id ?? null, actorRole: input.actor?.role ?? 'SYSTEM', kind: input.kind, body: input.body, visibility: input.visibility ?? 'STAFF' } });

const loadRequest = async (requestId: string) => {
  const request = await prisma.hiringRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new BillingError(404, 'REQUEST_NOT_FOUND', 'No such hiring request.');
  return request;
};
type RequestRow = Awaited<ReturnType<typeof loadRequest>>;

// ------------------------------------------------------------------ settings and the public page

export const getHiringInfo = async () => {
  const settings = await prisma.billingSettings.findUnique({ where: { id: 'default' } });
  return { fromPriceGhs: settings?.hiringFromPriceGhs ?? null, guaranteeDays: settings?.hiringGuaranteeDays ?? DEFAULT_GUARANTEE_DAYS };
};

export const saveHiringSettings = async (admin: Actor, input: { fromPriceGhs: number | null; guaranteeDays: number }) => {
  await prisma.$transaction(async (tx) => {
    await tx.billingSettings.upsert({ where: { id: 'default' }, create: { id: 'default', hiringFromPriceGhs: input.fromPriceGhs, hiringGuaranteeDays: input.guaranteeDays }, update: { hiringFromPriceGhs: input.fromPriceGhs, hiringGuaranteeDays: input.guaranteeDays } });
    await audit(tx, admin, 'HIRING_SETTINGS_CHANGED', 'BillingSettings', 'default', input);
  });
  return getHiringInfo();
};

// ------------------------------------------------------------------ the employer's side

export type RequestInput = {
  roleTitle: string;
  headcount: number;
  salaryMin?: number | null;
  salaryMax?: number | null;
  location: string;
  startDate?: string | null;
  deadline?: string | null;
  requirements: string;
  contactName: string;
  contactPhone: string;
  mustHaves?: string[];
};

const parseDate = (value: string | null | undefined, label: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BillingError(400, 'BAD_DATE', `The ${label} is not a date.`);
  return date;
};

/** Saves the request as NEW and tells every admin. */
export const createRequest = async (clientId: string, input: RequestInput, now = new Date()) => {
  const profile = await prisma.employerProfile.findUnique({ where: { userId: clientId }, select: { companyName: true } });
  if (!profile) throw new BillingError(403, 'COMPANY_REQUIRED', 'Set up your company page first.');
  if (input.salaryMin && input.salaryMax && input.salaryMin > input.salaryMax) throw new BillingError(400, 'SALARY_RANGE', 'The lowest salary is higher than the highest.');
  const startDate = parseDate(input.startDate, 'start date');
  const deadline = parseDate(input.deadline, 'deadline');
  const settings = await getHiringInfo();

  const year = now.getUTCFullYear();
  const base = await prisma.hiringRequest.count({ where: { createdAt: { gte: new Date(Date.UTC(year, 0, 1)) } } });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const request = await prisma.hiringRequest.create({
        data: {
          reference: referenceFor(year, base + 1 + attempt),
          clientId,
          roleTitle: input.roleTitle.trim(),
          headcount: Math.max(1, input.headcount),
          salaryMin: input.salaryMin ?? null,
          salaryMax: input.salaryMax ?? null,
          location: input.location.trim(),
          startDate,
          deadline,
          requirements: input.requirements.trim(),
          contactName: input.contactName.trim(),
          contactPhone: input.contactPhone.trim(),
          mustHavesJson: JSON.stringify(cleanMustHaves(input.mustHaves)),
          guaranteeDays: settings.guaranteeDays,
          createdById: clientId,
        },
      });
      await event(prisma, { requestId: request.id, kind: 'STATUS', visibility: 'CLIENT', body: 'Request received. We will contact you to agree the terms.' });
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
      for (const admin of admins) await createNotification(prisma, { userId: admin.id, type: 'HIRING_REQUEST_NEW', title: 'New hiring request', message: `${request.reference}: ${request.roleTitle} for ${profile.companyName}.`, actionUrl: '/dashboard' });
      return { id: request.id, reference: request.reference };
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
  }
  throw new BillingError(500, 'REFERENCE_FAILED', 'Could not save the request. Please try again.');
};

const clientRequest = async (clientId: string, requestId: string) => {
  const request = await loadRequest(requestId);
  if (request.clientId !== clientId) throw new BillingError(404, 'REQUEST_NOT_FOUND', 'No such hiring request.');
  return request;
};

/** Tells the employer, in the app and by email, that something changed on their request. */
const notifyClient = async (request: Pick<RequestRow, 'id' | 'clientId' | 'reference' | 'roleTitle'>, title: string, message: string) => {
  await createNotification(prisma, { userId: request.clientId, type: 'HIRING_UPDATE', title, message, actionUrl: `/hiring-service/${request.id}` });
  const client = await prisma.user.findUnique({ where: { id: request.clientId }, select: { email: true } });
  if (client?.email) void mail(sendHiringStatusEmail(client.email, { role: request.roleTitle, title, message, url: `${env.frontendBaseUrl}/hiring-service/${request.id}` }));
};

export const cancelByClient = async (clientId: string, requestId: string, now = new Date()) => {
  const request = await clientRequest(clientId, requestId);
  if (!['NEW', 'AGREED'].includes(request.status)) throw new BillingError(409, 'TOO_LATE', 'Work has started on this request. Contact us to cancel it.');
  await prisma.$transaction(async (tx) => {
    await tx.hiringRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED', cancelledAt: now, closeReason: 'Cancelled by the employer' } });
    await event(tx, { requestId, kind: 'STATUS', visibility: 'CLIENT', body: 'You cancelled this request.' });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    for (const admin of admins) await createNotification(tx, { userId: admin.id, type: 'HIRING_CANCELLED', title: `${request.reference} cancelled`, message: `${request.roleTitle} was cancelled by the employer.`, actionUrl: '/dashboard' });
  });
};

const feeView = (request: Pick<RequestRow, 'feePesewas' | 'depositPesewas'>, payments: { kind: string; amountPesewas: number }[]) => {
  const summary = feeSummary(request, payments);
  return { ...summary, feeLabel: formatGhs(summary.feePesewas), depositLabel: formatGhs(summary.depositPesewas), balanceLabel: formatGhs(summary.balancePesewas), paidLabel: formatGhs(summary.paidPesewas), outstandingLabel: formatGhs(summary.outstandingPesewas) };
};

const requestSummary = (request: RequestRow) => ({
  id: request.id,
  reference: request.reference,
  roleTitle: request.roleTitle,
  status: request.status,
  headcount: request.headcount,
  location: request.location,
  deadline: request.deadline,
  sentAt: request.sentAt,
  createdAt: request.createdAt,
});

export const listClientRequests = async (clientId: string) => {
  const rows = await prisma.hiringRequest.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map(requestSummary);
};

/** Facts about people, for a set of seekers: what the profile says, who they are and how to reach them. */
const loadFacts = async (seekerIds: string[]) => {
  const rows = seekerIds.length
    ? await prisma.jobSeekerProfile.findMany({
        where: { userId: { in: seekerIds } },
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          headline: true,
          skills: true,
          experience: true,
          location: true,
          educationLevel: true,
          yearsExperience: true,
          cvVisibility: true,
          user: { select: { email: true, phone: true, identityVerified: true, learnerCourses: { where: { status: 'CONFIRMED', certificateUrl: { not: null } }, select: { id: true }, take: 1 }, seekerCv: { select: { uploadedUrl: true, uploadedFileName: true, builderUrl: true, builderFileName: true } } } },
        },
      })
    : [];
  const map = new Map<string, { facts: ProfileFacts; visible: boolean }>();
  for (const row of rows) {
    const cv = row.user.seekerCv;
    const file = cv?.uploadedUrl ? { url: cv.uploadedUrl, name: cv.uploadedFileName } : cv?.builderUrl ? { url: cv.builderUrl, name: cv.builderFileName } : null;
    map.set(row.userId, {
      visible: row.cvVisibility === 'VERIFIED_EMPLOYERS',
      facts: {
        name: [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Job seeker',
        headline: row.headline,
        skills: row.skills,
        experience: row.experience,
        location: row.location,
        educationLevel: row.educationLevel,
        yearsExperience: row.yearsExperience,
        verifiedCertificate: row.user.learnerCourses.length > 0,
        identityVerified: row.user.identityVerified,
        email: row.user.email,
        phone: row.user.phone,
        cvUrl: file?.url ?? null,
        cvFileName: file?.name ?? null,
      },
    });
  }
  return map;
};

const EMPTY_FACTS: ProfileFacts = { name: 'Job seeker', headline: null, skills: null, experience: null, location: null, educationLevel: null, yearsExperience: null, verifiedCertificate: false, identityVerified: false, email: null, phone: null, cvUrl: null, cvFileName: null };

const jobLink = async (jobId: string | null) => (jobId ? prisma.job.findUnique({ where: { id: jobId }, select: { id: true, title: true, status: true } }) : null);

/** The employer's view of one request: progress, the deal, the shortlist (once we have sent it), and the timeline. */
export const getClientRequest = async (clientId: string, requestId: string, now = new Date()) => {
  const request = await clientRequest(clientId, requestId);
  const mustHaves = parseJsonList(request.mustHavesJson);
  const sent = Boolean(request.sentAt);

  const [candidates, events, recruiter, payments, job] = await Promise.all([
    sent ? prisma.hiringCandidate.findMany({ where: { requestId, shortlistedAt: { not: null }, consentAt: { not: null }, stage: { notIn: ['DECLINED', 'DROPPED'] } }, orderBy: [{ shortlistedAt: 'asc' }] }) : [],
    prisma.hiringEvent.findMany({ where: { requestId, visibility: 'CLIENT' }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, kind: true, body: true, createdAt: true } }),
    request.assignedRecruiterId ? prisma.staffProfile.findUnique({ where: { userId: request.assignedRecruiterId }, select: { displayName: true, title: true } }) : null,
    prisma.hiringPayment.findMany({ where: { requestId }, select: { kind: true, amountPesewas: true } }),
    jobLink(request.jobId),
  ]);
  const facts = await loadFacts(candidates.map((candidate) => candidate.seekerId));
  const blocked = candidates.length ? await prisma.cvBlock.findMany({ where: { employerId: clientId, seekerId: { in: candidates.map((candidate) => candidate.seekerId) } }, select: { seekerId: true } }) : [];
  const blockedIds = new Set(blocked.map((block) => block.seekerId));

  return {
    request: {
      ...requestSummary(request),
      salaryMin: request.salaryMin,
      salaryMax: request.salaryMax,
      startDate: request.startDate,
      requirements: request.requirements,
      contactName: request.contactName,
      contactPhone: request.contactPhone,
      mustHaves,
      guaranteeDays: request.guaranteeDays,
      guaranteeEndsAt: request.guaranteeEndsAt,
      guaranteeDaysLeft: guaranteeDaysLeft(request.guaranteeEndsAt, now),
      closeReason: request.closeReason,
      recruiter: recruiter ? { name: recruiter.displayName, title: recruiter.title } : null,
      job,
      fee: request.feePesewas !== null ? feeView(request, payments) : null,
      canCancel: ['NEW', 'AGREED'].includes(request.status),
      canRequestReplacement: canRequestReplacement(request, now),
    },
    // Only people who agreed and were shortlisted, once we have sent the shortlist. Staff notes and how they were found never leave this function.
    candidates: candidates.filter((candidate) => isClientVisible(candidate) && !blockedIds.has(candidate.seekerId)).map((candidate) => clientCandidateView(candidate, facts.get(candidate.seekerId)?.facts ?? EMPTY_FACTS, mustHaves)),
    timeline: events,
  };
};

/**
 * The employer answers about a shortlisted person: invite to interview, not suitable, or hired. Hiring records the start date and starts the
 * replacement guarantee; hiring everyone needed fills the request.
 */
export const decideOnCandidate = async (clientId: string, requestId: string, candidateId: string, input: { decision: 'INTERVIEW' | 'NOT_SUITABLE' | 'HIRED'; note?: string | null; startDate?: string | null }, now = new Date()) => {
  const request = await clientRequest(clientId, requestId);
  if (!['SHORTLIST_SENT', 'INTERVIEWING'].includes(request.status) || !request.sentAt) throw new BillingError(409, 'NOT_OPEN', 'The shortlist is not ready for decisions yet.');
  const candidate = await prisma.hiringCandidate.findFirst({ where: { id: candidateId, requestId } });
  if (!candidate || !isClientVisible(candidate)) throw new BillingError(404, 'CANDIDATE_NOT_FOUND', 'No such candidate in your shortlist.');
  if (candidate.stage === 'HIRED') throw new BillingError(409, 'ALREADY_HIRED', 'This person is already hired.');
  const start = input.decision === 'HIRED' ? parseDate(input.startDate, 'start date') ?? now : null;

  const note = textOf(input.note) || null;
  const label = input.decision === 'NOT_SUITABLE' ? 'marked not suitable' : input.decision === 'HIRED' ? 'marked as hired' : 'invited to interview';

  return prisma.$transaction(async (tx) => {
    await tx.hiringCandidate.update({ where: { id: candidate.id }, data: { stage: input.decision, clientDecision: input.decision, clientDecisionNote: note, clientDecidedAt: now, ...(start ? { startDate: start } : {}) } });
    await event(tx, { requestId, candidateId, kind: 'CLIENT_DECISION', visibility: 'STAFF', body: `The employer ${label}.${note ? ` Note: ${note}` : ''}${start ? ` Start date: ${day(start)}.` : ''}` });

    let status = request.status;
    let filled = false;
    if (input.decision === 'INTERVIEW' && request.status === 'SHORTLIST_SENT') status = 'INTERVIEWING';
    if (input.decision === 'HIRED') {
      const hired = await tx.hiringCandidate.count({ where: { requestId, stage: 'HIRED' } });
      if (hired >= request.headcount) {
        filled = true;
        status = 'FILLED';
        const ends = guaranteeEnd(start as Date, request.guaranteeDays);
        await tx.hiringRequest.update({ where: { id: requestId }, data: { status: 'FILLED', filledAt: now, guaranteeEndsAt: ends, guaranteeReminderSentAt: null } });
        await event(tx, { requestId, kind: 'STATUS', visibility: 'CLIENT', body: `All places filled. Your replacement guarantee runs until ${day(ends)}.` });
      }
    }
    if (!filled && status !== request.status) await tx.hiringRequest.update({ where: { id: requestId }, data: { status } });

    if (request.assignedRecruiterId) await createNotification(tx, { userId: request.assignedRecruiterId, type: 'HIRING_CLIENT_DECISION', title: `${request.reference}: the employer replied`, message: `A candidate for ${request.roleTitle} was ${label}.`, actionUrl: `/recruiter/requests/${requestId}` });
    return { status, filled };
  });
};

/** Within the guarantee, a hire that left is replaced for free: the request goes back to sourcing. */
export const requestReplacement = async (clientId: string, requestId: string, reason: string, now = new Date()) => {
  const request = await clientRequest(clientId, requestId);
  if (!canRequestReplacement(request, now)) throw new BillingError(409, 'NO_GUARANTEE', 'The replacement guarantee has ended, or the request is not complete.');

  await prisma.$transaction(async (tx) => {
    const hired = await tx.hiringCandidate.findFirst({ where: { requestId, stage: 'HIRED' }, orderBy: { clientDecidedAt: 'desc' } });
    if (hired) await tx.hiringCandidate.update({ where: { id: hired.id }, data: { stage: 'DROPPED', staffNotes: `${textOf(hired.staffNotes)}\nLeft the role; replacement requested.`.trim() } });
    await tx.hiringRequest.update({ where: { id: requestId }, data: { status: 'SOURCING', filledAt: null, guaranteeEndsAt: null, guaranteeReminderSentAt: null, replacementCount: { increment: 1 } } });
    await event(tx, { requestId, kind: 'STATUS', visibility: 'CLIENT', body: `Replacement started at no extra cost. Reason: ${reason}` });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    const recipients = new Set([...admins.map((admin) => admin.id), ...(request.assignedRecruiterId ? [request.assignedRecruiterId] : [])]);
    for (const userId of recipients) await createNotification(tx, { userId, type: 'HIRING_REPLACEMENT', title: `${request.reference}: replacement needed`, message: `A hire for ${request.roleTitle} left. Find a replacement.`, actionUrl: userId === request.assignedRecruiterId ? `/recruiter/requests/${requestId}` : '/dashboard' });
  });
};

// ------------------------------------------------------------------ the candidate's side

/** Roles that people have been asked about, and their answer. */
export const listOpportunities = async (seekerId: string) => {
  const rows = await prisma.hiringCandidate.findMany({ where: { seekerId, stage: { in: ['CONSENT_ASKED', 'CONSENTED', 'SHORTLISTED', 'INTERVIEW', 'HIRED', 'DECLINED'] }, source: { not: 'APPLICANT' } }, orderBy: { createdAt: 'desc' }, take: 50 });
  if (rows.length === 0) return [];
  const requests = await prisma.hiringRequest.findMany({ where: { id: { in: rows.map((row) => row.requestId) } } });
  const companies = await prisma.employerProfile.findMany({ where: { userId: { in: requests.map((request) => request.clientId) } }, select: { userId: true, companyName: true } });
  const staff = await prisma.staffProfile.findMany({ where: { userId: { in: requests.map((request) => request.assignedRecruiterId).filter((id): id is string => Boolean(id)) } }, select: { userId: true, displayName: true, title: true } });

  return rows.map((row) => {
    const request = requests.find((item) => item.id === row.requestId)!;
    const company = companies.find((item) => item.userId === request.clientId);
    const recruiter = staff.find((item) => item.userId === request.assignedRecruiterId);
    return {
      id: row.id,
      stage: row.stage,
      answered: row.stage !== 'CONSENT_ASKED',
      agreedAt: row.consentAt,
      ...opportunityView(request, { name: company?.companyName ?? 'A company' }, recruiter ? { name: recruiter.displayName, title: recruiter.title } : null),
    };
  });
};

export const respondToOpportunity = async (seekerId: string, candidateId: string, input: { accept: boolean; reason?: string | null }, now = new Date()) => {
  const candidate = await prisma.hiringCandidate.findFirst({ where: { id: candidateId, seekerId } });
  if (!candidate) throw new BillingError(404, 'NOT_FOUND', 'No such opportunity.');
  if (candidate.stage !== 'CONSENT_ASKED') throw new BillingError(409, 'ALREADY_ANSWERED', 'You have already answered this one.');
  const request = await loadRequest(candidate.requestId);

  await prisma.$transaction(async (tx) => {
    if (input.accept) {
      await tx.hiringCandidate.update({ where: { id: candidate.id }, data: { stage: 'CONSENTED', consentAt: now, consentVersion: CONSENT_VERSION } });
      await event(tx, { requestId: request.id, candidateId, kind: 'CANDIDATE', body: 'The candidate agreed to be put forward.' });
    } else {
      await tx.hiringCandidate.update({ where: { id: candidate.id }, data: { stage: 'DECLINED', declinedAt: now, declineReason: textOf(input.reason) || null } });
      await event(tx, { requestId: request.id, candidateId, kind: 'CANDIDATE', body: `The candidate said no.${textOf(input.reason) ? ` Reason: ${textOf(input.reason)}` : ''}` });
    }
    if (request.assignedRecruiterId) {
      await createNotification(tx, { userId: request.assignedRecruiterId, type: 'HIRING_CANDIDATE_REPLIED', title: `${request.reference}: a candidate replied`, message: input.accept ? 'A candidate agreed to be put forward.' : 'A candidate said no.', actionUrl: `/recruiter/requests/${request.id}` });
    }
  });
};

// ------------------------------------------------------------------ staff: access and the list

const assertAccess = (actor: Actor, request: { assignedRecruiterId: string | null }) => {
  if (!STAFF_ROLES.includes(actor.role)) throw new BillingError(403, 'STAFF_ONLY', 'Staff only.');
  if (actor.role === 'RECRUITER' && request.assignedRecruiterId !== actor.id) throw new BillingError(404, 'REQUEST_NOT_FOUND', 'No such hiring request.');
};

const staffRequest = async (actor: Actor, requestId: string) => {
  const request = await loadRequest(requestId);
  assertAccess(actor, request);
  return request;
};

export type StaffFilters = { status?: string; recruiterId?: string; from?: string; to?: string };

export const listStaffRequests = async (actor: Actor, filters: StaffFilters = {}) => {
  const created: { gte?: Date; lte?: Date } = {};
  if (filters.from) {
    const from = new Date(filters.from);
    if (!Number.isNaN(from.getTime())) created.gte = from;
  }
  if (filters.to) {
    const to = new Date(filters.to);
    if (!Number.isNaN(to.getTime())) created.lte = new Date(to.getTime() + 86_400_000 - 1);
  }
  const where = {
    ...(filters.status && filters.status !== 'ALL' ? { status: filters.status } : {}),
    // A recruiter only ever sees their own; the recruiter filter is for admins.
    ...(actor.role === 'RECRUITER' ? { assignedRecruiterId: actor.id } : filters.recruiterId ? { assignedRecruiterId: filters.recruiterId === 'NONE' ? null : filters.recruiterId } : {}),
    ...(created.gte || created.lte ? { createdAt: created } : {}),
  };
  const rows = await prisma.hiringRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });
  const companies = await prisma.employerProfile.findMany({ where: { userId: { in: [...new Set(rows.map((row) => row.clientId))] } }, select: { userId: true, companyName: true } });
  const staff = await prisma.staffProfile.findMany({ where: { userId: { in: [...new Set(rows.map((row) => row.assignedRecruiterId).filter((id): id is string => Boolean(id)))] } }, select: { userId: true, displayName: true } });
  const counts = await prisma.hiringCandidate.groupBy({ by: ['requestId', 'stage'], where: { requestId: { in: rows.map((row) => row.id) } }, _count: { _all: true } });
  return rows.map((row) => {
    const mine = counts.filter((count) => count.requestId === row.id);
    const total = (stages: string[]) => mine.filter((count) => stages.includes(count.stage)).reduce((sum, count) => sum + count._count._all, 0);
    return {
      ...requestSummary(row),
      company: companies.find((company) => company.userId === row.clientId)?.companyName ?? 'Company',
      recruiter: staff.find((member) => member.userId === row.assignedRecruiterId)?.displayName ?? null,
      assignedRecruiterId: row.assignedRecruiterId,
      guaranteeEndsAt: row.guaranteeEndsAt,
      pipeline: { total: total(['SOURCED', 'CONSENT_ASKED', 'CONSENTED', 'SHORTLISTED', 'INTERVIEW', 'HIRED']), shortlisted: total(['SHORTLISTED', 'INTERVIEW', 'HIRED']) },
    };
  });
};

export const getStaffRequest = async (actor: Actor, requestId: string, now = new Date()) => {
  const request = await staffRequest(actor, requestId);
  const mustHaves = parseJsonList(request.mustHavesJson);
  const isAdmin = actor.role === 'ADMIN';
  const [candidates, events, company, job, payments] = await Promise.all([
    prisma.hiringCandidate.findMany({ where: { requestId }, orderBy: [{ createdAt: 'asc' }] }),
    prisma.hiringEvent.findMany({ where: { requestId }, orderBy: { createdAt: 'desc' }, take: 300, select: { id: true, candidateId: true, actorRole: true, kind: true, body: true, visibility: true, createdAt: true } }),
    prisma.employerProfile.findUnique({ where: { userId: request.clientId }, select: { companyName: true, industry: true } }),
    jobLink(request.jobId),
    // What was agreed and paid is for admins only: a recruiter works the request and never sees the money.
    isAdmin ? prisma.hiringPayment.findMany({ where: { requestId }, orderBy: { paidAt: 'asc' } }) : [],
  ]);
  const facts = await loadFacts(candidates.map((candidate) => candidate.seekerId));

  return {
    request: {
      ...requestSummary(request),
      company: company?.companyName ?? 'Company',
      industry: company?.industry ?? null,
      salaryMin: request.salaryMin,
      salaryMax: request.salaryMax,
      startDate: request.startDate,
      requirements: request.requirements,
      contactName: request.contactName,
      contactPhone: request.contactPhone,
      mustHaves,
      assignedRecruiterId: request.assignedRecruiterId,
      guaranteeDays: request.guaranteeDays,
      guaranteeEndsAt: request.guaranteeEndsAt,
      guaranteeDaysLeft: guaranteeDaysLeft(request.guaranteeEndsAt, now),
      replacementCount: request.replacementCount,
      closeReason: request.closeReason,
      job,
      ...(isAdmin ? { fee: feeView(request, payments), feePesewas: request.feePesewas, depositPesewas: request.depositPesewas, payments: payments.map((payment) => ({ id: payment.id, kind: payment.kind, amountPesewas: payment.amountPesewas, amountLabel: formatGhs(payment.amountPesewas), paidAt: payment.paidAt, method: payment.method, reference: payment.reference, note: payment.note })) } : {}),
    },
    // The list never carries contact details or CVs: opening one person (below) does, and is logged.
    candidates: candidates.map((candidate) => staffCandidateView(candidate, facts.get(candidate.seekerId)?.facts ?? EMPTY_FACTS, mustHaves, false)),
    events,
  };
};

/** Opens one person with everything staff may see. Names, contact details and the CV only open once the person agreed or made their profile visible. Always logged. */
export const openCandidate = async (actor: Actor, requestId: string, candidateId: string) => {
  const request = await staffRequest(actor, requestId);
  const candidate = await prisma.hiringCandidate.findFirst({ where: { id: candidateId, requestId } });
  if (!candidate) throw new BillingError(404, 'CANDIDATE_NOT_FOUND', 'No such candidate.');
  const facts = (await loadFacts([candidate.seekerId])).get(candidate.seekerId);
  const open = Boolean(candidate.consentAt) || Boolean(facts?.visible);

  await prisma.$transaction(async (tx) => {
    await audit(tx, actor, 'CANDIDATE_PROFILE_OPENED', 'HiringCandidate', candidate.id, { requestId, reference: request.reference, detailsOpen: open });
  });
  return staffCandidateView(candidate, facts?.facts ?? EMPTY_FACTS, parseJsonList(request.mustHavesJson), open);
};

// ------------------------------------------------------------------ staff: the status and the job post

/** Moves a request to another status, tells the employer, and logs it. Cancelling needs an admin and a reason. */
export const setStatus = async (actor: Actor, requestId: string, to: string, reason?: string | null, now = new Date()) => {
  const request = await staffRequest(actor, requestId);
  if (!canMoveStatus(request.status, to)) throw new BillingError(409, 'BAD_STATUS', `A ${STATUS_LABEL[request.status] ?? request.status} request cannot be changed to ${STATUS_LABEL[to] ?? to}.`);
  if (to === 'CANCELLED' && (actor.role !== 'ADMIN' || textOf(reason).length < 3)) throw new BillingError(403, 'ADMIN_REASON', 'Only an admin can cancel a request, and they must give a reason.');
  if (to === 'FILLED') throw new BillingError(400, 'USE_HIRE', 'A request is filled when the employer marks a candidate as hired.');
  if (to === 'SHORTLIST_SENT') throw new BillingError(400, 'USE_SEND', 'Send the shortlist from the request instead.');

  await prisma.$transaction(async (tx) => {
    await tx.hiringRequest.update({ where: { id: requestId }, data: { status: to, ...(to === 'CANCELLED' ? { cancelledAt: now, closeReason: textOf(reason) } : {}) } });
    await event(tx, { requestId, actor, kind: 'STATUS', visibility: 'CLIENT', body: `Status changed from ${STATUS_LABEL[request.status]} to ${STATUS_LABEL[to]}.${to === 'CANCELLED' ? ` ${textOf(reason)}` : ''}` });
    await audit(tx, actor, 'HIRING_STATUS_CHANGED', 'HiringRequest', requestId, { from: request.status, to, reason: textOf(reason) || undefined });
  });
  await notifyClient(request, `${request.reference}: ${STATUS_LABEL[to]}`, `Your hiring request for ${request.roleTitle} is now: ${STATUS_LABEL[to]}.`);
};

/** One click: a job post for this request, under the employer's company. A draft by default, so the employer can read it before it goes live. */
export const createJobFromRequest = async (actor: Actor, requestId: string, input: { publish: boolean }, now = new Date()) => {
  const request = await staffRequest(actor, requestId);
  if (request.jobId) throw new BillingError(409, 'JOB_EXISTS', 'This request already has a job post.');
  if (['CANCELLED', 'FILLED'].includes(request.status)) throw new BillingError(409, 'NOT_OPEN', 'This request is closed.');

  const money = (value: number) => value.toLocaleString('en-GH');
  const range = request.salaryMin && request.salaryMax ? `GHS ${money(request.salaryMin)} to ${money(request.salaryMax)} a month` : request.salaryMin ? `From GHS ${money(request.salaryMin)} a month` : request.salaryMax ? `Up to GHS ${money(request.salaryMax)} a month` : undefined;
  const closesAt = request.deadline && request.deadline.getTime() > now.getTime() ? request.deadline : new Date(now.getTime() + 30 * 86_400_000);

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.job.create({
      data: {
        employerId: request.clientId,
        postedByAdminId: actor.id,
        postedByAdminAt: now,
        title: request.roleTitle,
        description: request.requirements,
        location: request.location,
        type: 'Full-time',
        status: input.publish ? 'ACTIVE' : 'DRAFT',
        closesAt,
        ...resolvePay({ salary: range }),
        salaryParsedAt: now,
      },
    });
    await tx.hiringRequest.update({ where: { id: requestId }, data: { jobId: created.id } });
    await event(tx, { requestId, actor, kind: 'JOB', visibility: 'CLIENT', body: input.publish ? 'A job post was created and published for this role.' : 'A draft job post was created for this role. You can review it in your dashboard.' });
    await audit(tx, actor, 'HIRING_JOB_CREATED', 'HiringRequest', requestId, { jobId: created.id, published: input.publish });
    return created;
  });
  if (input.publish) void notifyJobAlerts(job);
  await notifyClient(request, `${request.reference}: job post created`, input.publish ? `We published a job post for ${request.roleTitle}.` : `We drafted a job post for ${request.roleTitle}. Review it in your dashboard.`);
  return { jobId: job.id, published: input.publish };
};

// ------------------------------------------------------------------ staff: sourcing

const assertWorkable = (request: { status: string }) => {
  if (!WORKING_STATUSES.includes(request.status)) throw new BillingError(409, 'NOT_ACTIVE', request.status === 'NEW' ? 'Agree the terms first: this request is still New.' : 'This request is not being worked on.');
};

const startSourcing = async (tx: Pick<typeof prisma, 'hiringRequest'>, request: { id: string; status: string }) => {
  if (request.status === 'AGREED') await tx.hiringRequest.update({ where: { id: request.id }, data: { status: 'SOURCING' } });
};

/** Search the CV database for a request's role: only people who made their profile visible, never anyone who blocked the employer, ranked by how much of the brief they cover. */
export const searchForRequest = async (actor: Actor, requestId: string, filters: Record<string, unknown>, page = 1, now = new Date()) => {
  const request = await staffRequest(actor, requestId);
  assertWorkable(request);
  const clean: CandidateFilters = cleanFilters(filters);
  const keywords = briefKeywords(`${request.roleTitle} ${request.requirements}`);
  const matching = await findMatching(request.clientId, clean, now);
  const existing = await prisma.hiringCandidate.findMany({ where: { requestId }, select: { seekerId: true } });
  const already = new Set(existing.map((row) => row.seekerId));

  const ranked = matching
    .filter((row) => !already.has(row.userId))
    .map((row) => ({ row, score: relevance(keywords, [row.skills, row.headline, row.experience].join(' ')) }))
    .sort((a, b) => b.score - a.score);

  const safePage = Math.max(1, page);
  const slice = ranked.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return { total: ranked.length, page: safePage, pageSize: PAGE_SIZE, entries: slice.map(({ row, score }) => ({ ...limitedProfile(row, now, false), relevance: score })) };
};

export const addCandidate = async (actor: Actor, requestId: string, input: { profileId?: string; email?: string }) => {
  const request = await staffRequest(actor, requestId);
  assertWorkable(request);

  let seekerId: string | null = null;
  let source = 'CV_DATABASE';
  if (input.profileId) {
    const profile = await prisma.jobSeekerProfile.findFirst({ where: { id: input.profileId, cvVisibility: 'VERIFIED_EMPLOYERS', user: { status: 'ACTIVE', role: 'SEEKER', cvBlocksMade: { none: { employerId: request.clientId } } } }, select: { userId: true } });
    seekerId = profile?.userId ?? null;
  } else if (input.email) {
    // Someone we already know by email. They are still asked for their agreement before anything is shared.
    const user = await prisma.user.findFirst({ where: { email: input.email.trim().toLowerCase(), role: 'SEEKER', status: 'ACTIVE', cvBlocksMade: { none: { employerId: request.clientId } } }, select: { id: true } });
    seekerId = user?.id ?? null;
    source = 'DIRECT';
  }
  if (!seekerId) throw new BillingError(404, 'CANDIDATE_NOT_FOUND', 'No job seeker with a JobWahala account matches that.');

  const exists = await prisma.hiringCandidate.findUnique({ where: { requestId_seekerId: { requestId, seekerId } }, select: { id: true } });
  if (exists) throw new BillingError(409, 'ALREADY_ADDED', 'This person is already in the request.');

  return prisma.$transaction(async (tx) => {
    const candidate = await tx.hiringCandidate.create({ data: { requestId, seekerId: seekerId as string, source, createdById: actor.id } });
    await startSourcing(tx, request);
    await event(tx, { requestId, candidateId: candidate.id, actor, kind: 'CANDIDATE', body: `Added a candidate (${source === 'DIRECT' ? 'by email' : 'CV database'}).` });
    await audit(tx, actor, 'CANDIDATE_ADDED', 'HiringCandidate', candidate.id, { requestId, source });
    return { id: candidate.id };
  });
};

/** Adds everyone who applied to the linked job. They applied to this employer, so their agreement to share with the employer is already given. */
export const importApplicants = async (actor: Actor, requestId: string) => {
  const request = await staffRequest(actor, requestId);
  assertWorkable(request);
  if (!request.jobId) throw new BillingError(409, 'NO_JOB', 'Create the job post first.');
  const applications = await prisma.application.findMany({ where: { jobId: request.jobId }, select: { seekerId: true, createdAt: true } });
  const existing = await prisma.hiringCandidate.findMany({ where: { requestId }, select: { seekerId: true } });
  const already = new Set(existing.map((row) => row.seekerId));
  const blocked = await prisma.cvBlock.findMany({ where: { employerId: request.clientId, seekerId: { in: applications.map((application) => application.seekerId) } }, select: { seekerId: true } });
  const blockedIds = new Set(blocked.map((block) => block.seekerId));
  const fresh = applications.filter((application) => !already.has(application.seekerId) && !blockedIds.has(application.seekerId));

  await prisma.$transaction(async (tx) => {
    for (const application of fresh) {
      await tx.hiringCandidate.create({ data: { requestId, seekerId: application.seekerId, source: 'APPLICANT', stage: 'CONSENTED', consentAt: application.createdAt, consentVersion: 'applied', createdById: actor.id } });
    }
    if (fresh.length) {
      await startSourcing(tx, request);
      await event(tx, { requestId, actor, kind: 'CANDIDATE', body: `Added ${fresh.length} ${fresh.length === 1 ? 'applicant' : 'applicants'} from the job post.` });
      await audit(tx, actor, 'APPLICANTS_IMPORTED', 'HiringRequest', requestId, { count: fresh.length });
    }
  });
  return { added: fresh.length };
};

/** Ask the person if they agree to be put forward. Nothing about them reaches the employer until they say yes. */
export const askConsent = async (actor: Actor, requestId: string, candidateId: string, now = new Date()) => {
  const request = await staffRequest(actor, requestId);
  assertWorkable(request);
  const candidate = await prisma.hiringCandidate.findFirst({ where: { id: candidateId, requestId } });
  if (!candidate) throw new BillingError(404, 'CANDIDATE_NOT_FOUND', 'No such candidate.');
  if (candidate.stage !== 'SOURCED') throw new BillingError(409, 'ALREADY_ASKED', 'This person has already been asked.');

  const [recruiter, user] = await Promise.all([
    prisma.staffProfile.findUnique({ where: { userId: actor.id }, select: { displayName: true } }),
    prisma.user.findUnique({ where: { id: candidate.seekerId }, select: { email: true } }),
  ]);
  await prisma.$transaction(async (tx) => {
    await tx.hiringCandidate.update({ where: { id: candidate.id }, data: { stage: 'CONSENT_ASKED', consentAskedAt: now } });
    await event(tx, { requestId, candidateId, actor, kind: 'CANDIDATE', body: 'Asked the candidate if they agree to be put forward.' });
    await createNotification(tx, { userId: candidate.seekerId, type: 'HIRING_OPPORTUNITY', title: `A recruiter has a role for you: ${request.roleTitle}`, message: 'Read the role and say yes or no. Nothing is shared without your yes.', actionUrl: '/opportunities' });
  });
  if (user?.email) void mail(sendOpportunityEmail(user.email, { role: request.roleTitle, recruiter: recruiter?.displayName ?? 'A JobWahala recruiter', url: `${env.frontendBaseUrl}/opportunities` }));
};

export const updateCandidate = async (actor: Actor, requestId: string, candidateId: string, input: { ratings?: Record<string, unknown>; note?: string | null; staffNotes?: string | null }) => {
  const request = await staffRequest(actor, requestId);
  assertWorkable(request);
  const candidate = await prisma.hiringCandidate.findFirst({ where: { id: candidateId, requestId } });
  if (!candidate) throw new BillingError(404, 'CANDIDATE_NOT_FOUND', 'No such candidate.');
  if (OUT_STAGES.includes(candidate.stage)) throw new BillingError(409, 'OUT', 'This person is no longer in the request.');

  const mustHaves = parseJsonList(request.mustHavesJson);
  const ratings = input.ratings ? cleanRatings(mustHaves, input.ratings) : parseRatings(candidate.ratingsJson);
  const data = {
    ...(input.ratings ? { ratingsJson: JSON.stringify(ratings), fitScore: fitScore(mustHaves, ratings) } : {}),
    ...(input.note !== undefined ? { clientSummary: textOf(input.note) || null } : {}),
    ...(input.staffNotes !== undefined ? { staffNotes: textOf(input.staffNotes) || null } : {}),
  };
  const updated = await prisma.hiringCandidate.update({ where: { id: candidate.id }, data });
  return { id: updated.id, stage: updated.stage, fitScore: updated.fitScore };
};

export const dropCandidate = async (actor: Actor, requestId: string, candidateId: string, reason: string) => {
  const request = await staffRequest(actor, requestId);
  const candidate = await prisma.hiringCandidate.findFirst({ where: { id: candidateId, requestId } });
  if (!candidate) throw new BillingError(404, 'CANDIDATE_NOT_FOUND', 'No such candidate.');
  if (['HIRED', 'DROPPED', 'DECLINED'].includes(candidate.stage)) throw new BillingError(409, 'CANNOT_DROP', 'This person cannot be removed now.');
  await prisma.$transaction(async (tx) => {
    await tx.hiringCandidate.update({ where: { id: candidate.id }, data: { stage: 'DROPPED', staffNotes: `${textOf(candidate.staffNotes)}\nRemoved: ${reason}`.trim() } });
    await event(tx, { requestId, candidateId, actor, kind: 'CANDIDATE', body: `Removed from the request: ${reason}` });
    await audit(tx, actor, 'CANDIDATE_DROPPED', 'HiringCandidate', candidate.id, { requestId: request.id, reason });
  });
};

export const shortlistCandidate = async (actor: Actor, requestId: string, candidateId: string, now = new Date()) => {
  const request = await staffRequest(actor, requestId);
  assertWorkable(request);
  const candidate = await prisma.hiringCandidate.findFirst({ where: { id: candidateId, requestId } });
  if (!candidate) throw new BillingError(404, 'CANDIDATE_NOT_FOUND', 'No such candidate.');
  if (candidate.shortlistedAt) throw new BillingError(409, 'ALREADY_SHORTLISTED', 'Already on the shortlist.');
  const blocker = shortlistBlocker(candidate);
  if (blocker) throw new BillingError(409, 'NOT_READY', blocker);
  if (await prisma.cvBlock.findFirst({ where: { employerId: request.clientId, seekerId: candidate.seekerId }, select: { id: true } })) throw new BillingError(409, 'BLOCKED', 'This person has blocked the hiring company. Remove them from the request.');

  await prisma.$transaction(async (tx) => {
    await tx.hiringCandidate.update({ where: { id: candidate.id }, data: { stage: 'SHORTLISTED', shortlistedAt: now } });
    await event(tx, { requestId, candidateId, actor, kind: 'CANDIDATE', body: 'Added to the shortlist.' });
    await audit(tx, actor, 'CANDIDATE_SHORTLISTED', 'HiringCandidate', candidate.id, { requestId });
  });

  // After the shortlist went out, a late addition reaches the employer straight away.
  if (request.sentAt) {
    await createNotification(prisma, { userId: request.clientId, type: 'HIRING_SHORTLIST_ADDED', title: `${request.reference}: another candidate`, message: `A new candidate was added to your shortlist for ${request.roleTitle}.`, actionUrl: `/hiring-service/${requestId}` });
  }
};

/** Sends the shortlist to the employer: they get an email and an in-app notice, and the shortlist opens on their request page. */
export const sendShortlist = async (actor: Actor, requestId: string, now = new Date()) => {
  const request = await staffRequest(actor, requestId);
  assertWorkable(request);
  const shortlisted = await prisma.hiringCandidate.count({ where: { requestId, shortlistedAt: { not: null }, consentAt: { not: null }, stage: { notIn: ['DECLINED', 'DROPPED'] } } });
  if (shortlisted < 1) throw new BillingError(409, 'EMPTY_SHORTLIST', 'Shortlist at least one person who has agreed.');

  const client = await prisma.user.findUnique({ where: { id: request.clientId }, select: { email: true, employerProfile: { select: { companyName: true } } } });
  await prisma.$transaction(async (tx) => {
    await tx.hiringRequest.update({ where: { id: requestId }, data: { sentAt: request.sentAt ?? now, ...(['AGREED', 'SOURCING'].includes(request.status) ? { status: 'SHORTLIST_SENT' } : {}) } });
    await event(tx, { requestId, actor, kind: 'DELIVERY', visibility: 'CLIENT', body: `Our shortlist is ready: ${shortlisted} ${shortlisted === 1 ? 'candidate' : 'candidates'}. Each one agreed to be put forward.` });
    await audit(tx, actor, 'SHORTLIST_SENT', 'HiringRequest', requestId, { shortlisted });
    await createNotification(tx, { userId: request.clientId, type: 'HIRING_SHORTLIST_READY', title: `Your shortlist is ready: ${request.roleTitle}`, message: `${shortlisted} ${shortlisted === 1 ? 'candidate is' : 'candidates are'} waiting for your decision.`, actionUrl: `/hiring-service/${requestId}` });
  });
  if (client?.email) void mail(sendHiringShortlistEmail(client.email, { company: client.employerProfile?.companyName ?? 'your company', role: request.roleTitle, count: shortlisted, url: `${env.frontendBaseUrl}/hiring-service/${requestId}` }));
  return { shortlisted };
};

export const addNote = async (actor: Actor, requestId: string, input: { body: string; visibility: 'STAFF' | 'CLIENT' }) => {
  await staffRequest(actor, requestId);
  await event(prisma, { requestId, actor, kind: 'NOTE', body: input.body.trim(), visibility: input.visibility });
};

/** After a hire, staff can correct the start date; the guarantee end date follows it. */
export const setHireStartDate = async (actor: Actor, requestId: string, candidateId: string, startDate: string) => {
  const request = await staffRequest(actor, requestId);
  const candidate = await prisma.hiringCandidate.findFirst({ where: { id: candidateId, requestId, stage: 'HIRED' } });
  if (!candidate) throw new BillingError(404, 'NOT_HIRED', 'That person is not marked as hired.');
  const start = parseDate(startDate, 'start date') as Date;
  const ends = guaranteeEnd(start, request.guaranteeDays);

  await prisma.$transaction(async (tx) => {
    await tx.hiringCandidate.update({ where: { id: candidateId }, data: { startDate: start } });
    if (request.status === 'FILLED') await tx.hiringRequest.update({ where: { id: requestId }, data: { guaranteeEndsAt: ends, guaranteeReminderSentAt: null } });
    await event(tx, { requestId, candidateId, actor, kind: 'STATUS', visibility: 'CLIENT', body: `Start date recorded: ${day(start)}. The replacement guarantee ends on ${day(ends)}.` });
    await audit(tx, actor, 'HIRE_START_DATE_SET', 'HiringCandidate', candidateId, { requestId, startDate: day(start), guaranteeEndsAt: day(ends) });
  });
};

// ------------------------------------------------------------------ admin: the deal, payments, people

export const updateTerms = async (admin: Actor, requestId: string, input: { feeGhs?: number | null; depositGhs?: number | null; guaranteeDays?: number }) => {
  const request = await loadRequest(requestId);
  if (admin.role !== 'ADMIN') throw new BillingError(403, 'ADMIN_ONLY', 'Only an admin can change the terms.');
  if (request.status === 'CANCELLED') throw new BillingError(409, 'CLOSED', 'This request is cancelled.');

  const fee = input.feeGhs === undefined ? request.feePesewas : input.feeGhs === null ? null : ghsToPesewas(input.feeGhs);
  const deposit = input.depositGhs === undefined ? request.depositPesewas : input.depositGhs === null ? null : ghsToPesewas(input.depositGhs);
  if (fee !== null && deposit !== null && deposit > fee) throw new BillingError(400, 'DEPOSIT_TOO_BIG', 'The deposit cannot be more than the fee.');
  const guaranteeDays = input.guaranteeDays ?? request.guaranteeDays;
  // Agreeing a fee on a new request moves it to Agreed, and the employer is told what was agreed.
  const agreeNow = request.status === 'NEW' && fee !== null;

  await prisma.$transaction(async (tx) => {
    await tx.hiringRequest.update({
      where: { id: requestId },
      data: {
        feePesewas: fee,
        depositPesewas: deposit,
        guaranteeDays,
        ...(agreeNow ? { status: 'AGREED' } : {}),
        // A different guarantee length moves the end date of a request that is already filled.
        ...(request.status === 'FILLED' && request.guaranteeEndsAt && guaranteeDays !== request.guaranteeDays ? { guaranteeEndsAt: new Date(request.guaranteeEndsAt.getTime() + (guaranteeDays - request.guaranteeDays) * 86_400_000), guaranteeReminderSentAt: null } : {}),
      },
    });
    await event(tx, { requestId, actor: admin, kind: 'TERMS', visibility: 'CLIENT', body: `Terms updated${fee !== null ? `: fee ${formatGhs(fee)}${deposit ? `, deposit ${formatGhs(deposit)}` : ''}` : ''}. Replacement guarantee: ${guaranteeDays} days.${agreeNow ? ' Request agreed.' : ''}` });
    await audit(tx, admin, 'HIRING_TERMS_CHANGED', 'HiringRequest', requestId, { before: { fee: request.feePesewas, deposit: request.depositPesewas, guaranteeDays: request.guaranteeDays }, after: { fee, deposit, guaranteeDays } });
  });
  if (agreeNow) await notifyClient(request, `${request.reference}: agreed`, `We have agreed the terms for ${request.roleTitle}: a fee of ${formatGhs(fee as number)}.`);
};

export const recordPayment = async (admin: Actor, requestId: string, input: { kind: string; amountGhs: number; paidAt: string; method?: string | null; reference?: string | null; note?: string | null }) => {
  const request = await loadRequest(requestId);
  if (admin.role !== 'ADMIN') throw new BillingError(403, 'ADMIN_ONLY', 'Only an admin can record payments.');
  const amount = ghsToPesewas(input.amountGhs);
  if (!amount) throw new BillingError(400, 'BAD_AMOUNT', 'Enter an amount above zero.');
  const paidAt = parseDate(input.paidAt, 'payment date') as Date;

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.hiringPayment.create({ data: { requestId, kind: input.kind, amountPesewas: amount, paidAt, method: textOf(input.method) || null, reference: textOf(input.reference) || null, note: textOf(input.note) || null, recordedById: admin.id } });
    await event(tx, { requestId, actor: admin, kind: 'PAYMENT', visibility: 'STAFF', body: `Recorded a ${input.kind.toLowerCase()} payment of ${formatGhs(amount)} on ${day(paidAt)}.` });
    await audit(tx, admin, 'HIRING_PAYMENT_RECORDED', 'HiringRequest', requestId, { kind: input.kind, amountPesewas: amount, paidAt: day(paidAt), reference: request.reference });
    return created;
  });
  return { id: payment.id };
};

export const removePayment = async (admin: Actor, requestId: string, paymentId: string, reason: string) => {
  if (admin.role !== 'ADMIN') throw new BillingError(403, 'ADMIN_ONLY', 'Only an admin can change payments.');
  const payment = await prisma.hiringPayment.findFirst({ where: { id: paymentId, requestId } });
  if (!payment) throw new BillingError(404, 'NOT_FOUND', 'No such payment.');
  await prisma.$transaction(async (tx) => {
    await tx.hiringPayment.delete({ where: { id: paymentId } });
    await event(tx, { requestId, actor: admin, kind: 'PAYMENT', visibility: 'STAFF', body: `Removed a recorded payment of ${formatGhs(payment.amountPesewas)}: ${reason}` });
    await audit(tx, admin, 'HIRING_PAYMENT_REMOVED', 'HiringRequest', requestId, { amountPesewas: payment.amountPesewas, reason });
  });
};

export const assignRecruiter = async (admin: Actor, requestId: string, recruiterId: string, now = new Date()) => {
  const request = await loadRequest(requestId);
  if (!OPEN_STATUSES.includes(request.status) && request.status !== 'FILLED') throw new BillingError(409, 'NOT_OPEN', 'This request is closed.');
  const recruiter = await prisma.user.findFirst({ where: { id: recruiterId, role: 'RECRUITER', status: 'ACTIVE' }, select: { id: true } });
  const profile = await prisma.staffProfile.findFirst({ where: { userId: recruiterId, active: true } });
  if (!recruiter || !profile) throw new BillingError(404, 'RECRUITER_NOT_FOUND', 'Choose an active recruiter.');

  await prisma.$transaction(async (tx) => {
    await tx.hiringRequest.update({ where: { id: requestId }, data: { assignedRecruiterId: recruiterId, assignedAt: now } });
    await event(tx, { requestId, actor: admin, kind: 'ASSIGNMENT', visibility: 'CLIENT', body: `${profile.displayName} is now your recruiter.` });
    await audit(tx, admin, 'HIRING_RECRUITER_ASSIGNED', 'HiringRequest', requestId, { recruiterId, previous: request.assignedRecruiterId });
    await createNotification(tx, { userId: recruiterId, type: 'HIRING_ASSIGNED', title: `New request: ${request.roleTitle}`, message: `${request.reference} is yours.`, actionUrl: `/recruiter/requests/${requestId}` });
    await createNotification(tx, { userId: request.clientId, type: 'HIRING_ASSIGNED', title: `${profile.displayName} is working on your request`, message: `${request.reference}: ${request.roleTitle}.`, actionUrl: `/hiring-service/${requestId}` });
  });
};

export const listStaff = async () => {
  const rows = await prisma.staffProfile.findMany({ orderBy: { displayName: 'asc' } });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((row) => row.userId) } }, select: { id: true, email: true, status: true } });
  const open = await prisma.hiringRequest.groupBy({ by: ['assignedRecruiterId'], where: { assignedRecruiterId: { in: rows.map((row) => row.userId) }, status: { in: [...OPEN_STATUSES] } }, _count: { _all: true } });
  return rows.map((row) => ({
    userId: row.userId,
    displayName: row.displayName,
    title: row.title,
    phone: row.phone,
    active: row.active,
    email: users.find((user) => user.id === row.userId)?.email ?? null,
    openRequests: open.find((item) => item.assignedRecruiterId === row.userId)?._count._all ?? 0,
  }));
};

/** Creates a recruiter account (never by sign-up). They get an email to choose their own password. */
export const createRecruiter = async (admin: Actor, input: { email: string; displayName: string; title?: string | null; phone?: string | null }) => {
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new BillingError(409, 'EMAIL_TAKEN', 'There is already an account with that email.');
  const token = crypto.randomBytes(32).toString('hex');

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { email, password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10), role: 'RECRUITER', emailVerified: true, status: 'ACTIVE' } });
    await tx.staffProfile.create({ data: { userId: created.id, displayName: input.displayName.trim(), title: textOf(input.title) || null, phone: textOf(input.phone) || null } });
    await tx.passwordResetToken.create({ data: { token, userId: created.id, expiresAt: new Date(Date.now() + 3 * 86_400_000) } });
    await audit(tx, admin, 'RECRUITER_CREATED', 'User', created.id, { displayName: input.displayName.trim() });
    return created;
  });
  void mail(sendPasswordResetEmail(email, token));
  return { userId: user.id };
};

export const setRecruiterActive = async (admin: Actor, userId: string, active: boolean) => {
  const profile = await prisma.staffProfile.findUnique({ where: { userId } });
  if (!profile) throw new BillingError(404, 'NOT_FOUND', 'No such recruiter.');
  await prisma.$transaction(async (tx) => {
    await tx.staffProfile.update({ where: { userId }, data: { active } });
    // A suspended account cannot sign in, and any open session is ended.
    await tx.user.update({ where: { id: userId }, data: { status: active ? 'ACTIVE' : 'SUSPENDED', ...(active ? {} : { tokenVersion: { increment: 1 } }) } });
    await audit(tx, admin, active ? 'RECRUITER_REACTIVATED' : 'RECRUITER_DEACTIVATED', 'User', userId);
  });
};

// ------------------------------------------------------------------ the daily check

/**
 * A week before a replacement guarantee ends, staff are reminded by email and in the app, once. Safe to run any number of times:
 * the reminder is claimed with one conditional update.
 */
export const runGuaranteeReminders = async (now = new Date()) => {
  const horizon = new Date(now.getTime() + 7 * 86_400_000);
  const rows = await prisma.hiringRequest.findMany({ where: { status: 'FILLED', guaranteeReminderSentAt: null, guaranteeEndsAt: { gt: now, lte: horizon } }, take: 200 });
  let reminded = 0;
  for (const request of rows) {
    if (!guaranteeReminderDue(request, now)) continue;
    try {
      const claimed = await prisma.hiringRequest.updateMany({ where: { id: request.id, guaranteeReminderSentAt: null }, data: { guaranteeReminderSentAt: now } });
      if (claimed.count !== 1) continue;
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true, email: true } });
      const recruiter = request.assignedRecruiterId ? await prisma.user.findUnique({ where: { id: request.assignedRecruiterId }, select: { id: true, email: true } }) : null;
      const company = await prisma.employerProfile.findUnique({ where: { userId: request.clientId }, select: { companyName: true } });
      const people = [...admins, ...(recruiter ? [recruiter] : [])];
      const ends = day(request.guaranteeEndsAt as Date);
      for (const person of people) {
        await createNotification(prisma, { userId: person.id, type: 'HIRING_GUARANTEE_ENDING', title: `${request.reference}: guarantee ends ${ends}`, message: `The replacement guarantee for ${request.roleTitle} ends in a week.`, actionUrl: person.id === recruiter?.id ? `/recruiter/requests/${request.id}` : '/dashboard' });
        if (person.email) void mail(sendGuaranteeReminderEmail(person.email, { reference: request.reference, role: request.roleTitle, company: company?.companyName ?? 'the employer', endsOn: ends, url: `${env.frontendBaseUrl}/recruiter/requests/${request.id}` }));
      }
      await event(prisma, { requestId: request.id, kind: 'STATUS', visibility: 'STAFF', body: `Reminder sent: the replacement guarantee ends on ${ends}.` });
      reminded += 1;
    } catch (error) {
      logger.error('guarantee_reminder_failed', { requestId: request.id, error: getErrorMessage(error) });
    }
  }
  return { reminded };
};

export const runGuaranteeRemindersSafely = async () => {
  try {
    const result = await runGuaranteeReminders();
    if (result.reminded) logger.info('guarantee_reminders_done', result);
  } catch (error) {
    logger.error('guarantee_reminders_error', { error: getErrorMessage(error) });
  }
};
