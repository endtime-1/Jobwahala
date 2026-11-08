import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const m = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const mock: Record<string, any> = {
    user: m('create', 'findUnique', 'findMany', 'update'),
    employerProfile: m('create', 'findUnique', 'findMany', 'update', 'updateMany', 'count'),
    companyClaim: m('create', 'findMany', 'findUnique', 'update', 'updateMany'),
    emailVerificationToken: m('create'),
    billingSettings: m('findUnique', 'upsert'),
    creditAccount: m('upsert'),
    creditLedger: m('create'),
    job: m('count', 'findMany', 'groupBy'),
    application: m('count', 'findMany'),
    jobView: m('findMany'),
    employerWeeklyReport: m('findUnique', 'create', 'updateMany'),
    notification: m('create'),
    adminActionLog: m('create'),
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));

const mail = vi.hoisted(() => ({ sendCompanyClaimEmail: vi.fn(), sendVerificationEmail: vi.fn(), sendWeeklyReportEmail: vi.fn() }));
vi.mock('../../services/emailService', async (importOriginal) => ({ ...(await importOriginal<object>()), ...mail }));

import {
  acceptClaim,
  attachReferral,
  createManagedCompany,
  issueClaimLink,
  nextFoundingNumber,
  previewClaim,
  revokeClaimLink,
  rewardReferralForFirstJob,
  runWeeklyEmployerReports,
  setFoundingEmployer,
} from '../../services/acquisitionService';
import { adminRouterPaths } from './helpers';
import {
  buildWeeklyReport,
  claimMessage,
  claimState,
  claimUrl,
  hashToken,
  isReferralCode,
  lastWeek,
  newReferralCode,
  newToken,
  reportShareText,
  weekLabel,
  whatsappLink,
} from '../../utils/acquisition';

const DAY = 86_400_000;
const ADMIN = { id: 'admin-1', email: 'admin@jobwahala.com' };
const NOW = new Date('2026-11-10T09:00:00.000Z'); // a Tuesday

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.billingSettings.findUnique.mockResolvedValue({ foundingLimit: 50, foundingFeaturedCredits: 3 });
});

describe('claim links: the helpers', () => {
  it('makes long random tokens and stores only their hash', () => {
    const a = newToken();
    const b = newToken();
    expect(a).toHaveLength(64);
    expect(a).not.toBe(b);
    expect(hashToken(a)).toHaveLength(64);
    expect(hashToken(a)).not.toContain(a);
    expect(claimUrl('https://www.jobwahala.com/', a)).toBe(`https://www.jobwahala.com/claim/${a}`);
  });

  it('knows whether a link can still be used', () => {
    expect(claimState({ status: 'ACTIVE', expiresAt: new Date(NOW.getTime() + DAY) }, NOW)).toBe('ACTIVE');
    expect(claimState({ status: 'ACTIVE', expiresAt: new Date(NOW.getTime() - 1) }, NOW)).toBe('EXPIRED');
    expect(claimState({ status: 'REVOKED', expiresAt: new Date(NOW.getTime() + DAY) }, NOW)).toBe('REVOKED');
    expect(claimState({ status: 'CLAIMED', expiresAt: new Date(NOW.getTime() - DAY) }, NOW)).toBe('CLAIMED');
  });

  it('writes a WhatsApp message and a link that opens WhatsApp on the right number', () => {
    const text = claimMessage('Akoko Solutions', 'https://www.jobwahala.com/claim/abc');
    expect(text).toContain('Akoko Solutions');
    expect(text).toContain('https://www.jobwahala.com/claim/abc');
    const link = whatsappLink(text, '+233 24 123 4567');
    expect(link.startsWith('https://wa.me/233241234567?text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1])).toBe(text);
  });
});

describe('1. a company an admin sets up', () => {
  it('creates an employer account nobody can log in to, marked unclaimed and tied to the admin', async () => {
    prismaMock.user.create.mockResolvedValue({ id: 'co-1' });
    prismaMock.employerProfile.create.mockResolvedValue({ companyName: 'Akoko Solutions', claimStatus: 'UNCLAIMED' });

    const company = await createManagedCompany(ADMIN, { companyName: ' Akoko Solutions ', contactPhone: '0241234567' });

    expect(company).toEqual({ id: 'co-1', companyName: 'Akoko Solutions', claimStatus: 'UNCLAIMED' });
    const user = prismaMock.user.create.mock.calls[0][0].data;
    expect(user.role).toBe('EMPLOYER');
    expect(user.email).toBeUndefined(); // no email: it cannot be logged in to or reset
    expect(user.password).toMatch(/^\$2[aby]\$/); // a random hashed password nobody knows
    const profile = prismaMock.employerProfile.create.mock.calls[0][0].data;
    expect(profile).toMatchObject({ claimStatus: 'UNCLAIMED', createdByAdminId: 'admin-1', companyName: 'Akoko Solutions', contactPhone: '+233241234567' });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('COMPANY_CREATED_FOR_EMPLOYER');
  });
});

describe('2. sending, resending and revoking a claim link', () => {
  const unclaimed = { companyName: 'Akoko Solutions', claimStatus: 'UNCLAIMED', contactPhone: '+233241234567' };

  it('emails the link, keeping only its hash, and the link is not stored in plain text', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue(unclaimed);
    prismaMock.companyClaim.findMany.mockResolvedValue([]);
    prismaMock.companyClaim.create.mockImplementation(async ({ data }: any) => ({ id: 'claim-1', ...data }));

    const result = await issueClaimLink(ADMIN, 'co-1', { channel: 'EMAIL', email: 'Owner@Akoko.com' }, NOW);

    expect(result.emailed).toBe(true);
    expect(mail.sendCompanyClaimEmail).toHaveBeenCalledWith('owner@akoko.com', { company: 'Akoko Solutions', url: result.url });
    const token = result.url.split('/claim/')[1];
    const stored = prismaMock.companyClaim.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored.expiresAt.getTime()).toBe(NOW.getTime() + 14 * DAY);
    expect(stored.sentTo).toBe('owner@akoko.com');
  });

  it('gives the admin a ready WhatsApp message for the company number', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue(unclaimed);
    prismaMock.companyClaim.findMany.mockResolvedValue([]);
    prismaMock.companyClaim.create.mockImplementation(async ({ data }: any) => ({ id: 'claim-1', ...data }));

    const result = await issueClaimLink(ADMIN, 'co-1', { channel: 'WHATSAPP' }, NOW);

    expect(result.whatsappUrl?.startsWith('https://wa.me/233241234567?text=')).toBe(true);
    expect(decodeURIComponent(result.whatsappUrl!)).toContain(result.url);
    expect(mail.sendCompanyClaimEmail).not.toHaveBeenCalled();
  });

  it('on resend, cancels every earlier link first, so exactly one link works', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue(unclaimed);
    prismaMock.companyClaim.findMany.mockResolvedValue([{ sendCount: 1 }]);
    prismaMock.companyClaim.create.mockImplementation(async ({ data }: any) => ({ id: 'claim-2', ...data }));

    await issueClaimLink(ADMIN, 'co-1', { channel: 'LINK' }, NOW);

    expect(prismaMock.companyClaim.updateMany).toHaveBeenCalledWith({ where: { companyId: 'co-1', status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: NOW } });
    expect(prismaMock.companyClaim.create.mock.calls[0][0].data.sendCount).toBe(2);
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('CLAIM_LINK_RESENT');
  });

  it('refuses a company that its owner has already taken over, and an email or number that is missing', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ ...unclaimed, claimStatus: 'CLAIMED' });
    await expect(issueClaimLink(ADMIN, 'co-1', { channel: 'LINK' })).rejects.toMatchObject({ code: 'ALREADY_CLAIMED' });

    prismaMock.employerProfile.findUnique.mockResolvedValue({ ...unclaimed, contactPhone: null });
    await expect(issueClaimLink(ADMIN, 'co-1', { channel: 'EMAIL', email: '' })).rejects.toMatchObject({ code: 'EMAIL_REQUIRED' });
    await expect(issueClaimLink(ADMIN, 'co-1', { channel: 'WHATSAPP' })).rejects.toMatchObject({ code: 'PHONE_REQUIRED' });
  });

  it('revokes an active link, and not one that is already finished', async () => {
    prismaMock.companyClaim.findUnique.mockResolvedValue({ id: 'claim-1', companyId: 'co-1', status: 'ACTIVE' });
    await revokeClaimLink(ADMIN, 'claim-1');
    expect(prismaMock.companyClaim.update.mock.calls[0][0].data.status).toBe('REVOKED');

    prismaMock.companyClaim.findUnique.mockResolvedValue({ id: 'claim-1', companyId: 'co-1', status: 'CLAIMED' });
    await expect(revokeClaimLink(ADMIN, 'claim-1')).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
  });
});

describe('2. the owner opens the claim link', () => {
  const claim = (extra: Record<string, unknown> = {}) => ({ id: 'claim-1', companyId: 'co-1', status: 'ACTIVE', channel: 'EMAIL', sentTo: 'owner@akoko.com', expiresAt: new Date(NOW.getTime() + DAY), ...extra });

  it('shows the company and what is waiting, and nothing private', async () => {
    prismaMock.companyClaim.findUnique.mockResolvedValue(claim());
    prismaMock.employerProfile.findUnique.mockResolvedValue({ companyName: 'Akoko Solutions', industry: 'Production' });
    prismaMock.job.count.mockResolvedValue(2);
    prismaMock.application.count.mockResolvedValue(7);

    const preview = await previewClaim('t'.repeat(64), NOW);

    expect(preview).toMatchObject({ company: { name: 'Akoko Solutions' }, openJobs: 2, applicants: 7, emailHint: 'owner@akoko.com' });
  });

  it('says clearly when a link is expired, cancelled, used or unknown', async () => {
    prismaMock.companyClaim.findUnique.mockResolvedValue(claim({ expiresAt: new Date(NOW.getTime() - 1) }));
    await expect(previewClaim('t'.repeat(64), NOW)).rejects.toMatchObject({ status: 410, code: 'LINK_EXPIRED' });
    prismaMock.companyClaim.findUnique.mockResolvedValue(claim({ status: 'REVOKED' }));
    await expect(previewClaim('t'.repeat(64), NOW)).rejects.toMatchObject({ code: 'LINK_REVOKED' });
    prismaMock.companyClaim.findUnique.mockResolvedValue(claim({ status: 'CLAIMED' }));
    await expect(previewClaim('t'.repeat(64), NOW)).rejects.toMatchObject({ code: 'LINK_CLAIMED' });
    prismaMock.companyClaim.findUnique.mockResolvedValue(null);
    await expect(previewClaim('t'.repeat(64), NOW)).rejects.toMatchObject({ status: 404 });
  });

  const setupAccept = (extra: Record<string, unknown> = {}) => {
    prismaMock.companyClaim.findUnique.mockResolvedValue(claim(extra));
    prismaMock.user.findUnique.mockResolvedValue(null); // the email is free
    prismaMock.employerProfile.findUnique.mockResolvedValue({ claimStatus: 'UNCLAIMED', companyName: 'Akoko Solutions' });
    prismaMock.companyClaim.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.update.mockImplementation(async ({ data }: any) => ({ id: 'co-1', role: 'EMPLOYER', email: data.email, emailVerified: data.emailVerified, tokenVersion: 1 }));
  };

  it('hands the company over: sets the owner email and password, marks it claimed, and signs them in', async () => {
    setupAccept();

    const result = await acceptClaim('t'.repeat(64), { email: 'Owner@Akoko.com', password: 'a-strong-password' }, NOW);

    expect(result.companyName).toBe('Akoko Solutions');
    expect(result.token.split('.')).toHaveLength(3);
    const update = prismaMock.user.update.mock.calls[0][0].data;
    expect(update.email).toBe('owner@akoko.com');
    expect(update.password).toMatch(/^\$2[aby]\$/);
    expect(update.tokenVersion).toEqual({ increment: 1 });
    expect(prismaMock.employerProfile.update).toHaveBeenCalledWith({ where: { userId: 'co-1' }, data: { claimStatus: 'CLAIMED' } });
    // the link was emailed to this same address, so the address is already confirmed and no second email is sent
    expect(update.emailVerified).toBe(true);
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('asks the owner to verify an email the link was not sent to', async () => {
    setupAccept({ channel: 'WHATSAPP', sentTo: '+233241234567' });

    await acceptClaim('t'.repeat(64), { email: 'boss@akoko.com', password: 'a-strong-password' }, NOW);

    expect(prismaMock.user.update.mock.calls[0][0].data.emailVerified).toBe(false);
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith('boss@akoko.com', expect.any(String));
  });

  it('works once only: a second person using the same link loses', async () => {
    setupAccept();
    prismaMock.companyClaim.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(acceptClaim('t'.repeat(64), { email: 'x@y.com', password: 'a-strong-password' }, NOW)).rejects.toMatchObject({ code: 'LINK_NOT_ACTIVE' });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('refuses an expired or revoked link, an email that already has an account, and a company already claimed', async () => {
    setupAccept({ status: 'REVOKED' });
    await expect(acceptClaim('t'.repeat(64), { email: 'x@y.com', password: 'a-strong-password' }, NOW)).rejects.toMatchObject({ code: 'LINK_NOT_ACTIVE' });

    setupAccept();
    prismaMock.user.findUnique.mockResolvedValue({ id: 'someone' });
    await expect(acceptClaim('t'.repeat(64), { email: 'x@y.com', password: 'a-strong-password' }, NOW)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });

    setupAccept();
    prismaMock.employerProfile.findUnique.mockResolvedValue({ claimStatus: 'CLAIMED', companyName: 'Akoko Solutions' });
    await expect(acceptClaim('t'.repeat(64), { email: 'x@y.com', password: 'a-strong-password' }, NOW)).rejects.toMatchObject({ code: 'ALREADY_CLAIMED' });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe('3. Founding Employers', () => {
  it('gives the lowest free number', () => {
    expect(nextFoundingNumber([], 50)).toBe(1);
    expect(nextFoundingNumber([1, 2, 4], 50)).toBe(3);
    expect(nextFoundingNumber([1, 2, 3], 3)).toBeNull();
  });

  it('marks a company, numbers it, and gives the free featured credits, all logged', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isFoundingEmployer: false, foundingNumber: null, companyName: 'Akoko' });
    prismaMock.employerProfile.findMany.mockResolvedValue([{ foundingNumber: 1 }, { foundingNumber: 2 }]);

    const result = await setFoundingEmployer(ADMIN, 'co-1', true);

    expect(result).toEqual({ isFoundingEmployer: true, foundingNumber: 3, creditsGiven: 3 });
    expect(prismaMock.employerProfile.update.mock.calls[0][0].data).toMatchObject({ isFoundingEmployer: true, foundingNumber: 3 });
    expect(prismaMock.creditAccount.upsert.mock.calls[0][0].update).toEqual({ featuredCredits: { increment: 3 }, boostCredits: { increment: 0 } });
    expect(prismaMock.creditLedger.create.mock.calls[0][0].data).toMatchObject({ userId: 'co-1', creditType: 'FEATURE', delta: 3, reason: 'FOUNDING_EMPLOYER', adminId: 'admin-1' });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('FOUNDING_EMPLOYER_ADDED');
  });

  it('does nothing the second time, and never gives the credits twice', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isFoundingEmployer: true, foundingNumber: 7, companyName: 'Akoko' });

    expect(await setFoundingEmployer(ADMIN, 'co-1', true)).toEqual({ isFoundingEmployer: true, foundingNumber: 7, creditsGiven: 0 });
    expect(prismaMock.creditLedger.create).not.toHaveBeenCalled();
  });

  it('refuses when every place is taken', async () => {
    prismaMock.billingSettings.findUnique.mockResolvedValue({ foundingLimit: 2, foundingFeaturedCredits: 3 });
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isFoundingEmployer: false, foundingNumber: null, companyName: 'Akoko' });
    prismaMock.employerProfile.findMany.mockResolvedValue([{ foundingNumber: 1 }, { foundingNumber: 2 }]);

    await expect(setFoundingEmployer(ADMIN, 'co-1', true)).rejects.toMatchObject({ status: 409, code: 'FOUNDING_FULL' });
    expect(prismaMock.creditLedger.create).not.toHaveBeenCalled();
  });

  it('takes the badge away and frees the number, without taking credits back', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isFoundingEmployer: true, foundingNumber: 7, companyName: 'Akoko' });

    expect(await setFoundingEmployer(ADMIN, 'co-1', false)).toMatchObject({ isFoundingEmployer: false, foundingNumber: null });
    expect(prismaMock.employerProfile.update.mock.calls[0][0].data).toEqual({ isFoundingEmployer: false, foundingNumber: null, foundingAt: null });
    expect(prismaMock.creditLedger.create).not.toHaveBeenCalled();
  });
});

describe('5. employer referral', () => {
  it('makes codes people can read out loud, with no look-alike characters', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = newReferralCode();
      expect(isReferralCode(code)).toBe(true);
      expect(code).not.toMatch(/[01OI]/);
    }
    expect(isReferralCode('hello')).toBe(false);
  });

  it('rewards the referrer with one featured credit when the referred company posts its first job', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ referredById: 'ref-1', referralRewardedAt: null, companyName: 'New Co' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'ref-1', status: 'ACTIVE' });
    prismaMock.employerProfile.updateMany.mockResolvedValue({ count: 1 });

    expect(await rewardReferralForFirstJob('new-1')).toBe(true);

    expect(prismaMock.creditLedger.create.mock.calls[0][0].data).toMatchObject({ userId: 'ref-1', creditType: 'FEATURE', delta: 1, reason: 'REFERRAL' });
    expect(prismaMock.notification.create.mock.calls[0][0].data.userId).toBe('ref-1');
  });

  it('rewards once: a second job, or a race, gives nothing', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ referredById: 'ref-1', referralRewardedAt: new Date(), companyName: 'New Co' });
    expect(await rewardReferralForFirstJob('new-1')).toBe(false);

    prismaMock.employerProfile.findUnique.mockResolvedValue({ referredById: 'ref-1', referralRewardedAt: null, companyName: 'New Co' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'ref-1', status: 'ACTIVE' });
    prismaMock.employerProfile.updateMany.mockResolvedValue({ count: 0 });
    expect(await rewardReferralForFirstJob('new-1')).toBe(false);
    expect(prismaMock.creditLedger.create).not.toHaveBeenCalled();
  });

  it('gives nothing without a referrer, to a suspended referrer, or to oneself, and never throws', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ referredById: null, referralRewardedAt: null, companyName: 'New Co' });
    expect(await rewardReferralForFirstJob('new-1')).toBe(false);

    prismaMock.employerProfile.findUnique.mockResolvedValue({ referredById: 'ref-1', referralRewardedAt: null, companyName: 'New Co' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'ref-1', status: 'SUSPENDED' });
    expect(await rewardReferralForFirstJob('new-1')).toBe(false);

    prismaMock.user.findUnique.mockRejectedValue(new Error('database down'));
    await expect(rewardReferralForFirstJob('new-1')).resolves.toBe(false);
  });

  it('attaches a referral code only to a new company, once, never to itself', async () => {
    const fresh = { referredById: null, user: { createdAt: new Date(NOW.getTime() - DAY) } };
    prismaMock.employerProfile.findUnique.mockImplementation(async ({ where }: any) => (where.referralCode ? { userId: 'ref-1', user: { status: 'ACTIVE' } } : fresh));
    prismaMock.job.count.mockResolvedValue(0);
    expect(await attachReferral('new-1', ' jw-abc234 ', NOW)).toEqual({ attached: true });
    expect(prismaMock.employerProfile.update).toHaveBeenCalledWith({ where: { userId: 'new-1' }, data: { referredById: 'ref-1' } });

    expect(await attachReferral('ref-1', 'JW-ABC234', NOW).catch((error) => error.code)).toBe('OWN_CODE');

    prismaMock.job.count.mockResolvedValue(1);
    await expect(attachReferral('new-1', 'JW-ABC234', NOW)).rejects.toMatchObject({ code: 'ALREADY_POSTED' });

    prismaMock.job.count.mockResolvedValue(0);
    prismaMock.employerProfile.findUnique.mockImplementation(async ({ where }: any) => (where.referralCode ? { userId: 'ref-1', user: { status: 'ACTIVE' } } : { referredById: null, user: { createdAt: new Date(NOW.getTime() - 20 * DAY) } }));
    await expect(attachReferral('new-1', 'JW-ABC234', NOW)).rejects.toMatchObject({ code: 'TOO_LATE' });

    prismaMock.employerProfile.findUnique.mockImplementation(async ({ where }: any) => (where.referralCode ? null : fresh));
    await expect(attachReferral('new-1', 'JW-NOPE22', NOW)).rejects.toMatchObject({ code: 'CODE_NOT_FOUND' });
  });
});

describe('4. the weekly employer report', () => {
  it('reports the last full Monday-to-Sunday week, whichever day it is run', () => {
    const week = lastWeek(new Date('2026-11-09T07:00:00Z')); // Monday 9 Nov
    expect(week.start.toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(week.end.toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(lastWeek(new Date('2026-11-15T23:00:00Z')).start.toISOString()).toBe('2026-11-02T00:00:00.000Z'); // Sunday
    expect(lastWeek(NOW).end.toISOString()).toBe('2026-11-09T00:00:00.000Z'); // Tuesday
  });

  const week = { start: new Date('2026-11-02T00:00:00Z'), end: new Date('2026-11-09T00:00:00Z') };
  const at = (day: string) => new Date(`2026-11-${day}T12:00:00Z`);

  it('counts views and new applicants in the week, and everyone still waiting, for each job', () => {
    const report = buildWeeklyReport({
      jobs: [{ id: 'j1', title: 'Receptionist' }, { id: 'j2', title: 'Cook' }],
      applications: [
        { jobId: 'j1', createdAt: at('03'), status: 'SUBMITTED' },
        { jobId: 'j1', createdAt: at('05'), status: 'SHORTLISTED' },
        { jobId: 'j1', createdAt: at('01'), status: 'SUBMITTED' }, // before the week: not "new", but still waiting
        { jobId: 'j1', createdAt: at('09'), status: 'SUBMITTED' }, // after the week
      ],
      views: [
        { jobId: 'j1', createdAt: at('04') },
        { jobId: 'j1', createdAt: at('08') },
        { jobId: 'j1', createdAt: at('10') }, // after the week
        { jobId: 'j2', createdAt: at('06') },
      ],
      ...week,
    });

    expect(report.jobs[0]).toEqual({ jobId: 'j1', title: 'Receptionist', views: 2, newApplicants: 2, totalApplicants: 4, awaitingReview: 3 });
    expect(report.jobs[1]).toMatchObject({ views: 1, newApplicants: 0, totalApplicants: 0 });
    expect(report.totals).toEqual({ views: 3, newApplicants: 2, totalApplicants: 4, awaitingReview: 3, activeJobs: 2 });
  });

  it('has a WhatsApp share text with the numbers and a link that opens WhatsApp', () => {
    const report = buildWeeklyReport({ jobs: [{ id: 'j1', title: 'Receptionist' }], applications: [{ jobId: 'j1', createdAt: at('03'), status: 'SUBMITTED' }], views: [{ jobId: 'j1', createdAt: at('04') }], ...week });
    const text = reportShareText('Achiba Star Hotel', report, 'https://www.jobwahala.com');
    expect(weekLabel(report)).toBe('2 Nov to 8 Nov');
    expect(text).toContain('Achiba Star Hotel on JobWahala, 2 Nov to 8 Nov');
    expect(text).toContain('Receptionist: 1 view, 1 new applicant');
    expect(whatsappLink(text).startsWith('https://wa.me/?text=')).toBe(true);
  });

  const employer = { id: 'emp-1', email: 'boss@hotel.com', employerProfile: { companyName: 'Achiba Star Hotel' } };
  const setupRun = () => {
    prismaMock.user.findMany.mockResolvedValue([employer]);
    prismaMock.job.findMany.mockResolvedValue([{ id: 'j1', title: 'Receptionist' }]);
    prismaMock.application.findMany.mockResolvedValue([{ jobId: 'j1', createdAt: at('03'), status: 'SUBMITTED' }]);
    prismaMock.jobView.findMany.mockResolvedValue([{ jobId: 'j1', createdAt: at('04') }]);
    prismaMock.employerWeeklyReport.findUnique.mockResolvedValue(null);
    prismaMock.employerWeeklyReport.create.mockImplementation(async ({ data }: any) => ({ id: 'rep-1', ...data }));
    prismaMock.employerWeeklyReport.updateMany.mockResolvedValue({ count: 1 });
  };

  it('emails each employer with an active job once, and saves the report for their dashboard', async () => {
    setupRun();

    const result = await runWeeklyEmployerReports(NOW);

    expect(result).toEqual({ employers: 1, built: 1, emailed: 1 });
    expect(mail.sendWeeklyReportEmail).toHaveBeenCalledTimes(1);
    const [to, data] = mail.sendWeeklyReportEmail.mock.calls[0];
    expect(to).toBe('boss@hotel.com');
    expect(data.company).toBe('Achiba Star Hotel');
    expect(data.report.totals).toMatchObject({ views: 1, newApplicants: 1 });
    expect(data.whatsappUrl.startsWith('https://wa.me/?text=')).toBe(true);
    expect(JSON.parse(prismaMock.employerWeeklyReport.create.mock.calls[0][0].data.dataJson).totals.views).toBe(1);
    // only companies a person runs, with an open job that existed during the week
    const where = prismaMock.user.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ role: 'EMPLOYER', status: 'ACTIVE', employerProfile: { is: { claimStatus: 'CLAIMED' } } });
  });

  it('never emails the same week twice, even when it runs again', async () => {
    setupRun();
    prismaMock.employerWeeklyReport.findUnique.mockResolvedValue({ id: 'rep-1', emailSentAt: new Date() });

    expect(await runWeeklyEmployerReports(NOW)).toEqual({ employers: 1, built: 0, emailed: 0 });
    expect(mail.sendWeeklyReportEmail).not.toHaveBeenCalled();

    // two runs at the same moment: only the one that records the send first emails
    setupRun();
    prismaMock.employerWeeklyReport.updateMany.mockResolvedValue({ count: 0 });
    await runWeeklyEmployerReports(NOW);
    expect(mail.sendWeeklyReportEmail).not.toHaveBeenCalled();
  });

  it('skips a company with no active job, and keeps going when one email fails', async () => {
    setupRun();
    prismaMock.job.findMany.mockResolvedValue([]);
    expect(await runWeeklyEmployerReports(NOW)).toMatchObject({ emailed: 0 });

    setupRun();
    prismaMock.user.findMany.mockResolvedValue([employer, { ...employer, id: 'emp-2', email: 'two@hotel.com' }]);
    mail.sendWeeklyReportEmail.mockRejectedValueOnce(new Error('mail down')).mockResolvedValueOnce(undefined);
    const result = await runWeeklyEmployerReports(NOW);
    expect(result.emailed).toBe(1);
  });
});

describe('who can use the new admin and employer routes', () => {
  it('puts every acquisition route behind the admin-only router', async () => {
    const paths = await adminRouterPaths();
    for (const path of ['/acquisition/companies', '/acquisition/companies/:id/claim-link', '/acquisition/claims/:id/revoke', '/acquisition/founding', '/acquisition/founding/settings', '/acquisition/companies/:id/founding', '/acquisition/outreach', '/acquisition/outreach/:id', '/acquisition/weekly-reports/run']) {
      expect(paths).toContain(path);
    }
  });
});
