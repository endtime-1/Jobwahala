import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const m = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const mock: Record<string, any> = {
    subscription: m('findMany'),
    product: m('findFirst', 'findUnique'),
    teamMember: m('findFirst'),
    verificationRequest: m('findFirst'),
    jobSeekerProfile: m('findMany', 'findFirst'),
    cvUnlock: m('findMany', 'findUnique', 'count', 'create', 'delete'),
    cvProfileView: m('create', 'findMany'),
    cvBlock: m('findMany', 'upsert', 'deleteMany'),
    savedCandidateSearch: m('findMany', 'count', 'create', 'update', 'updateMany', 'deleteMany'),
    candidateInvite: m('findUnique', 'create'),
    employerProfile: m('findUnique'),
    job: m('findFirst'),
    user: m('findFirst', 'findUnique'),
    seekerCv: m('findFirst'),
    application: m('findFirst'),
    notification: m('create'),
  };
  return mock;
});

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));
const mailMock = vi.hoisted(() => ({ sendCandidateAlertEmail: vi.fn() }));
vi.mock('../../services/emailService', () => ({ sendCandidateAlertEmail: mailMock.sendCandidateAlertEmail, sendTeamInviteEmail: vi.fn() }));

import { searchCvDatabase, unlockProfile } from '../../controllers/cvDatabaseController';
import { canViewUpload } from '../../services/fileAccessService';
import {
  blockCompany,
  createSavedSearch,
  getMyCvActivity,
  inviteCandidate,
  runCandidateAlerts,
  searchCandidates,
  unblockCompany,
  unlockCandidate,
  viewCandidate,
} from '../../services/cvDatabaseService';
import env from '../../config/env';
import { parseUploadRef, uploaderTag } from '../../utils/fileAccess';
import { MAX_PAGES, PAGE_SIZE, cleanFilters, levelsFrom, monthStart, scrubContact, summarise } from '../../utils/cvDatabase';
import { getProfileUpdateSchema } from '../../validation/profileSchemas';
import { registerSchema } from '../../validation/authSchemas';

const DAY = 86_400_000;
const NOW = new Date('2026-11-10T10:00:00.000Z');
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

const business = { id: 'biz-m', name: 'Business (monthly)', planTier: 'BUSINESS', interval: 'MONTHLY', pricePesewas: 45000, teamLimit: 10, cvDatabase: true, monthlyUnlocks: 3, brandedPage: true, hiringReports: true, topEmployers: true, featuredCredits: 6, boostCredits: 3 };
const liveSubscription = { id: 'sub-1', userId: 'emp-1', status: 'ACTIVE', currentPeriodEnd: days(20), graceEndsAt: null, cancelAtPeriodEnd: false, pendingProductId: null, productId: 'biz-m', createdAt: NOW, product: business };

const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  userId: `u-${id}`,
  headline: 'Accountant',
  skills: 'Excel, bookkeeping',
  experience: 'Three years in accounts. Call me on 0244123456 or ama@example.com',
  location: 'Accra',
  educationLevel: 'BACHELORS',
  availability: 'IMMEDIATELY',
  yearsExperience: 3,
  jobCategory: 'Finance',
  lastActiveAt: days(-1),
  cvVisibleSince: days(-5),
  profileBoostedUntil: null,
  user: { learnerCourses: [] },
  ...overrides,
});

const asBusinessVerified = () => {
  prismaMock.subscription.findMany.mockResolvedValue([liveSubscription]);
  prismaMock.verificationRequest.findFirst.mockResolvedValue({ id: 'v1' });
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.subscription.findMany.mockResolvedValue([]);
  prismaMock.product.findFirst.mockResolvedValue(null);
  prismaMock.verificationRequest.findFirst.mockResolvedValue(null);
  prismaMock.teamMember.findFirst.mockResolvedValue(null);
  prismaMock.jobSeekerProfile.findMany.mockResolvedValue([]);
  prismaMock.cvUnlock.findMany.mockResolvedValue([]);
  prismaMock.cvUnlock.count.mockResolvedValue(0);
  prismaMock.cvUnlock.findUnique.mockResolvedValue(null);
  prismaMock.cvUnlock.create.mockResolvedValue({});
  prismaMock.cvProfileView.create.mockResolvedValue({});
  prismaMock.notification.create.mockResolvedValue({ id: 'n1' });
  prismaMock.employerProfile.findUnique.mockResolvedValue({ companyName: 'Acme Ltd' });
  mailMock.sendCandidateAlertEmail.mockResolvedValue(undefined);
});

describe('the helpers', () => {
  it('remove emails, phone numbers and links from free text before an employer sees it', () => {
    expect(scrubContact('Reach me: ama@example.com, +233 24 412 3456 or www.ama.dev and https://x.example/cv')).toBe('Reach me: [hidden], [hidden] or [hidden] and [hidden]');
    expect(summarise('a'.repeat(300), 50)).toHaveLength(50);
    expect(summarise(null, 50)).toBe('');
  });

  it('"at least" education levels, month boundaries and clean filters', () => {
    expect(levelsFrom('DIPLOMA')).toEqual(['DIPLOMA', 'BACHELORS', 'MASTERS', 'DOCTORATE']);
    expect(monthStart(new Date('2026-11-30T23:00:00Z')).toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(cleanFilters({ skills: ' excel ', location: '', minYears: '2', certificate: 'true', activeWithinDays: '30' })).toEqual({ skills: 'excel', minYears: 2, certificate: true, activeWithinDays: 30 });
    expect(() => cleanFilters({ activeWithinDays: '12' })).toThrow();
    expect(() => cleanFilters({ availability: 'SOMETIME' })).toThrow();
  });

  it('the seeker chooses Hidden or Visible at sign-up and in settings, and other values are refused', () => {
    expect(registerSchema.safeParse({ body: { email: 'a@b.com', password: 'Passw0rd!x', cvVisibility: 'VERIFIED_EMPLOYERS' } }).success).toBe(true);
    expect(registerSchema.safeParse({ body: { email: 'a@b.com', password: 'Passw0rd!x', cvVisibility: 'EVERYONE' } }).success).toBe(false);
    const parse = (body: unknown) => getProfileUpdateSchema('SEEKER').safeParse({ body }).success;
    expect(parse({ cvVisibility: 'HIDDEN', headline: 'Accountant', educationLevel: 'DIPLOMA', availability: 'NSS', yearsExperience: 4 })).toBe(true);
    expect(parse({ cvVisibility: 'PUBLIC' })).toBe(false);
    expect(parse({ availability: 'NEVER' })).toBe(false);
    expect(parse({ visibleToEmployers: true })).toBe(false);
  });
});

describe('who may search', () => {
  it('needs a plan with the CV database', async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValue({ id: 'v1' });

    await expect(searchCandidates('emp-1', {}, 1, NOW)).rejects.toMatchObject({ status: 403, code: 'PLAN_REQUIRED' });
  });

  it('needs a VERIFIED employer, even on the right plan', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([liveSubscription]);

    await expect(searchCandidates('emp-1', {}, 1, NOW)).rejects.toMatchObject({ status: 403, code: 'VERIFICATION_REQUIRED' });
    expect(prismaMock.verificationRequest.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 'emp-1', type: 'BUSINESS', status: 'APPROVED' });
    expect(prismaMock.jobSeekerProfile.findMany).not.toHaveBeenCalled();
  });

  it('a lapsed plan (grace over) loses access', async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValue({ id: 'v1' });
    prismaMock.subscription.findMany.mockResolvedValue([{ ...liveSubscription, status: 'PAST_DUE', currentPeriodEnd: days(-20), graceEndsAt: days(-1) }]);

    await expect(searchCandidates('emp-1', {}, 1, NOW)).rejects.toMatchObject({ code: 'PLAN_REQUIRED' });
  });
});

describe('searching', () => {
  beforeEach(asBusinessVerified);

  it('only looks at visible profiles of active seekers who have not blocked this company', async () => {
    await searchCandidates('emp-1', {}, 1, NOW);

    expect(prismaMock.jobSeekerProfile.findMany.mock.calls[0][0].where).toMatchObject({ cvVisibility: 'VERIFIED_EMPLOYERS', user: { status: 'ACTIVE', role: 'SEEKER', cvBlocksMade: { none: { employerId: 'emp-1' } } } });
  });

  it('applies the filters: years, education (or higher), availability, last active, verified certificate', async () => {
    await searchCandidates('emp-1', { minYears: 2, education: 'DIPLOMA', availability: 'NSS', activeWithinDays: 30, certificate: true }, 1, NOW);

    const where = prismaMock.jobSeekerProfile.findMany.mock.calls[0][0].where;
    expect(where.yearsExperience).toEqual({ gte: 2 });
    expect(where.educationLevel).toEqual({ in: ['DIPLOMA', 'BACHELORS', 'MASTERS', 'DOCTORATE'] });
    expect(where.availability).toBe('NSS');
    expect(where.lastActiveAt.gte.getTime()).toBe(NOW.getTime() - 30 * DAY);
    expect(where.user.learnerCourses).toEqual({ some: { status: 'CONFIRMED', certificateUrl: { not: null } } });
    expect(where.user.cvBlocksMade).toEqual({ none: { employerId: 'emp-1' } });
  });

  it('matches skills (every word), location and job category without caring about case', async () => {
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([row('a'), row('b', { skills: 'Welding', headline: 'Welder', experience: 'Workshop', location: 'Kumasi', jobCategory: 'Trades' })]);

    expect((await searchCandidates('emp-1', { skills: 'EXCEL bookkeeping' }, 1, NOW)).entries.map((entry) => entry.id)).toEqual(['a']);
    expect((await searchCandidates('emp-1', { location: 'kumasi' }, 1, NOW)).entries.map((entry) => entry.id)).toEqual(['b']);
    expect((await searchCandidates('emp-1', { category: 'FINANCE' }, 1, NOW)).entries.map((entry) => entry.id)).toEqual(['a']);
    expect((await searchCandidates('emp-1', { skills: 'excel welding' }, 1, NOW)).entries).toEqual([]);
  });

  it('results are limited profiles: no name, phone, email or CV, and contact details typed into free text are hidden', async () => {
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([row('a')]);

    const { entries } = await searchCandidates('emp-1', {}, 1, NOW);

    expect(Object.keys(entries[0]).sort()).toEqual(['availability', 'boosted', 'educationLevel', 'experienceSummary', 'hasVerifiedCertificate', 'headline', 'id', 'jobCategory', 'lastActiveAt', 'location', 'skills', 'unlocked', 'yearsExperience']);
    expect(entries[0].experienceSummary).toBe('Three years in accounts. Call me on [hidden] or [hidden]');
    expect(JSON.stringify(entries)).not.toMatch(/ama@|0244|u-a|firstName|phone|cv/i);
  });

  it('boosted profiles come first and are marked, expired boosts are not', async () => {
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([row('plain'), row('expired', { profileBoostedUntil: days(-1) }), row('boosted', { profileBoostedUntil: days(5) })]);

    const { entries } = await searchCandidates('emp-1', {}, 1, NOW);

    expect(entries.map((entry) => [entry.id, entry.boosted])).toEqual([['boosted', true], ['plain', false], ['expired', false]]);
  });

  it('shows which profiles this company already unlocked, and how many unlocks are left this month', async () => {
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([row('a'), row('b')]);
    prismaMock.cvUnlock.findMany.mockResolvedValue([{ seekerId: 'u-a' }]);
    prismaMock.cvUnlock.count.mockResolvedValue(1);

    const result = await searchCandidates('emp-1', {}, 1, NOW);

    expect(result.entries.map((entry) => entry.unlocked)).toEqual([true, false]);
    expect(result.allowance).toMatchObject({ limit: 3, used: 1, remaining: 2 });
    expect(result.allowance.resetsOn.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('cannot be paged deeper than the cap, so the database cannot be copied out', async () => {
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue(Array.from({ length: 500 }, (_, i) => row(`p${i}`)));

    const result = await searchCandidates('emp-1', {}, 99, NOW);

    expect(result.page).toBe(MAX_PAGES);
    expect(result.total).toBe(MAX_PAGES * PAGE_SIZE);
    expect(result.entries).toHaveLength(PAGE_SIZE);
    expect(result.entries[0].id).toBe(`p${(MAX_PAGES - 1) * PAGE_SIZE}`);
  });

  it('the controller turns query strings into filters and answers plan errors plainly', async () => {
    const out: { status: number; body: any } = { status: 200, body: null };
    const res = { status: (code: number) => ((out.status = code), res), json: (body: unknown) => ((out.body = body), res) } as unknown as Response;

    await searchCvDatabase({ user: { id: 'emp-1', role: 'EMPLOYER' }, query: { skills: 'excel', page: '1', availability: 'NSS' } } as never, res);
    expect(out.body.success).toBe(true);
    expect(prismaMock.jobSeekerProfile.findMany.mock.calls[0][0].where.availability).toBe('NSS');

    prismaMock.verificationRequest.findFirst.mockResolvedValue(null);
    await searchCvDatabase({ user: { id: 'emp-1', role: 'EMPLOYER' }, query: {} } as never, res);
    expect(out.status).toBe(403);
    expect(out.body.code).toBe('VERIFICATION_REQUIRED');
  });
});

describe('opening and unlocking a profile', () => {
  const profile = { ...row('a'), firstName: 'Ama', lastName: 'Mensah', user: { email: 'ama@example.com', phone: '+233244123456', learnerCourses: [], seekerCv: { uploadedUrl: '/api/uploads/cv/a.pdf', uploadedFileName: 'cv.pdf', builderUrl: null, builderFileName: null } } };

  beforeEach(() => {
    asBusinessVerified();
    prismaMock.jobSeekerProfile.findFirst.mockResolvedValue(profile);
  });

  it('opening records the view once a day and still hides name, email, phone and CV', async () => {
    const result = await viewCandidate('emp-1', 'a', NOW);

    expect(prismaMock.cvProfileView.create).toHaveBeenCalledWith({ data: { employerId: 'emp-1', seekerId: 'u-a', day: '2026-11-10' } });
    expect(result.contact).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/Ama|Mensah|ama@example|0244123456|cv\.pdf/);

    prismaMock.cvProfileView.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(viewCandidate('emp-1', 'a', NOW)).resolves.toBeTruthy();
  });

  it('a hidden, deleted or blocking profile is simply not found', async () => {
    prismaMock.jobSeekerProfile.findFirst.mockResolvedValue(null);

    await expect(viewCandidate('emp-1', 'a', NOW)).rejects.toMatchObject({ status: 404, code: 'CANDIDATE_NOT_FOUND' });
    expect(prismaMock.jobSeekerProfile.findFirst.mock.calls[0][0].where).toMatchObject({ cvVisibility: 'VERIFIED_EMPLOYERS', user: { cvBlocksMade: { none: { employerId: 'emp-1' } } } });
  });

  it('unlocking uses one of the monthly unlocks, is logged with the employer, person and who clicked, and shows the contact details', async () => {
    prismaMock.cvUnlock.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValue(3);
    prismaMock.cvUnlock.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ id: 'ul1' });

    const result = await unlockCandidate('emp-1', 'member-9', 'a', NOW);

    expect(prismaMock.cvUnlock.create).toHaveBeenCalledWith({ data: { employerId: 'emp-1', seekerId: 'u-a', actorId: 'member-9' } });
    expect(result.alreadyUnlocked).toBe(false);
    expect(result.contact).toEqual({ name: 'Ama Mensah', email: 'ama@example.com', phone: '+233244123456', cv: { url: '/api/uploads/cv/a.pdf', fileName: 'cv.pdf' } });
    expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-a', type: 'CV_UNLOCKED' });
  });

  it('the owner unlocking themselves is logged without a separate actor', async () => {
    prismaMock.cvUnlock.count.mockResolvedValue(1);
    prismaMock.cvUnlock.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ id: 'ul1' });

    await unlockCandidate('emp-1', 'emp-1', 'a', NOW);

    expect(prismaMock.cvUnlock.create.mock.calls[0][0].data.actorId).toBeNull();
  });

  it('refuses when the plan allowance for the month is used up, and says when it renews', async () => {
    prismaMock.cvUnlock.count.mockResolvedValue(3);

    await expect(unlockCandidate('emp-1', undefined, 'a', NOW)).rejects.toMatchObject({ status: 403, code: 'NO_UNLOCKS_LEFT', message: expect.stringContaining('2026-12-01') });
    expect(prismaMock.cvUnlock.create).not.toHaveBeenCalled();
  });

  it('unlocking someone again is free', async () => {
    prismaMock.cvUnlock.findUnique.mockResolvedValue({ id: 'ul1' });
    prismaMock.cvUnlock.count.mockResolvedValue(3);

    const result = await unlockCandidate('emp-1', undefined, 'a', NOW);

    expect(result.alreadyUnlocked).toBe(true);
    expect(prismaMock.cvUnlock.create).not.toHaveBeenCalled();
    expect(result.contact?.email).toBe('ama@example.com');
  });

  it('two unlocks racing past the limit: the one over is taken back', async () => {
    prismaMock.cvUnlock.count.mockResolvedValueOnce(2).mockResolvedValueOnce(4);

    await expect(unlockCandidate('emp-1', undefined, 'a', NOW)).rejects.toMatchObject({ code: 'NO_UNLOCKS_LEFT' });
    expect(prismaMock.cvUnlock.delete).toHaveBeenCalled();
  });

  it('a plan with no unlocks included cannot unlock', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([{ ...liveSubscription, product: { ...business, monthlyUnlocks: 0 } }]);

    await expect(unlockCandidate('emp-1', undefined, 'a', NOW)).rejects.toMatchObject({ code: 'NO_UNLOCKS_LEFT' });
  });

  it('the controller answers 201 for a new unlock', async () => {
    prismaMock.cvUnlock.count.mockResolvedValue(1);
    prismaMock.cvUnlock.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ id: 'ul1' });
    const out: { status: number } = { status: 200 };
    const res = { status: (code: number) => ((out.status = code), res), json: () => res } as unknown as Response;

    await unlockProfile({ user: { id: 'emp-1', role: 'EMPLOYER' }, params: { id: 'a' } } as never, res);

    expect(out.status).toBe(201);
  });
});

describe('inviting a candidate to apply', () => {
  beforeEach(() => {
    asBusinessVerified();
    prismaMock.jobSeekerProfile.findFirst.mockResolvedValue(row('a'));
    prismaMock.job.findFirst.mockResolvedValue({ id: 'job-1', title: 'Accountant' });
    prismaMock.candidateInvite.findUnique.mockResolvedValue(null);
    prismaMock.candidateInvite.create.mockResolvedValue({});
  });

  it('records the invitation and sends the candidate a notification with the job link', async () => {
    await inviteCandidate('emp-1', 'a', 'job-1', 'We liked your profile', NOW);

    expect(prismaMock.candidateInvite.create).toHaveBeenCalledWith({ data: { employerId: 'emp-1', seekerId: 'u-a', jobId: 'job-1', message: 'We liked your profile' } });
    expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-a', type: 'CANDIDATE_INVITE', title: 'Acme Ltd invited you to apply', actionUrl: '/jobs/job-1' });
    expect(prismaMock.job.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'job-1', employerId: 'emp-1', status: 'ACTIVE' });
  });

  it('only for the company\'s own open jobs, and only once per job', async () => {
    prismaMock.job.findFirst.mockResolvedValue(null);
    await expect(inviteCandidate('emp-1', 'a', 'someone-elses', undefined, NOW)).rejects.toMatchObject({ code: 'JOB_REQUIRED' });

    prismaMock.job.findFirst.mockResolvedValue({ id: 'job-1', title: 'Accountant' });
    prismaMock.candidateInvite.findUnique.mockResolvedValue({ id: 'i1' });
    await expect(inviteCandidate('emp-1', 'a', 'job-1', undefined, NOW)).rejects.toMatchObject({ status: 409, code: 'ALREADY_INVITED' });
  });

  it('a person who blocked the company cannot be invited', async () => {
    prismaMock.jobSeekerProfile.findFirst.mockResolvedValue(null);

    await expect(inviteCandidate('emp-1', 'a', 'job-1', undefined, NOW)).rejects.toMatchObject({ code: 'CANDIDATE_NOT_FOUND' });
    expect(prismaMock.candidateInvite.create).not.toHaveBeenCalled();
  });
});

describe('saved searches and email alerts', () => {
  beforeEach(asBusinessVerified);

  it('saves cleaned filters, up to 20', async () => {
    prismaMock.savedCandidateSearch.count.mockResolvedValue(0);
    prismaMock.savedCandidateSearch.create.mockImplementation(async ({ data }: any) => ({ id: 's1', ...data }));

    await createSavedSearch('emp-1', { name: 'Accra accountants', filters: { skills: ' excel ', location: '' }, alertsEnabled: true });
    expect(JSON.parse(prismaMock.savedCandidateSearch.create.mock.calls[0][0].data.filtersJson)).toEqual({ skills: 'excel' });

    prismaMock.savedCandidateSearch.count.mockResolvedValue(20);
    await expect(createSavedSearch('emp-1', { name: 'One more', filters: {}, alertsEnabled: false })).rejects.toMatchObject({ code: 'TOO_MANY_SEARCHES' });
  });

  const search = (overrides: Record<string, unknown> = {}) => ({ id: 's1', employerId: 'emp-1', name: 'Accra accountants', filtersJson: '{"skills":"excel"}', alertsEnabled: true, lastAlertAt: days(-2), createdAt: days(-9), employer: { email: 'hr@acme.example', status: 'ACTIVE' }, ...overrides });

  it('emails a count (never names) when new matching people became visible since the last alert', async () => {
    prismaMock.savedCandidateSearch.findMany.mockResolvedValue([search()]);
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([row('a'), row('b')]);

    const result = await runCandidateAlerts(NOW);

    expect(result.sent).toBe(1);
    expect(prismaMock.jobSeekerProfile.findMany.mock.calls[0][0].where.cvVisibleSince).toEqual({ gt: days(-2) });
    expect(mailMock.sendCandidateAlertEmail).toHaveBeenCalledWith('hr@acme.example', expect.objectContaining({ searchName: 'Accra accountants', count: 2 }));
    expect(JSON.stringify(mailMock.sendCandidateAlertEmail.mock.calls)).not.toMatch(/Ama|ama@/);
    expect(prismaMock.savedCandidateSearch.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { lastAlertAt: NOW } });
  });

  it('sends nothing when there is nobody new, when alerted less than a day ago, or when the company lost access', async () => {
    prismaMock.savedCandidateSearch.findMany.mockResolvedValue([search()]);
    expect((await runCandidateAlerts(NOW)).sent).toBe(0);

    prismaMock.savedCandidateSearch.findMany.mockResolvedValue([search({ lastAlertAt: new Date(NOW.getTime() - 3_600_000) })]);
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([row('a')]);
    expect((await runCandidateAlerts(NOW)).sent).toBe(0);

    prismaMock.savedCandidateSearch.findMany.mockResolvedValue([search()]);
    prismaMock.verificationRequest.findFirst.mockResolvedValue(null);
    expect((await runCandidateAlerts(NOW)).sent).toBe(0);
    expect(mailMock.sendCandidateAlertEmail).not.toHaveBeenCalled();
  });
});

describe('the job seeker\'s side', () => {
  it('lists which companies unlocked or viewed their profile, newest first, and who is blocked', async () => {
    const company = (name: string | null) => ({ employerProfile: name ? { companyName: name } : null });
    prismaMock.cvProfileView.findMany.mockResolvedValue([{ employerId: 'e1', createdAt: days(-1), employer: company('Acme Ltd') }]);
    prismaMock.cvUnlock.findMany.mockResolvedValue([{ employerId: 'e2', createdAt: days(-2), employer: company('Beta Co') }]);
    prismaMock.cvBlock.findMany.mockResolvedValue([{ employerId: 'e3', createdAt: days(-3), employer: company(null) }]);

    const result = await getMyCvActivity('u-a');

    expect(result.activity.map((item) => [item.kind, item.company])).toEqual([['VIEWED', 'Acme Ltd'], ['UNLOCKED', 'Beta Co']]);
    expect(result.blocked).toEqual([{ employerId: 'e3', company: 'A company', at: days(-3) }]);
    expect(JSON.stringify(result)).not.toMatch(/email|phone/);
  });

  it('blocks and unblocks a company; only real employers can be blocked', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'e1' });
    await blockCompany('u-a', 'e1');
    expect(prismaMock.cvBlock.upsert).toHaveBeenCalledWith({ where: { seekerId_employerId: { seekerId: 'u-a', employerId: 'e1' } }, update: {}, create: { seekerId: 'u-a', employerId: 'e1' } });

    await unblockCompany('u-a', 'e1');
    expect(prismaMock.cvBlock.deleteMany).toHaveBeenCalledWith({ where: { seekerId: 'u-a', employerId: 'e1' } });

    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(blockCompany('u-a', 'nobody')).rejects.toMatchObject({ status: 404 });
  });
});

describe('opening the CV file', () => {
  const file = `1730000000000-u${uploaderTag('seeker-1', env.jwtSecret)}-3f2a9c1e-cv.pdf`;
  const ref = parseUploadRef(`/api/uploads/cv/${file}`)!;

  beforeEach(() => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    prismaMock.seekerCv.findFirst.mockResolvedValueOnce(null);
  });

  it('opens only for a company that unlocked that person, who is still visible and has not blocked the company', async () => {
    prismaMock.seekerCv.findFirst.mockResolvedValueOnce({ id: 'cv1' });

    expect(await canViewUpload({ id: 'emp-1', role: 'EMPLOYER' }, ref)).toBe(true);
    expect(prismaMock.seekerCv.findFirst.mock.calls[1][0].where.user).toEqual({
      status: 'ACTIVE',
      jobSeekerProfile: { is: { cvVisibility: 'VERIFIED_EMPLOYERS' } },
      cvUnlocksReceived: { some: { employerId: 'emp-1' } },
      cvBlocksMade: { none: { employerId: 'emp-1' } },
    });
  });

  it('searching alone does not open a CV: without an unlock the query finds nothing', async () => {
    prismaMock.seekerCv.findFirst.mockResolvedValueOnce(null);

    expect(await canViewUpload({ id: 'emp-1', role: 'EMPLOYER' }, ref)).toBe(false);
  });

  it('a team member opens it as the company', async () => {
    prismaMock.teamMember.findFirst.mockResolvedValue({ ownerId: 'emp-1' });
    prismaMock.seekerCv.findFirst.mockResolvedValueOnce({ id: 'cv1' });

    await canViewUpload({ id: 'member-1', role: 'EMPLOYER' }, ref);

    expect(prismaMock.seekerCv.findFirst.mock.calls[1][0].where.user.cvUnlocksReceived).toEqual({ some: { employerId: 'emp-1' } });
  });

  it('never for another job seeker', async () => {
    prismaMock.seekerCv.findFirst.mockResolvedValue({ id: 'cv1' });

    expect(await canViewUpload({ id: 'seeker-2', role: 'SEEKER' }, ref)).toBe(false);
  });
});
