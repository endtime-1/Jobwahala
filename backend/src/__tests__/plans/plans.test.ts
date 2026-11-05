import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const m = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const mock: Record<string, any> = {
    subscription: m('findMany', 'findFirst', 'findUnique', 'update', 'count'),
    product: m('findFirst', 'findUnique', 'findMany', 'create', 'count', 'update'),
    teamMember: m('findMany', 'findFirst', 'findUnique', 'create', 'update', 'count', 'deleteMany'),
    creditAccount: m('findUnique', 'upsert', 'update', 'updateMany'),
    creditLedger: m('create'),
    user: m('findUnique', 'findFirst'),
    job: m('findFirst', 'count', 'findMany'),
    application: m('findMany'),
    jobView: m('create', 'findMany'),
    jobSeekerProfile: m('findMany'),
    employerProfile: m('update', 'findUnique'),
    billingSettings: m('findUnique', 'create', 'upsert'),
    billingPayment: m('create', 'update'),
    adminActionLog: m('create'),
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));
vi.mock('../../services/jobAlertService', () => ({ notifyJobAlerts: vi.fn() }));
const mailMock = vi.hoisted(() => ({ sendTeamInviteEmail: vi.fn() }));
vi.mock('../../services/emailService', () => ({
  sendTeamInviteEmail: mailMock.sendTeamInviteEmail,
  sendPaymentReceiptEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  sendRenewalReminderEmail: vi.fn(),
  sendGraceReminderEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

import env from '../../config/env';
import { getCompany, listHiringCompanies } from '../../controllers/companyController';
import { acceptInvite, getTeam, inviteMember, removeMember } from '../../controllers/teamController';
import { getHiringReport, searchCvDatabase, trackJobView } from '../../controllers/planFeaturesController';
import { updateProfile } from '../../controllers/userController';
import { actAsCompany } from '../../middleware/company';
import { BillingError } from '../../services/billingErrors';
import { scheduleDowngrade, setBillingDepsForTests } from '../../services/billingService';
import { canViewUpload } from '../../services/fileAccessService';
import { buildHiringReport } from '../../services/hiringReports';
import { expirePlanCredits, getCreditBalance, getEntitlements, grantMonthlyPlanCredits, reconcileTeam, requireFeature } from '../../services/planService';
import { getDeletionPreview } from '../../services/accountService';
import { parseUploadRef, uploaderTag } from '../../utils/fileAccess';
import { createProductSchema } from '../../validation/billingSchemas';
import { getProfileUpdateSchema } from '../../validation/profileSchemas';
import { FREE_FEATURES, GRACE_DAYS, daysIntoGrace, graceEndFrom, graceRemindersDue, isLive, planLevel, tierRank } from '../../utils/plans';

const DAY = 86_400_000;
const NOW = new Date('2026-11-10T10:00:00.000Z');
const future = (days: number) => new Date(NOW.getTime() + days * DAY);

const respond = () => {
  const state: { status: number; body: any } = { status: 200, body: undefined };
  const res = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(value: unknown) {
      state.body = value;
      return this;
    },
  } as unknown as Response;
  return { res, state };
};
const call = async (handler: (req: never, res: Response) => unknown, req: Record<string, unknown>) => {
  const { res, state } = respond();
  await handler({ body: {}, params: {}, query: {}, headers: {}, get: () => 'Mozilla/5.0', header: () => undefined, ip: '1.2.3.4', ...req } as never, res);
  return state;
};
const owner = { user: { id: 'owner-1', role: 'EMPLOYER' } };

const planProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 'starter-m',
  name: 'Starter (monthly)',
  planTier: 'STARTER',
  interval: 'MONTHLY',
  pricePesewas: 15000,
  teamLimit: 3,
  cvDatabase: false,
  brandedPage: true,
  hiringReports: false,
  topEmployers: false,
  featuredCredits: 2,
  boostCredits: 1,
  ...overrides,
});
const business = (overrides: Record<string, unknown> = {}) => planProduct({ id: 'biz-m', name: 'Business (monthly)', planTier: 'BUSINESS', pricePesewas: 45000, teamLimit: 10, cvDatabase: true, hiringReports: true, topEmployers: true, featuredCredits: 6, boostCredits: 3, ...overrides });

const subscription = (overrides: Record<string, unknown> = {}, productOverrides: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  userId: 'owner-1',
  status: 'ACTIVE',
  currentPeriodEnd: future(20),
  currentPeriodStart: NOW,
  graceEndsAt: null,
  cancelAtPeriodEnd: false,
  pendingProductId: null,
  paystackSubscriptionCode: null,
  paystackEmailToken: null,
  paystackCustomerCode: null,
  authorizationCode: null,
  product: planProduct(productOverrides),
  productId: 'starter-m',
  createdAt: NOW,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
  prismaMock.subscription.findMany.mockResolvedValue([]);
  prismaMock.product.findFirst.mockResolvedValue(null);
  prismaMock.product.findUnique.mockResolvedValue(null);
  prismaMock.teamMember.findMany.mockResolvedValue([]);
  prismaMock.teamMember.findFirst.mockResolvedValue(null);
  prismaMock.teamMember.count.mockResolvedValue(0);
  prismaMock.creditAccount.findUnique.mockResolvedValue(null);
  prismaMock.billingSettings.findUnique.mockResolvedValue({ vatRatePercent: 15, pricesIncludeVat: true });
});

// ----------------------------------------------------------------- the rules

describe('plan rules', () => {
  it('ranks Free below Starter below Business, with a yearly plan just above its monthly one', () => {
    expect(tierRank('FREE')).toBeLessThan(tierRank('STARTER'));
    expect(tierRank('STARTER')).toBeLessThan(tierRank('BUSINESS'));
    expect(planLevel({ planTier: 'STARTER', interval: 'YEARLY' })).toBeGreaterThan(planLevel({ planTier: 'STARTER', interval: 'MONTHLY' }));
    expect(planLevel({ planTier: 'BUSINESS', interval: 'MONTHLY' })).toBeGreaterThan(planLevel({ planTier: 'STARTER', interval: 'YEARLY' }));
  });

  it('a plan is live while paid up, runs to its end when cancelled, and keeps working for 7 days after a failed renewal', () => {
    expect(isLive({ status: 'ACTIVE', currentPeriodEnd: future(5), graceEndsAt: null }, NOW)).toBe(true);
    // A day late with the renewal on its way: still on the plan.
    expect(isLive({ status: 'ACTIVE', currentPeriodEnd: future(-1), graceEndsAt: null }, NOW)).toBe(true);
    // Cancelled: ends exactly at the end of the period it paid for.
    expect(isLive({ status: 'ACTIVE', currentPeriodEnd: future(-1), graceEndsAt: null, cancelAtPeriodEnd: true }, NOW)).toBe(false);
    expect(isLive({ status: 'ACTIVE', currentPeriodEnd: future(2), graceEndsAt: null, cancelAtPeriodEnd: true }, NOW)).toBe(true);
    // Renewal failed: live inside grace, not after.
    expect(isLive({ status: 'PAST_DUE', currentPeriodEnd: future(-10), graceEndsAt: future(3) }, NOW)).toBe(true);
    expect(isLive({ status: 'PAST_DUE', currentPeriodEnd: future(-10), graceEndsAt: future(-1) }, NOW)).toBe(false);
    expect(isLive({ status: 'EXPIRED', currentPeriodEnd: future(5), graceEndsAt: null }, NOW)).toBe(false);
    expect(isLive({ status: 'CANCELLED', currentPeriodEnd: future(5), graceEndsAt: null }, NOW)).toBe(false);
  });

  it('the grace period is 7 days, with reminders after 2 and 5 days', () => {
    expect(GRACE_DAYS).toBe(7);
    const ends = graceEndFrom(NOW);
    expect(ends.getTime()).toBe(NOW.getTime() + 7 * DAY);
    expect(daysIntoGrace(ends, NOW)).toBe(0);
    expect(graceRemindersDue(ends, future(1))).toBe(0);
    expect(graceRemindersDue(ends, future(2))).toBe(1);
    expect(graceRemindersDue(ends, future(4))).toBe(1);
    expect(graceRemindersDue(ends, future(5))).toBe(2);
    expect(graceRemindersDue(ends, future(6))).toBe(2);
  });

  it('Free is unlimited posts and the applicant board with one seat, and nothing else', () => {
    expect(FREE_FEATURES).toMatchObject({ teamLimit: 1, cvDatabase: false, brandedPage: false, hiringReports: false, topEmployers: false, monthlyFeaturedCredits: 0, monthlyBoostCredits: 0 });
  });
});

describe('what a company is entitled to', () => {
  it('is Free with no plan, using the Free plan row the admin may have edited', async () => {
    expect(await getEntitlements('owner-1', NOW)).toMatchObject({ tier: 'FREE', teamLimit: 1, cvDatabase: false, subscription: null });

    prismaMock.product.findFirst.mockResolvedValue({ ...planProduct({ id: 'free', name: 'Free', planTier: 'FREE', teamLimit: 2 }), interval: null });
    expect(await getEntitlements('owner-1', NOW)).toMatchObject({ tier: 'FREE', planName: 'Free', teamLimit: 2, productId: 'free' });
  });

  it('follows the live plan: limits and features come from its product', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, {})]);

    expect(await getEntitlements('owner-1', NOW)).toMatchObject({ tier: 'STARTER', planName: 'Starter (monthly)', teamLimit: 3, brandedPage: true, cvDatabase: false, hiringReports: false, monthlyFeaturedCredits: 2, monthlyBoostCredits: 1 });

    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);
    expect(await getEntitlements('owner-1', NOW)).toMatchObject({ tier: 'BUSINESS', teamLimit: 10, cvDatabase: true, hiringReports: true, topEmployers: true });
  });

  it('a plan with a failed renewal still counts inside its 7 days of grace, and not after', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subscription({ status: 'PAST_DUE', currentPeriodEnd: future(-9), graceEndsAt: future(2) }, business())]);
    expect((await getEntitlements('owner-1', NOW)).tier).toBe('BUSINESS');

    prismaMock.subscription.findMany.mockResolvedValue([subscription({ status: 'PAST_DUE', currentPeriodEnd: future(-9), graceEndsAt: future(-2) }, business())]);
    expect(await getEntitlements('owner-1', NOW)).toMatchObject({ tier: 'FREE', cvDatabase: false, teamLimit: 1 });
  });

  it('shows a planned move to a smaller plan, and the bigger plan wins if there somehow are two', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subscription({ id: 'a', pendingProductId: 'starter-m', cancelAtPeriodEnd: true }, business()), subscription({ id: 'b' })]);
    prismaMock.product.findUnique.mockResolvedValue({ name: 'Starter (monthly)' });

    const entitlements = await getEntitlements('owner-1', NOW);

    expect(entitlements.tier).toBe('BUSINESS');
    expect(entitlements.subscription).toMatchObject({ id: 'a', pendingPlanName: 'Starter (monthly)', cancelAtPeriodEnd: true });
  });

  it('refuses a feature the plan does not include, on the server, with the plan to get', async () => {
    await expect(requireFeature('owner-1', 'cvDatabase', NOW)).rejects.toMatchObject({ status: 403, code: 'PLAN_REQUIRED', message: expect.stringMatching(/Business plan/) });
    await expect(requireFeature('owner-1', 'hiringReports', NOW)).rejects.toMatchObject({ code: 'PLAN_REQUIRED' });
    await expect(requireFeature('owner-1', 'brandedPage', NOW)).rejects.toMatchObject({ message: expect.stringMatching(/Starter and Business/) });

    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);
    await expect(requireFeature('owner-1', 'cvDatabase', NOW)).resolves.toMatchObject({ tier: 'BUSINESS' });
  });
});

// ------------------------------------------------------------------ credits

describe('plan credits', () => {
  it('replace last month\'s credits with this month\'s, and record both, leaving bought credits alone', async () => {
    prismaMock.creditAccount.findUnique.mockResolvedValue({ planFeaturedCredits: 2, planBoostCredits: 1, featuredCredits: 9, boostCredits: 9 });

    await grantMonthlyPlanCredits('owner-1', { featured: 6, boost: 3 });

    expect(prismaMock.creditAccount.upsert.mock.calls[0][0].update).toEqual({ planFeaturedCredits: 6, planBoostCredits: 3 });
    expect(prismaMock.creditLedger.create.mock.calls.map((call: any[]) => [call[0].data.creditType, call[0].data.delta, call[0].data.reason])).toEqual([
      ['FEATURE', -2, 'EXPIRY'],
      ['BOOST', -1, 'EXPIRY'],
      ['FEATURE', 6, 'SUBSCRIPTION'],
      ['BOOST', 3, 'SUBSCRIPTION'],
    ]);
  });

  it('end with the plan (only the monthly ones)', async () => {
    prismaMock.creditAccount.findUnique.mockResolvedValue({ planFeaturedCredits: 3, planBoostCredits: 0, featuredCredits: 4, boostCredits: 1 });

    await expirePlanCredits('owner-1');

    expect(prismaMock.creditAccount.update).toHaveBeenCalledWith({ where: { userId: 'owner-1' }, data: { planFeaturedCredits: 0, planBoostCredits: 0 } });
    expect(prismaMock.creditLedger.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.creditLedger.create.mock.calls[0][0].data).toMatchObject({ delta: -3, reason: 'EXPIRY' });
  });

  it('show the plan\'s and the bought credits separately, and the total', async () => {
    prismaMock.creditAccount.findUnique.mockResolvedValue({ planFeaturedCredits: 2, planBoostCredits: 1, featuredCredits: 5, boostCredits: 0 });

    expect(await getCreditBalance('owner-1')).toEqual({ featuredCredits: 7, boostCredits: 1, plan: { featured: 2, boost: 1 }, purchased: { featured: 5, boost: 0 } });
  });
});

// ------------------------------------------------------------------ the team

describe('keeping the team within the plan', () => {
  const member = (id: string, status: string, days: number, userId: string | null = `u-${id}`) => ({ id, status, userId, invitedAt: future(-days) });

  it('pauses the newest members above the limit when a plan gets smaller, and deletes nobody', async () => {
    // On Free (1 seat: just the owner) every member is over the limit.
    prismaMock.teamMember.findMany.mockResolvedValue([member('a', 'ACTIVE', 30), member('b', 'ACTIVE', 20), member('c', 'INVITED', 10, null)]);

    const result = await reconcileTeam('owner-1', NOW);

    expect(result).toEqual({ suspended: 3, restored: 0 });
    expect(prismaMock.teamMember.update.mock.calls.map((call: any[]) => [call[0].where.id, call[0].data.status])).toEqual([['a', 'SUSPENDED'], ['b', 'SUSPENDED'], ['c', 'SUSPENDED']]);
    expect(prismaMock.teamMember.deleteMany).not.toHaveBeenCalled();
  });

  it('on a plan with 3 seats (2 members) keeps the two oldest and pauses the rest', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, { teamLimit: 3 })]);
    prismaMock.teamMember.findMany.mockResolvedValue([member('a', 'ACTIVE', 30), member('b', 'ACTIVE', 20), member('c', 'ACTIVE', 10)]);

    await reconcileTeam('owner-1', NOW);

    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.teamMember.update).toHaveBeenCalledWith({ where: { id: 'c' }, data: { status: 'SUSPENDED' } });
  });

  it('brings paused people back, oldest first, when the plan grows (a joined member as active, an unaccepted invitation as an invitation)', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);
    prismaMock.teamMember.findMany.mockResolvedValue([member('a', 'SUSPENDED', 30), member('b', 'SUSPENDED', 20, null)]);

    const result = await reconcileTeam('owner-1', NOW);

    expect(result.restored).toBe(2);
    expect(prismaMock.teamMember.update.mock.calls.map((call: any[]) => [call[0].where.id, call[0].data.status])).toEqual([['a', 'ACTIVE'], ['b', 'INVITED']]);
  });

  describe('inviting', () => {
    const invite = (email: string) => call(inviteMember as never, { ...owner, body: { email: `  ${email.toUpperCase()} ` } });

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({ email: 'boss@acme.example', employerProfile: { companyName: 'Acme Ltd' } });
      prismaMock.teamMember.findFirst.mockResolvedValue(null);
      prismaMock.teamMember.create.mockImplementation(async ({ data }: any) => ({ id: 'tm-1', status: 'INVITED', ...data }));
      mailMock.sendTeamInviteEmail.mockResolvedValue(undefined);
    });

    it('on Free there is one seat, so nobody can be invited: the server says which plan to get', async () => {
      const result = await invite('new@acme.example');

      expect(result.status).toBe(403);
      expect(result.body).toMatchObject({ code: 'PLAN_REQUIRED', message: expect.stringMatching(/no more team seats/) });
      expect(prismaMock.teamMember.create).not.toHaveBeenCalled();
    });

    it('on Starter (3 seats) two people can join the owner, and the third invitation is refused', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([subscription({}, { teamLimit: 3 })]);

      prismaMock.teamMember.count.mockResolvedValue(0);
      expect((await invite('one@acme.example')).status).toBe(201);
      prismaMock.teamMember.count.mockResolvedValue(1);
      expect((await invite('two@acme.example')).status).toBe(201);
      prismaMock.teamMember.count.mockResolvedValue(2);
      const third = await invite('three@acme.example');

      expect(third.status).toBe(403);
      expect(third.body.code).toBe('PLAN_REQUIRED');
    });

    it('saves a hashed token, emails the link, and never returns the token', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([subscription({}, { teamLimit: 3 })]);

      const result = await invite('New@Acme.example');

      expect(result.body).toEqual({ success: true, member: { id: 'tm-1', email: 'new@acme.example', status: 'INVITED' } });
      const saved = prismaMock.teamMember.create.mock.calls[0][0].data;
      expect(saved.inviteTokenHash).toMatch(/^[0-9a-f]{64}$/);
      const link = mailMock.sendTeamInviteEmail.mock.calls[0][1].url as string;
      expect(link).toContain('/join-team?token=');
      expect(link).not.toContain(saved.inviteTokenHash);
    });

    it('cannot invite yourself or someone already on the team', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([subscription({}, { teamLimit: 3 })]);

      expect((await invite('boss@acme.example')).body.code).toBe('THAT_IS_YOU');

      prismaMock.teamMember.findFirst.mockResolvedValue({ id: 'tm-1', status: 'ACTIVE' });
      expect((await invite('new@acme.example')).body.code).toBe('ALREADY_MEMBER');
    });

    it('sending the invitation again does not use a second seat', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([subscription({}, { teamLimit: 2 })]);
      prismaMock.teamMember.count.mockResolvedValue(1);
      prismaMock.teamMember.findFirst.mockResolvedValue({ id: 'tm-1', status: 'INVITED' });
      prismaMock.teamMember.update.mockImplementation(async ({ data }: any) => ({ id: 'tm-1', email: 'new@acme.example', ...data }));

      const result = await invite('new@acme.example');

      expect(result.status).toBe(201);
      expect(prismaMock.teamMember.update.mock.calls[0][0].data.status).toBe('INVITED');
    });
  });

  describe('accepting', () => {
    const token = 'a'.repeat(64);
    const accept = (userId = 'member-1') => call(acceptInvite as never, { user: { id: userId, role: 'EMPLOYER' }, body: { token } });
    const invitation = { id: 'tm-1', ownerId: 'owner-1', email: 'new@acme.example', status: 'INVITED', owner: { status: 'ACTIVE', employerProfile: { companyName: 'Acme Ltd' } } };

    beforeEach(() => {
      prismaMock.teamMember.findUnique.mockResolvedValue(invitation);
      prismaMock.user.findUnique.mockResolvedValue({ email: 'New@Acme.example', emailVerified: true });
      prismaMock.job.count.mockResolvedValue(0);
      prismaMock.subscription.findMany.mockResolvedValue([subscription({}, { teamLimit: 3 })]);
    });

    it('links the person to the company and makes them active', async () => {
      const result = await accept();

      expect(result.body).toEqual({ success: true, company: 'Acme Ltd' });
      expect(prismaMock.teamMember.update).toHaveBeenCalledWith({ where: { id: 'tm-1' }, data: expect.objectContaining({ status: 'ACTIVE', userId: 'member-1' }) });
    });

    it('only the person the invitation was sent to can accept it', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ email: 'someone@else.example', emailVerified: true });

      expect((await accept()).body.code).toBe('WRONG_ACCOUNT');
      expect(prismaMock.teamMember.update).not.toHaveBeenCalled();
    });

    it('refuses a made-up, used or expired link; an account with its own jobs; and a full team', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue(null);
      expect((await accept()).body.code).toBe('INVITE_NOT_FOUND');

      prismaMock.teamMember.findUnique.mockResolvedValue({ ...invitation, status: 'ACTIVE' });
      expect((await accept()).body.code).toBe('INVITE_NOT_FOUND');

      prismaMock.teamMember.findUnique.mockResolvedValue(invitation);
      prismaMock.job.count.mockResolvedValue(2);
      expect((await accept()).body.code).toBe('HAS_OWN_JOBS');

      prismaMock.job.count.mockResolvedValue(0);
      prismaMock.subscription.findMany.mockResolvedValue([]);
      expect((await accept()).body.code).toBe('TEAM_FULL');
    });
  });

  it('shows the owner their team, the limit and the seats in use, and lets them remove someone (which frees a seat)', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, { teamLimit: 3 })]);
    prismaMock.teamMember.findMany.mockResolvedValue([{ id: 'tm-1', email: 'a@acme.example', status: 'ACTIVE', invitedAt: NOW, joinedAt: NOW }]);
    prismaMock.teamMember.count.mockResolvedValue(1);

    const team = await call(getTeam as never, owner);
    expect(team.body).toMatchObject({ limit: 3, used: 2, planName: 'Starter (monthly)' });

    prismaMock.teamMember.deleteMany.mockResolvedValue({ count: 1 });
    const removed = await call(removeMember as never, { ...owner, params: { id: 'tm-1' } });
    expect(removed.body.success).toBe(true);
    expect(prismaMock.teamMember.deleteMany.mock.calls[0][0].where).toEqual({ id: 'tm-1', ownerId: 'owner-1' });

    prismaMock.teamMember.deleteMany.mockResolvedValue({ count: 0 });
    expect((await call(removeMember as never, { ...owner, params: { id: 'someone-elses' } })).status).toBe(404);
  });

  describe('a team member working as the company', () => {
    const run = async (user: { id: string; role: string }) => {
      const req: any = { user };
      const next = vi.fn();
      await actAsCompany(req, {} as Response, next);
      return { req, next };
    };

    it('carries on as the company owner, keeping the member\'s own id', async () => {
      prismaMock.teamMember.findFirst.mockResolvedValue({ ownerId: 'owner-1' });

      const { req, next } = await run({ id: 'member-1', role: 'EMPLOYER' });

      expect(req.user).toEqual({ id: 'owner-1', role: 'EMPLOYER' });
      expect(req.actorId).toBe('member-1');
      expect(next).toHaveBeenCalledWith();
      expect(prismaMock.teamMember.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 'member-1', status: 'ACTIVE' });
    });

    it('owners, paused members and job seekers are left exactly as they are', async () => {
      const owner = await run({ id: 'owner-1', role: 'EMPLOYER' });
      expect(owner.req.user.id).toBe('owner-1');
      expect(owner.req.actorId).toBeUndefined();

      const seeker = await run({ id: 'seeker-1', role: 'SEEKER' });
      expect(seeker.req.user.id).toBe('seeker-1');
      expect(prismaMock.teamMember.findFirst).toHaveBeenCalledTimes(1);
    });
  });
});

// ------------------------------------------------------------- downgrades

describe('moving to a smaller plan', () => {
  const paystack = { initialize: vi.fn(), verify: vi.fn(), createPlan: vi.fn(), refund: vi.fn(), disableSubscription: vi.fn(), createSubscription: vi.fn() };

  beforeEach(() => {
    setBillingDepsForTests({ paystack: paystack as never });
    for (const fn of Object.values(paystack)) fn.mockReset();
    paystack.createPlan.mockResolvedValue({ planCode: 'PLN_starter' });
    paystack.createSubscription.mockResolvedValue(undefined);
    paystack.disableSubscription.mockResolvedValue(undefined);
    const biz = subscription({ id: 'sub-1', paystackSubscriptionCode: 'SUB_1', paystackEmailToken: 'tok', paystackCustomerCode: 'CUS_1', authorizationCode: 'AUTH_1', currentPeriodEnd: future(12) }, business());
    prismaMock.subscription.findMany.mockResolvedValue([biz]);
    prismaMock.subscription.findUnique.mockResolvedValue(biz);
    prismaMock.subscription.findFirst.mockResolvedValue(biz);
    prismaMock.product.findUnique.mockResolvedValue({ ...planProduct(), active: true, paystackPlanCode: null, paystackPlanAmount: null });
    prismaMock.product.update.mockResolvedValue({});
  });

  it('with a saved card the smaller plan is scheduled to start on the day the current period ends, and the current plan stops repeating', async () => {
    const result = await scheduleDowngrade('owner-1', 'starter-m');

    expect(result).toMatchObject({ scheduled: true, to: 'Starter (monthly)' });
    expect(result.effectiveOn).toEqual(future(12));
    expect(paystack.createSubscription).toHaveBeenCalledWith({ customerCode: 'CUS_1', planCode: 'PLN_starter', authorizationCode: 'AUTH_1', startDate: future(12) });
    expect(paystack.disableSubscription).toHaveBeenCalledWith({ code: 'SUB_1', token: 'tok' });
    // Nothing changes today: the plan is still live, with the move recorded.
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub-1' }, data: { cancelAtPeriodEnd: true, pendingProductId: 'starter-m' } });
    expect(prismaMock.subscription.update.mock.calls[0][0].data).not.toHaveProperty('status');
  });

  it('without a saved card the current plan just is not renewed, and we say it is not scheduled', async () => {
    const noCard = subscription({ id: 'sub-1', paystackSubscriptionCode: 'SUB_1', paystackEmailToken: 'tok', authorizationCode: null, paystackCustomerCode: null }, business());
    prismaMock.subscription.findMany.mockResolvedValue([noCard]);
    prismaMock.subscription.findUnique.mockResolvedValue(noCard);

    const result = await scheduleDowngrade('owner-1', 'starter-m');

    expect(result.scheduled).toBe(false);
    expect(paystack.createSubscription).not.toHaveBeenCalled();
    expect(prismaMock.subscription.update.mock.calls[0][0].data).toEqual({ cancelAtPeriodEnd: true, pendingProductId: null });
  });

  it('if Paystack cannot schedule it, nothing is changed and the plan keeps repeating', async () => {
    paystack.createSubscription.mockRejectedValue(new Error('down'));

    await expect(scheduleDowngrade('owner-1', 'starter-m')).rejects.toMatchObject({ code: 'PAYSTACK_UNAVAILABLE' });
    expect(paystack.disableSubscription).not.toHaveBeenCalled();
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });

  it('moving to Free is the same as cancelling: it runs to the end of the period', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'free', name: 'Free', active: true, planTier: 'FREE', interval: null });

    const result = await scheduleDowngrade('owner-1', 'free');

    expect(result).toMatchObject({ scheduled: true, to: 'Free' });
    expect(paystack.disableSubscription).toHaveBeenCalledWith({ code: 'SUB_1', token: 'tok' });
    expect(prismaMock.subscription.update.mock.calls[0][0].data).toMatchObject({ cancelAtPeriodEnd: true });
  });

  it('is only for smaller plans: a bigger or equal plan is a purchase, and Free has nothing to move from', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ ...business(), active: true, id: 'biz-m' });
    await expect(scheduleDowngrade('owner-1', 'biz-m')).rejects.toMatchObject({ code: 'NOT_A_DOWNGRADE' });

    prismaMock.subscription.findMany.mockResolvedValue([]);
    await expect(scheduleDowngrade('owner-1', 'starter-m')).rejects.toMatchObject({ code: 'NO_PLAN' });

    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);
    prismaMock.product.findUnique.mockResolvedValue(null);
    await expect(scheduleDowngrade('owner-1', 'nope')).rejects.toBeInstanceOf(BillingError);
  });
});

// ------------------------------------------------------------ hiring reports

describe('hiring reports', () => {
  const jobs = [
    { id: 'j1', title: 'Cook', status: 'ACTIVE', createdAt: new Date('2026-10-05T00:00:00Z') },
    { id: 'j2', title: 'Driver', status: 'CLOSED', createdAt: new Date('2026-09-20T00:00:00Z') },
    { id: 'old', title: 'Very old job', status: 'CLOSED', createdAt: new Date('2025-01-01T00:00:00Z') },
  ];
  const app = (jobId: string, createdAt: string, firstHours: number | null, status = 'SUBMITTED', changedAt?: string) => ({
    jobId,
    createdAt: new Date(createdAt),
    firstRespondedAt: firstHours === null ? null : new Date(new Date(createdAt).getTime() + firstHours * 3_600_000),
    status,
    statusChangedAt: changedAt ? new Date(changedAt) : null,
  });
  const report = (months = 3) =>
    buildHiringReport({
      jobs,
      months,
      now: NOW,
      applications: [
        app('j1', '2026-10-06T10:00:00Z', 2),
        app('j1', '2026-10-07T10:00:00Z', 6, 'HIRED', '2026-11-02T10:00:00Z'),
        app('j1', '2026-11-01T10:00:00Z', null),
        app('j2', '2026-09-21T10:00:00Z', 10, 'REJECTED', '2026-09-25T10:00:00Z'),
        app('old', '2025-01-02T10:00:00Z', 1),
      ],
      views: [
        { jobId: 'j1', createdAt: new Date('2026-10-06T08:00:00Z') },
        { jobId: 'j1', createdAt: new Date('2026-10-06T09:00:00Z') },
        { jobId: 'j1', createdAt: new Date('2026-11-03T09:00:00Z') },
        { jobId: 'j2', createdAt: new Date('2026-09-21T09:00:00Z') },
      ],
    });

  it('counts jobs posted, views, applications, hires and first response time, per job', () => {
    const [first, second] = report().byJob;

    expect(first).toMatchObject({ id: 'j1', title: 'Cook', views: 3, applications: 3, hires: 1, avgFirstResponseHours: 4 });
    expect(second).toMatchObject({ id: 'j2', views: 1, applications: 1, hires: 0, avgFirstResponseHours: 10 });
  });

  it('and per month, with hires counted in the month the person was hired', () => {
    const byMonth = report().byMonth;

    expect(byMonth.map((month) => month.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(byMonth[0]).toMatchObject({ jobsPosted: 1, views: 1, applications: 1, hires: 0, avgFirstResponseHours: 10 });
    expect(byMonth[1]).toMatchObject({ jobsPosted: 1, views: 2, applications: 2, hires: 0, avgFirstResponseHours: 4 });
    expect(byMonth[2]).toMatchObject({ jobsPosted: 0, views: 1, applications: 1, hires: 1, avgFirstResponseHours: null });
  });

  it('totals the window only, so a job posted long ago does not count', () => {
    const { totals } = report();

    expect(totals).toEqual({ jobsPosted: 2, views: 4, applications: 4, hires: 1, avgFirstResponseHours: 6 });
  });

  it('is for Business plans only, checked on the server', async () => {
    const free = await call(getHiringReport as never, owner);
    expect(free.status).toBe(403);
    expect(free.body.code).toBe('PLAN_REQUIRED');

    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);
    prismaMock.job.findMany.mockResolvedValue(jobs);
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.jobView.findMany.mockResolvedValue([]);

    const allowed = await call(getHiringReport as never, { ...owner, query: { months: '6' } });

    expect(allowed.body).toMatchObject({ success: true, months: 6 });
    expect(allowed.body.byMonth).toHaveLength(6);
    expect(prismaMock.job.findMany.mock.calls[0][0].where).toEqual({ employerId: 'owner-1' });
  });

  describe('counting views', () => {
    const view = (extra: Record<string, unknown> = {}) => call(trackJobView as never, { params: { id: 'j1' }, ...extra });

    beforeEach(() => {
      prismaMock.job.findFirst.mockResolvedValue({ id: 'j1', employerId: 'owner-1' });
      prismaMock.jobView.create.mockResolvedValue({});
    });

    it('counts a visitor once a day, and a repeat the same day is not counted', async () => {
      expect((await view()).body).toEqual({ success: true, counted: true });

      prismaMock.jobView.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));
      expect((await view()).body).toEqual({ success: true, counted: false });
    });

    it('does not count crawlers, link previews, or the company looking at its own job (the owner, or a team member)', async () => {
      for (const agent of ['Googlebot/2.1', 'WhatsApp/2.2', '']) expect((await view({ get: () => agent })).body.counted, agent).toBe(false);

      const token = jwt.sign({ id: 'owner-1', role: 'EMPLOYER', tokenVersion: 0 }, env.jwtSecret);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'owner-1', role: 'EMPLOYER', status: 'ACTIVE', tokenVersion: 0 });
      expect((await view({ header: () => `Bearer ${token}` })).body.counted).toBe(false);

      const memberToken = jwt.sign({ id: 'member-1', role: 'EMPLOYER', tokenVersion: 0 }, env.jwtSecret);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'member-1', role: 'EMPLOYER', status: 'ACTIVE', tokenVersion: 0 });
      prismaMock.teamMember.findFirst.mockResolvedValue({ id: 'tm-1' });
      expect((await view({ header: () => `Bearer ${memberToken}` })).body.counted).toBe(false);

      expect(prismaMock.jobView.create).not.toHaveBeenCalled();
    });

    it('only an open job can be counted', async () => {
      prismaMock.job.findFirst.mockResolvedValue(null);

      expect((await view()).status).toBe(404);
    });
  });
});

// -------------------------------------------------------------- CV database

describe('the CV database', () => {
  const profile = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    firstName: 'Ama',
    lastName: 'Mensah',
    skills: 'Excel, bookkeeping',
    experience: 'Three years in accounts. '.repeat(30),
    careerStage: 'GRADUATE',
    institution: 'University of Ghana',
    programme: 'BSc Accounting',
    user: { seekerCv: { uploadedUrl: '/api/uploads/cv/1-abc-cv.pdf', uploadedFileName: 'cv.pdf', builderUrl: null, builderFileName: null } },
    ...overrides,
  });

  it('is for Business plans only, checked on the server', async () => {
    const result = await call(searchCvDatabase as never, owner);

    expect(result.status).toBe(403);
    expect(result.body.code).toBe('PLAN_REQUIRED');
    expect(prismaMock.jobSeekerProfile.findMany).not.toHaveBeenCalled();
  });

  it('lists only people who chose to be found, with a summary and no contact details', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([profile('p1')]);

    const result = await call(searchCvDatabase as never, owner);

    expect(prismaMock.jobSeekerProfile.findMany.mock.calls[0][0].where).toMatchObject({ visibleToEmployers: true, user: { status: 'ACTIVE', role: 'SEEKER' } });
    expect(result.body.entries[0]).toMatchObject({ id: 'p1', name: 'Ama Mensah', skills: 'Excel, bookkeeping', cv: { url: '/api/uploads/cv/1-abc-cv.pdf', fileName: 'cv.pdf' } });
    expect(result.body.entries[0].experience.length).toBeLessThanOrEqual(400);
    expect(JSON.stringify(result.body)).not.toMatch(/email|phone|password/i);
  });

  it('every word searched for has to appear, in any case', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([profile('p1'), profile('p2', { skills: 'Welding', experience: 'Workshop', programme: 'Mechanical', institution: 'KNUST', firstName: 'Kofi' })]);

    expect((await call(searchCvDatabase as never, { ...owner, query: { q: 'EXCEL bookkeeping' } })).body.entries.map((entry: any) => entry.id)).toEqual(['p1']);
    expect((await call(searchCvDatabase as never, { ...owner, query: { q: 'excel welding' } })).body.total).toBe(0);
  });

  it('can narrow to students, NSS personnel or graduates', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([]);

    await call(searchCvDatabase as never, { ...owner, query: { stage: 'nss' } });

    expect(prismaMock.jobSeekerProfile.findMany.mock.calls[0][0].where.careerStage).toBe('NSS');
  });

  describe('opening the CV file', () => {
    const secret = env.jwtSecret;
    const file = `1730000000000-u${uploaderTag('seeker-1', secret)}-3f2a9c1e-cv.pdf`;
    const ref = parseUploadRef(`/api/uploads/cv/${file}`)!;
    const optedIn = { id: 'cv-1' };

    beforeEach(() => {
      prismaMock.application = { findFirst: vi.fn().mockResolvedValue(null) };
      prismaMock.seekerCv = { findFirst: vi.fn().mockResolvedValue(null) };
    });

    it('a company on a plan with the CV database can open the CV of someone who opted in', async () => {
      prismaMock.seekerCv.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(optedIn);
      prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);

      expect(await canViewUpload({ id: 'owner-1', role: 'EMPLOYER' }, ref)).toBe(true);
      expect(prismaMock.seekerCv.findFirst.mock.calls[1][0].where.user).toEqual({ status: 'ACTIVE', jobSeekerProfile: { is: { visibleToEmployers: true } } });
    });

    it('a team member opens it as the company', async () => {
      prismaMock.seekerCv.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(optedIn);
      prismaMock.teamMember.findFirst.mockResolvedValue({ ownerId: 'owner-1' });
      prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);

      expect(await canViewUpload({ id: 'member-1', role: 'EMPLOYER' }, ref)).toBe(true);
      expect(prismaMock.subscription.findMany.mock.calls[0][0].where.userId).toBe('owner-1');
    });

    it('not without the plan, even for someone who opted in', async () => {
      prismaMock.seekerCv.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(optedIn);

      expect(await canViewUpload({ id: 'owner-1', role: 'EMPLOYER' }, ref)).toBe(false);
    });

    it('not for someone who did not opt in, even with the plan', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);

      expect(await canViewUpload({ id: 'owner-1', role: 'EMPLOYER' }, ref)).toBe(false);
    });

    it('and never for a seeker, whatever they opted in to', async () => {
      prismaMock.seekerCv.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(optedIn);
      prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);

      expect(await canViewUpload({ id: 'seeker-2', role: 'SEEKER' }, ref)).toBe(false);
    });
  });

  it('a seeker can opt in on their profile, and the field is checked', () => {
    const parse = (body: unknown) => getProfileUpdateSchema('SEEKER').safeParse({ body }).success;

    expect(parse({ visibleToEmployers: true })).toBe(true);
    expect(parse({ visibleToEmployers: 'yes' })).toBe(false);
  });
});

// ------------------------------------------------ branded page & top employers

describe('the branded company page', () => {
  const company = (overrides: Record<string, unknown> = {}) => ({
    id: 'owner-1',
    createdAt: NOW,
    employerProfile: { companyName: 'Acme Ltd', industry: 'Retail', logoUrl: null, website: null, description: 'We sell things.', coverImageUrl: '/api/uploads/logo/cover.jpg', galleryJson: '["/api/uploads/logo/g1.jpg","/api/uploads/logo/g2.jpg"]', whyWorkWithUs: 'Great people.' },
    verificationRequests: [],
    jobsPosted: [],
    ...overrides,
  });
  const open = () => call(getCompany as never, { params: { id: 'owner-1' } });

  beforeEach(() => {
    prismaMock.user.findFirst.mockResolvedValue(company());
  });

  it('shows the cover image, gallery and "Why work with us" while the plan includes it', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, {})]);

    const result = await open();

    expect(result.body.company).toMatchObject({ isBranded: true, coverImageUrl: '/api/uploads/logo/cover.jpg', gallery: ['/api/uploads/logo/g1.jpg', '/api/uploads/logo/g2.jpg'], whyWorkWithUs: 'Great people.' });
  });

  it('hides them (without deleting them) when the plan ends, and never leaks the raw gallery', async () => {
    const result = await open();

    expect(result.body.company.isBranded).toBe(false);
    expect(result.body.company).not.toHaveProperty('coverImageUrl');
    expect(result.body.company).not.toHaveProperty('gallery');
    expect(result.body.company).not.toHaveProperty('whyWorkWithUs');
    expect(result.body.company).not.toHaveProperty('galleryJson');
    expect(result.body.company.companyName).toBe('Acme Ltd');
  });

  describe('editing it', () => {
    const save = (body: Record<string, unknown>) => call(updateProfile as never, { user: { id: 'owner-1', role: 'EMPLOYER' }, body });

    beforeEach(() => {
      prismaMock.employerProfile.update.mockImplementation(async ({ data }: any) => ({ ...data }));
    });

    it('needs a plan that includes it: on Free the server refuses to save a cover, gallery or "Why work with us"', async () => {
      for (const body of [{ coverImageUrl: '/api/uploads/logo/c.jpg' }, { gallery: ['/api/uploads/logo/a.jpg'] }, { whyWorkWithUs: 'We are great.' }]) {
        const result = await save(body);
        expect(result.status, JSON.stringify(body)).toBe(403);
        expect(result.body.code).toBe('PLAN_REQUIRED');
      }
      expect(prismaMock.employerProfile.update).not.toHaveBeenCalled();
    });

    it('with the plan it saves them (the gallery as a list), and clearing is always allowed', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([subscription({}, {})]);

      await save({ coverImageUrl: '/api/uploads/logo/c.jpg', gallery: ['/api/uploads/logo/a.jpg', '/api/uploads/logo/b.jpg'], whyWorkWithUs: 'We are great.' });
      expect(prismaMock.employerProfile.update.mock.calls[0][0].data).toMatchObject({ coverImageUrl: '/api/uploads/logo/c.jpg', galleryJson: '["/api/uploads/logo/a.jpg","/api/uploads/logo/b.jpg"]', whyWorkWithUs: 'We are great.' });

      prismaMock.subscription.findMany.mockResolvedValue([]);
      const cleared = await save({ coverImageUrl: '', gallery: [], whyWorkWithUs: '' });
      expect(cleared.status).toBe(200);
      expect(prismaMock.employerProfile.update.mock.calls[1][0].data).toMatchObject({ coverImageUrl: null, galleryJson: '[]' });
    });

    it('pictures must be uploaded through JobWahala, at most 6', () => {
      const parse = (body: unknown) => getProfileUpdateSchema('EMPLOYER').safeParse({ body }).success;

      expect(parse({ gallery: ['https://evil.example/x.jpg'] })).toBe(false);
      expect(parse({ coverImageUrl: 'https://evil.example/x.jpg' })).toBe(false);
      expect(parse({ gallery: Array.from({ length: 7 }, (_, i) => `/api/uploads/logo/${i}.jpg`) })).toBe(false);
    });
  });
});

describe('Top employers', () => {
  const employer = (id: string, verified: boolean, latestDays: number, plan?: 'BUSINESS' | 'STARTER' | 'EXPIRED') => ({
    id,
    employerProfile: { companyName: `Company ${id}`, industry: null, logoUrl: null },
    verificationRequests: verified ? [{ status: 'APPROVED', type: 'BUSINESS' }] : [],
    _count: { jobsPosted: 1 },
    jobsPosted: [{ createdAt: future(-latestDays) }],
    subscriptions: plan
      ? [{ status: plan === 'EXPIRED' ? 'PAST_DUE' : 'ACTIVE', currentPeriodEnd: future(plan === 'EXPIRED' ? -20 : 10), graceEndsAt: plan === 'EXPIRED' ? future(-5) : null, cancelAtPeriodEnd: false, product: { topEmployers: plan !== 'STARTER' } }]
      : [],
  });
  const order = async (employers: ReturnType<typeof employer>[]) => {
    prismaMock.user.findMany = vi.fn().mockResolvedValue(employers);
    const result = await call(listHiringCompanies as never, {});
    return result.body.companies.map((company: any) => company.id);
  };

  it('Business plans come first among companies with the same verification, then the most recent hirer', async () => {
    expect(await order([employer('plain-new', false, 1), employer('biz-old', false, 30, 'BUSINESS'), employer('plain-old', false, 20)])).toEqual(['biz-old', 'plain-new', 'plain-old']);
  });

  it('a paid plan never puts an unverified company above a verified one', async () => {
    expect(await order([employer('unverified-biz', false, 1, 'BUSINESS'), employer('verified-plain', true, 90)])).toEqual(['verified-plain', 'unverified-biz']);
  });

  it('only a plan that includes the priority counts: Starter does not, and neither does a Business plan whose grace is over', async () => {
    expect(await order([employer('plain-new', false, 1), employer('starter', false, 30, 'STARTER'), employer('lapsed', false, 40, 'EXPIRED')])).toEqual(['plain-new', 'starter', 'lapsed']);
  });

  it('does not tell anyone which company has priority', async () => {
    prismaMock.user.findMany = vi.fn().mockResolvedValue([employer('biz', false, 1, 'BUSINESS')]);

    const result = await call(listHiringCompanies as never, {});

    expect(JSON.stringify(result.body)).not.toMatch(/hasPriority|topEmployers|subscriptions/);
  });
});

// ------------------------------------------------------- what plans must not do

describe('plans and verification', () => {
  it('no plan setting touches verification: the verified flag comes only from an approved business verification', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'owner-1',
      createdAt: NOW,
      employerProfile: { companyName: 'Acme', industry: null, logoUrl: null, website: null, description: null, coverImageUrl: null, galleryJson: '[]', whyWorkWithUs: null },
      verificationRequests: [],
      jobsPosted: [],
    });
    prismaMock.subscription.findMany.mockResolvedValue([subscription({}, business())]);

    const result = await call(getCompany as never, { params: { id: 'owner-1' } });

    // On the top paid plan, and still not verified.
    expect(result.body.company.isVerified).toBe(false);
  });
});

describe('closing an account with a paid plan', () => {
  it('is blocked until the plan is cancelled, so the card is not charged again', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'EMPLOYER', email: 'boss@acme.example', phone: null });
    prismaMock.application = { count: vi.fn().mockResolvedValue(0) };
    prismaMock.job.count.mockResolvedValue(0);
    prismaMock.agreement = { count: vi.fn().mockResolvedValue(0) };
    prismaMock.payment = { count: vi.fn().mockResolvedValue(0) };
    prismaMock.agreementDispute = { count: vi.fn().mockResolvedValue(0) };
    prismaMock.subscription.count.mockResolvedValue(1);

    const preview = await getDeletionPreview('owner-1');

    expect(preview!.blockers.join(' ')).toMatch(/paid plan that will renew/);
    expect(prismaMock.subscription.count.mock.calls[0][0].where).toMatchObject({ userId: 'owner-1', cancelAtPeriodEnd: false });

    prismaMock.subscription.count.mockResolvedValue(0);
    expect((await getDeletionPreview('owner-1'))!.blockers).toEqual([]);
  });
});

describe('what admins can set on a plan', () => {
  const plan = { kind: 'SUBSCRIPTION', name: 'Business (monthly)', description: '', audience: 'EMPLOYER', priceGhs: 450, interval: 'MONTHLY', planTier: 'BUSINESS', teamLimit: 10, cvDatabase: true, brandedPage: true, hiringReports: true, topEmployers: true, featuredCredits: 6, boostCredits: 3, includes: [], active: true, sortOrder: 0 };
  const parse = (overrides: Record<string, unknown>) => createProductSchema.safeParse({ body: { ...plan, ...overrides } }).success;

  it('names, prices, seats, credits and features are all editable', () => {
    expect(parse({})).toBe(true);
    expect(parse({ teamLimit: 0 })).toBe(false);
    expect(parse({ teamLimit: 500 })).toBe(false);
    expect(parse({ planTier: 'PLATINUM' })).toBe(false);
  });

  it('the Free plan costs nothing and does not repeat; a paid plan cannot be free', () => {
    expect(parse({ planTier: 'FREE', priceGhs: 0, interval: null, name: 'Free' })).toBe(true);
    expect(parse({ planTier: 'FREE', priceGhs: 50, interval: null })).toBe(false);
    expect(parse({ priceGhs: 0 })).toBe(false);
  });

  it('a paid plan needs monthly or yearly, and only plans have a tier', () => {
    expect(parse({ interval: null })).toBe(false);
    expect(parse({ kind: 'JOB_PACK', planTier: 'STARTER', interval: null, durationDays: null, featuredCredits: 5 })).toBe(false);
  });
});

describe('the credit totals shown with a plan', () => {
  it('start from nothing', async () => {
    expect(await getCreditBalance('owner-1')).toEqual({ featuredCredits: 0, boostCredits: 0, plan: { featured: 0, boost: 0 }, purchased: { featured: 0, boost: 0 } });
  });
});

// keep the unused-request type referenced so the helper signatures above stay honest
export type _Unused = Request;
