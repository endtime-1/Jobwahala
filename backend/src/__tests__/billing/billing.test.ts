import crypto from 'crypto';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const m = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const mock: Record<string, any> = {
    product: m('findUnique', 'findFirst', 'findMany', 'create', 'update', 'count'),
    billingPayment: m('findUnique', 'findMany', 'create', 'update', 'updateMany'),
    billingSettings: m('findUnique', 'create', 'upsert', 'update'),
    subscription: m('findFirst', 'findUnique', 'findMany', 'create', 'update', 'updateMany'),
    creditAccount: m('findUnique', 'upsert', 'updateMany', 'update'),
    teamMember: m('findMany', 'update'),
    creditLedger: m('create', 'findMany'),
    paystackEvent: m('create', 'update', 'deleteMany'),
    billingRefund: m('create', 'updateMany'),
    job: m('findFirst', 'findUnique', 'update'),
    course: m('findFirst', 'findUnique', 'update'),
    employerProfile: m('findUnique'),
    user: m('findUnique', 'findFirst'),
    notification: m('create'),
    adminActionLog: m('create'),
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));
const alertsMock = vi.hoisted(() => ({ notifyJobAlerts: vi.fn() }));
vi.mock('../../services/jobAlertService', () => alertsMock);

import env from '../../config/env';
import { handlePaystackBillingWebhook, downloadReceipt, getPaymentStatus, startCheckout } from '../../controllers/billingController';
import { createProductSchema, refundSchema, settingsSchema, creditAdjustmentSchema } from '../../validation/billingSchemas';
import {
  BillingError,
  adjustCredits,
  cancelSubscription,
  confirmPayment,
  createCheckout,
  listCatalogue,
  refundPayment,
  revenueReport,
  runBillingSweep,
  setBillingDepsForTests,
  spendCredit,
} from '../../services/billingService';
import { isValidPaystackSignature, paystackMode, type PaystackClient } from '../../services/paystackBilling';
import {
  DEFAULT_PRODUCTS,
  addInterval,
  extendPromotion,
  formatGhs,
  ghsToPesewas,
  includesList,
  priceWithVat,
  promotionOf,
  receiptNumber,
} from '../../utils/billing';
import { renderReceiptHtml } from '../../utils/receiptRender';
import { DEFAULT_PLANS } from '../../utils/plans';
import { rankJobsByVerification } from '../../utils/verification';

const SECRET = 'sk_test_unit_test_secret';
const DAY = 86_400_000;
const NOW = new Date('2026-11-10T10:00:00.000Z');
const settings = { vatRatePercent: 15, pricesIncludeVat: true, companyName: 'JobWahala Ltd', companyAddress: 'Accra', companyTin: 'C0012345678', companyEmail: 'billing@jobwahala.com', companyPhone: '', receiptFooter: 'Thank you.' };

const paystack = {
  initialize: vi.fn(),
  verify: vi.fn(),
  createPlan: vi.fn(),
  refund: vi.fn(),
  disableSubscription: vi.fn(),
};
const mail = { receipt: vi.fn(), failed: vi.fn(), reminder: vi.fn(), grace: vi.fn() };

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 'prod-1',
  kind: 'FEATURED_JOB',
  slug: 'featured-job',
  name: 'Featured job (30 days)',
  description: '',
  audience: 'EMPLOYER',
  pricePesewas: 5000,
  durationDays: 30,
  featuredCredits: 0,
  boostCredits: 0,
  interval: null,
  includesJson: '[]',
  active: true,
  sortOrder: 0,
  paystackPlanCode: null,
  paystackPlanAmount: null,
  ...overrides,
});

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay-1',
  userId: 'emp-1',
  productId: 'prod-1',
  productKind: 'FEATURED_JOB',
  productName: 'Featured job (30 days)',
  targetType: 'JOB',
  targetId: 'job-1',
  reference: 'JWB-REF-1',
  status: 'PENDING',
  subtotalPesewas: 4348,
  vatPesewas: 652,
  totalPesewas: 5000,
  vatRateBps: 1500,
  billToEmail: 'hr@acme.example',
  billToName: 'Acme Ltd',
  subscriptionId: null,
  refundedPesewas: 0,
  receiptNumber: null,
  ...overrides,
});

const paidTx = (amount = 5000) => ({ status: 'success', amountPesewas: amount, currency: 'GHS', channel: 'mobile_money', paidAt: NOW.toISOString(), failureReason: null });

beforeEach(() => {
  vi.clearAllMocks();
  (env as { paystackSecretKey: string }).paystackSecretKey = SECRET;
  setBillingDepsForTests({ paystack: paystack as unknown as PaystackClient, mail });
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
  prismaMock.billingSettings.findUnique.mockResolvedValue(settings);
  prismaMock.billingSettings.upsert.mockResolvedValue({ receiptSeq: 7 });
  prismaMock.billingPayment.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.billingPayment.findUnique.mockResolvedValue(payment());
  prismaMock.billingPayment.create.mockImplementation(async ({ data }: any) => ({ id: 'pay-new', ...data }));
  prismaMock.product.findUnique.mockResolvedValue(product());
  prismaMock.notification.create.mockResolvedValue({ id: 'n' });
  prismaMock.adminActionLog.create.mockResolvedValue({});
  prismaMock.paystackEvent.create.mockResolvedValue({});
  prismaMock.paystackEvent.update.mockResolvedValue({});
  prismaMock.job.findUnique.mockResolvedValue({ featuredUntil: null, boostedUntil: null, id: 'job-1', employerId: 'emp-1', title: 'Cook', description: 'd', location: 'Accra', type: 'Full-time', category: null });
  prismaMock.course.findUnique.mockResolvedValue({ featuredFrom: null, featuredUntil: null });
  prismaMock.creditAccount.findUnique.mockResolvedValue({ featuredCredits: 5, boostCredits: 5, planFeaturedCredits: 0, planBoostCredits: 0 });
  prismaMock.subscription.findMany.mockResolvedValue([]);
  prismaMock.product.findFirst.mockResolvedValue(null);
  prismaMock.teamMember.findMany.mockResolvedValue([]);
  paystack.verify.mockResolvedValue(paidTx());
  paystack.initialize.mockResolvedValue({ authorizationUrl: 'https://checkout.paystack.com/abc' });
  paystack.createPlan.mockResolvedValue({ planCode: 'PLN_new' });
  paystack.refund.mockResolvedValue({ refundId: 'rf-1', status: 'processed' });
  paystack.disableSubscription.mockResolvedValue(undefined);
  for (const send of Object.values(mail)) send.mockResolvedValue(undefined);
});

// ----------------------------------------------------------------- money

describe('money and VAT', () => {
  it('turns cedis into whole pesewas', () => {
    expect(ghsToPesewas(45)).toBe(4500);
    expect(ghsToPesewas('1,250.50')).toBe(125050);
    expect(ghsToPesewas(0.1 + 0.2)).toBe(30);
    expect(ghsToPesewas(-1)).toBeNull();
    expect(ghsToPesewas('abc')).toBeNull();
    expect(formatGhs(125050)).toBe('GHS 1,250.50');
  });

  it('with prices that include VAT, the listed price is the total and the parts add up', () => {
    const money = priceWithVat(11500, { vatRatePercent: 15, pricesIncludeVat: true });

    expect(money).toEqual({ subtotalPesewas: 10000, vatPesewas: 1500, totalPesewas: 11500, vatRateBps: 1500 });
    for (const price of [1, 99, 5000, 12345, 150000]) {
      const split = priceWithVat(price, { vatRatePercent: 15, pricesIncludeVat: true });
      expect(split.subtotalPesewas + split.vatPesewas).toBe(price);
    }
  });

  it('with prices before VAT, VAT is added on top', () => {
    expect(priceWithVat(10000, { vatRatePercent: 15, pricesIncludeVat: false })).toEqual({ subtotalPesewas: 10000, vatPesewas: 1500, totalPesewas: 11500, vatRateBps: 1500 });
  });

  it('a rate of 0 means no VAT, and a changed rate is used', () => {
    expect(priceWithVat(5000, { vatRatePercent: 0, pricesIncludeVat: true }).vatPesewas).toBe(0);
    expect(priceWithVat(10000, { vatRatePercent: 12.5, pricesIncludeVat: false }).vatRateBps).toBe(1250);
  });

  it('numbers receipts in order, per year', () => {
    expect(receiptNumber(2026, 123)).toBe('JW-2026-000123');
  });

  it('plans renew a calendar month or year on, clipped to the month length', () => {
    expect(addInterval(new Date('2026-01-31T10:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addInterval(new Date('2026-03-15T10:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-04-15T10:00:00.000Z');
    expect(addInterval(new Date('2026-11-10T10:00:00Z'), 'YEARLY').toISOString()).toBe('2027-11-10T10:00:00.000Z');
    expect(addInterval(new Date('2028-02-29T10:00:00Z'), 'YEARLY').toISOString()).toBe('2029-02-28T10:00:00.000Z');
  });

  it('a promotion bought while one is running is added on to it', () => {
    expect(extendPromotion(null, 30, NOW).getTime()).toBe(NOW.getTime() + 30 * DAY);
    expect(extendPromotion(new Date(NOW.getTime() + 10 * DAY), 30, NOW).getTime()).toBe(NOW.getTime() + 40 * DAY);
    expect(extendPromotion(new Date(NOW.getTime() - 5 * DAY), 30, NOW).getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('lists what a product includes, with credits spelled out', () => {
    expect(includesList({ includesJson: '["Cancel any time"]', featuredCredits: 3, boostCredits: 1, interval: 'MONTHLY' })).toEqual([
      'Cancel any time',
      '3 featured job credits every month',
      '1 "Urgently hiring" boost credit every month',
    ]);
    expect(includesList({ includesJson: 'not json' })).toEqual([]);
  });

  it('starts the catalogue with the one-off products, and the Free, Starter and Business plans (monthly and yearly)', () => {
    expect(new Set(DEFAULT_PRODUCTS.map((item) => item.kind))).toEqual(new Set(['FEATURED_JOB', 'JOB_BOOST', 'JOB_PACK', 'FEATURED_COURSE']));
    expect(DEFAULT_PLANS.map((plan) => `${plan.planTier}/${plan.interval}`)).toEqual(['FREE/null', 'STARTER/MONTHLY', 'STARTER/YEARLY', 'BUSINESS/MONTHLY', 'BUSINESS/YEARLY']);
  });
});

// -------------------------------------------------------- labels & ranking

describe('Featured and Urgently hiring', () => {
  const future = new Date(NOW.getTime() + DAY);
  const past = new Date(NOW.getTime() - DAY);

  it('shows the label while the promotion runs, and nothing after it ends', () => {
    expect(promotionOf({ featuredUntil: future }, NOW)).toBe('FEATURED');
    expect(promotionOf({ boostedUntil: future }, NOW)).toBe('URGENT');
    expect(promotionOf({ featuredUntil: future, boostedUntil: future }, NOW)).toBe('URGENT');
    expect(promotionOf({ featuredUntil: past, boostedUntil: past }, NOW)).toBeNull();
    expect(promotionOf({}, NOW)).toBeNull();
  });

  const job = (id: string, verified: boolean, createdDaysAgo: number, extra: Record<string, unknown> = {}) => ({ id, createdAt: new Date(NOW.getTime() - createdDaysAgo * DAY), employer: { isVerified: verified }, ...extra });
  const order = (jobs: ReturnType<typeof job>[]) => rankJobsByVerification(jobs, NOW).map((entry) => entry.id);

  it('a promoted job ranks above an unpromoted one with the same verification', () => {
    expect(order([job('new', true, 1), job('old-featured', true, 20, { featuredUntil: future }), job('old-urgent', true, 30, { boostedUntil: future })])).toEqual(['old-featured', 'old-urgent', 'new']);
  });

  it('verified jobs always rank above unverified ones, paid or not', () => {
    expect(order([job('unverified-featured', false, 1, { featuredUntil: future, boostedUntil: future }), job('verified-plain', true, 90)])).toEqual(['verified-plain', 'unverified-featured']);
  });

  it('promotion only lifts a job among equals: unverified promoted still beats unverified plain', () => {
    expect(order([job('plain', false, 1), job('promoted', false, 50, { featuredUntil: future })])).toEqual(['promoted', 'plain']);
  });

  it('an ended promotion no longer ranks, and ties go to the newest', () => {
    expect(order([job('expired', true, 1, { featuredUntil: past }), job('plain-older', true, 5)])).toEqual(['expired', 'plain-older']);
    expect(order([job('older', true, 9, { featuredUntil: future }), job('newer', true, 2, { featuredUntil: future })])).toEqual(['newer', 'older']);
  });
});

// ------------------------------------------------------------- signatures

describe('checking that a webhook is really from Paystack', () => {
  const body = Buffer.from('{"event":"charge.success","data":{"reference":"JWB-REF-1"}}');
  const sign = (raw: Buffer | string, secret = SECRET) => crypto.createHmac('sha512', secret).update(raw).digest('hex');

  it('accepts a signature made with our secret over the exact bytes sent', () => {
    expect(isValidPaystackSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('refuses a wrong secret, a changed body, a missing signature, junk, and no secret', () => {
    expect(isValidPaystackSignature(body, sign(body, 'sk_test_other'), SECRET)).toBe(false);
    expect(isValidPaystackSignature(Buffer.from(body.toString().replace('JWB-REF-1', 'JWB-REF-2')), sign(body), SECRET)).toBe(false);
    expect(isValidPaystackSignature(body, undefined, SECRET)).toBe(false);
    expect(isValidPaystackSignature(body, 'not-hex-at-all', SECRET)).toBe(false);
    expect(isValidPaystackSignature(body, sign(body), '')).toBe(false);
    expect(isValidPaystackSignature(undefined, sign(body), SECRET)).toBe(false);
  });

  it('is checked on the raw bytes: pretty-printing the same JSON does not pass', () => {
    const pretty = Buffer.from(JSON.stringify(JSON.parse(body.toString()), null, 2));

    expect(isValidPaystackSignature(pretty, sign(body), SECRET)).toBe(false);
  });

  it('knows test keys from live keys, and no key', () => {
    expect(paystackMode('sk_test_abc')).toBe('test');
    expect(paystackMode('sk_live_abc')).toBe('live');
    expect(paystackMode('')).toBe('off');
  });
});

// ------------------------------------------------------------- the catalogue

describe('the catalogue', () => {
  it('fills itself with the starting products the first time, and shows only active ones', async () => {
    prismaMock.product.count.mockResolvedValue(0);
    prismaMock.product.create.mockResolvedValue({});
    prismaMock.product.findMany.mockResolvedValue([product(), product({ id: 'prov', audience: 'PROVIDER', kind: 'FEATURED_COURSE' })]);
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isTrainingProvider: false });

    const result = await listCatalogue({ id: 'emp-1' });

    expect(prismaMock.product.create).toHaveBeenCalledTimes(DEFAULT_PRODUCTS.length + DEFAULT_PLANS.length);
    expect(prismaMock.product.findMany.mock.calls[0][0].where).toEqual({ active: true });
    expect(result.map((item) => item.id)).toEqual(['prod-1']);
  });

  it('training providers also see the products made for them, each with the VAT worked out', async () => {
    prismaMock.product.count.mockResolvedValue(6);
    prismaMock.product.findMany.mockResolvedValue([product({ id: 'prov', audience: 'PROVIDER', kind: 'FEATURED_COURSE', pricePesewas: 11500 })]);
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isTrainingProvider: true });

    const [item] = await listCatalogue({ id: 'prov-1' });

    expect(item).toMatchObject({ id: 'prov', totalPesewas: 11500, vatPesewas: 1500, totalLabel: 'GHS 115.00', priceGhs: 115 });
  });
});

describe('what an admin can set', () => {
  const body = { kind: 'FEATURED_JOB', name: 'Featured job', description: '', audience: 'EMPLOYER', priceGhs: 50, durationDays: 30, featuredCredits: 0, boostCredits: 0, includes: ['One'], active: true, sortOrder: 0 };
  const parse = (overrides: Record<string, unknown>) => createProductSchema.safeParse({ body: { ...body, ...overrides } }).success;

  it('accepts a complete product', () => expect(parse({})).toBe(true));
  it('promotions need a duration, packs need credits, plans need monthly or yearly', () => {
    expect(parse({ durationDays: null })).toBe(false);
    expect(parse({ kind: 'JOB_PACK', durationDays: null, featuredCredits: 0 })).toBe(false);
    expect(parse({ kind: 'JOB_PACK', durationDays: null, featuredCredits: 5 })).toBe(true);
    expect(parse({ kind: 'SUBSCRIPTION', durationDays: null })).toBe(false);
    expect(parse({ kind: 'SUBSCRIPTION', durationDays: null, interval: 'MONTHLY', featuredCredits: 2 })).toBe(true);
    expect(parse({ interval: 'MONTHLY' })).toBe(false);
  });
  it('featured courses are for providers, and prices and kinds are checked', () => {
    expect(parse({ kind: 'FEATURED_COURSE' })).toBe(false);
    expect(parse({ kind: 'FEATURED_COURSE', audience: 'PROVIDER' })).toBe(true);
    expect(parse({ priceGhs: 0 })).toBe(false);
    expect(parse({ kind: 'GOLD_BAR' })).toBe(false);
  });
  it('settings: VAT between 0 and 50, a company name; refunds and credit changes need a reason', () => {
    const settingsBody = { vatRatePercent: 15, pricesIncludeVat: true, companyName: 'JobWahala Ltd' };
    expect(settingsSchema.safeParse({ body: settingsBody }).success).toBe(true);
    expect(settingsSchema.safeParse({ body: { ...settingsBody, vatRatePercent: 80 } }).success).toBe(false);
    expect(refundSchema.safeParse({ params: { id: 'p' }, body: { reason: 'ok' } }).success).toBe(false);
    expect(refundSchema.safeParse({ params: { id: 'p' }, body: { reason: 'Customer paid twice' } }).success).toBe(true);
    expect(creditAdjustmentSchema.safeParse({ body: { email: 'a@b.com', type: 'FEATURE', delta: 0, reason: 'Gift credit' } }).success).toBe(false);
    expect(creditAdjustmentSchema.safeParse({ body: { email: 'a@b.com', type: 'FEATURE', delta: 2, reason: 'Gift credit' } }).success).toBe(true);
  });
});

// ------------------------------------------------------------------ checkout

describe('checkout', () => {
  const user = { userId: 'emp-1', email: 'hr@acme.example', name: 'Acme Ltd' };

  beforeEach(() => {
    prismaMock.job.findFirst.mockResolvedValue({ id: 'job-1' });
    prismaMock.course.findFirst.mockResolvedValue({ id: 'course-1' });
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isTrainingProvider: true });
  });

  it('works out the price on the server and sends that to Paystack, with a receipt-ready record', async () => {
    const result = await createCheckout({ ...user, productId: 'prod-1', targetId: 'job-1' });

    expect(result).toMatchObject({ authorizationUrl: 'https://checkout.paystack.com/abc', mode: 'test' });
    expect(prismaMock.billingPayment.create.mock.calls[0][0].data).toMatchObject({
      userId: 'emp-1',
      productKind: 'FEATURED_JOB',
      targetType: 'JOB',
      targetId: 'job-1',
      totalPesewas: 5000,
      vatPesewas: 652,
      subtotalPesewas: 4348,
      vatRateBps: 1500,
      billToEmail: 'hr@acme.example',
    });
    const sent = paystack.initialize.mock.calls[0][0];
    expect(sent).toMatchObject({ email: 'hr@acme.example', amountPesewas: 5000 });
    expect(sent.reference).toBe(prismaMock.billingPayment.create.mock.calls[0][0].data.reference);
    expect(sent.callbackUrl).toContain('/billing?reference=');
  });

  it('a job promotion needs one of your own open jobs, a course one of your live courses', async () => {
    prismaMock.job.findFirst.mockResolvedValue(null);
    await expect(createCheckout({ ...user, productId: 'prod-1', targetId: 'someone-elses' })).rejects.toMatchObject({ code: 'JOB_REQUIRED' });
    await expect(createCheckout({ ...user, productId: 'prod-1' })).rejects.toMatchObject({ code: 'JOB_REQUIRED' });
    expect(prismaMock.job.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'someone-elses', employerId: 'emp-1', status: 'ACTIVE' });

    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'FEATURED_COURSE', audience: 'PROVIDER' }));
    prismaMock.course.findFirst.mockResolvedValue(null);
    await expect(createCheckout({ ...user, productId: 'prod-1', targetId: 'c' })).rejects.toMatchObject({ code: 'COURSE_REQUIRED' });
    expect(prismaMock.billingPayment.create).not.toHaveBeenCalled();
  });

  it('a pack needs no target', async () => {
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'JOB_PACK', featuredCredits: 5 }));

    await createCheckout({ ...user, productId: 'prod-1' });

    expect(prismaMock.billingPayment.create.mock.calls[0][0].data.targetId).toBeNull();
  });

  it('refuses products that are off, unknown, or for providers only', async () => {
    prismaMock.product.findUnique.mockResolvedValue(product({ active: false }));
    await expect(createCheckout({ ...user, productId: 'prod-1' })).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });

    prismaMock.product.findUnique.mockResolvedValue(null);
    await expect(createCheckout({ ...user, productId: 'nope' })).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });

    prismaMock.product.findUnique.mockResolvedValue(product({ audience: 'PROVIDER', kind: 'FEATURED_COURSE' }));
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isTrainingProvider: false });
    await expect(createCheckout({ ...user, productId: 'prod-1', targetId: 'c' })).rejects.toMatchObject({ code: 'PROVIDER_ONLY' });
  });

  it('a plan gets a Paystack plan made once, and reused while the price stays the same', async () => {
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'SUBSCRIPTION', interval: 'MONTHLY', pricePesewas: 15000 }));

    await createCheckout({ ...user, productId: 'prod-1' });
    expect(paystack.createPlan).toHaveBeenCalledWith({ name: 'Featured job (30 days)', amountPesewas: 15000, interval: 'monthly' });
    expect(prismaMock.product.update).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { paystackPlanCode: 'PLN_new', paystackPlanAmount: 15000 } });
    expect(paystack.initialize.mock.calls[0][0].plan).toBe('PLN_new');

    paystack.createPlan.mockClear();
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'SUBSCRIPTION', interval: 'YEARLY', pricePesewas: 15000, paystackPlanCode: 'PLN_old', paystackPlanAmount: 15000 }));
    await createCheckout({ ...user, productId: 'prod-1' });
    expect(paystack.createPlan).not.toHaveBeenCalled();
    expect(paystack.initialize.mock.calls[1][0].plan).toBe('PLN_old');
  });

  it('a changed price means a new plan; the plan includes VAT when prices exclude it', async () => {
    prismaMock.billingSettings.findUnique.mockResolvedValue({ ...settings, pricesIncludeVat: false });
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'SUBSCRIPTION', interval: 'YEARLY', pricePesewas: 100000, paystackPlanCode: 'PLN_old', paystackPlanAmount: 100000 }));

    await createCheckout({ ...user, productId: 'prod-1' });

    expect(paystack.createPlan).toHaveBeenCalledWith(expect.objectContaining({ amountPesewas: 115000, interval: 'annually' }));
  });

  const livePlan = (overrides: Record<string, unknown> = {}, productOverrides: Record<string, unknown> = {}) => ({
    id: 'sub-1',
    status: 'ACTIVE',
    currentPeriodEnd: new Date(NOW.getTime() + 20 * DAY),
    graceEndsAt: null,
    cancelAtPeriodEnd: false,
    pendingProductId: null,
    product: product({ id: 'prod-1', kind: 'SUBSCRIPTION', planTier: 'STARTER', interval: 'MONTHLY', teamLimit: 3, brandedPage: true, featuredCredits: 2, boostCredits: 1, ...productOverrides }),
    ...overrides,
  });

  it('cannot take the same plan twice', async () => {
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'SUBSCRIPTION', interval: 'MONTHLY', planTier: 'STARTER' }));
    prismaMock.subscription.findMany.mockResolvedValue([livePlan()]);

    await expect(createCheckout({ ...user, productId: 'prod-1' })).rejects.toMatchObject({ code: 'ALREADY_SUBSCRIBED' });
  });

  it('moving UP to a bigger plan is a purchase, and takes effect straight away', async () => {
    prismaMock.product.findUnique.mockResolvedValue(product({ id: 'biz', kind: 'SUBSCRIPTION', interval: 'MONTHLY', planTier: 'BUSINESS', pricePesewas: 45000 }));
    prismaMock.subscription.findMany.mockResolvedValue([livePlan()]);

    const result = await createCheckout({ ...user, productId: 'biz' });

    expect(result.authorizationUrl).toContain('paystack');
    expect(paystack.createPlan).toHaveBeenCalledWith(expect.objectContaining({ amountPesewas: 45000 }));
  });

  it('moving DOWN is refused at checkout: it has to wait for the end of the period, through "Change plan"', async () => {
    prismaMock.product.findUnique.mockResolvedValue(product({ id: 'starter', kind: 'SUBSCRIPTION', interval: 'MONTHLY', planTier: 'STARTER' }));
    prismaMock.subscription.findMany.mockResolvedValue([livePlan({}, { id: 'biz', planTier: 'BUSINESS', interval: 'MONTHLY' })]);

    await expect(createCheckout({ ...user, productId: 'starter' })).rejects.toMatchObject({ code: 'USE_DOWNGRADE' });
    expect(prismaMock.billingPayment.create).not.toHaveBeenCalled();
  });

  it('the Free plan cannot be bought', async () => {
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'SUBSCRIPTION', planTier: 'FREE', pricePesewas: 0 }));

    await expect(createCheckout({ ...user, productId: 'prod-1' })).rejects.toMatchObject({ code: 'FREE_PLAN' });
  });

  it('says so, and charges nothing, when Paystack cannot be reached', async () => {
    paystack.initialize.mockRejectedValue(new Error('network'));

    await expect(createCheckout({ ...user, productId: 'prod-1', targetId: 'job-1' })).rejects.toMatchObject({ status: 502, code: 'PAYSTACK_UNAVAILABLE' });
    expect(prismaMock.billingPayment.update.mock.calls[0][0].data.status).toBe('FAILED');
  });

  it('is closed with a plain message while there is no Paystack key', async () => {
    (env as { paystackSecretKey: string }).paystackSecretKey = '';

    await expect(createCheckout({ ...user, productId: 'prod-1' })).rejects.toMatchObject({ status: 503, code: 'PAYMENTS_NOT_SET_UP' });
  });

  it('the endpoint needs an email on the account, and never reads a price from the request', async () => {
    const respond = () => {
      const state: { status: number; body: any } = { status: 200, body: undefined };
      const res = { status(c: number) { state.status = c; return this; }, json(v: unknown) { state.body = v; return this; } } as unknown as Response;
      return { res, state };
    };
    prismaMock.user.findUnique.mockResolvedValue({ email: null, employerProfile: null });
    const first = respond();
    await startCheckout({ user: { id: 'emp-1' }, body: { productId: 'prod-1', amount: 1 } } as never, first.res);
    expect(first.state.status).toBe(400);
    expect(first.state.body.code).toBe('EMAIL_REQUIRED');

    prismaMock.user.findUnique.mockResolvedValue({ email: 'hr@acme.example', employerProfile: { companyName: 'Acme Ltd' } });
    prismaMock.job.findFirst.mockResolvedValue({ id: 'job-1' });
    const second = respond();
    await startCheckout({ user: { id: 'emp-1' }, body: { productId: 'prod-1', targetId: 'job-1', amount: 1 } } as never, second.res);
    expect(second.state.status).toBe(201);
    expect(paystack.initialize.mock.calls[0][0].amountPesewas).toBe(5000);
  });
});

// --------------------------------------------------------------- fulfilment

describe('settling a payment', () => {
  it('asks Paystack, marks it paid with the next receipt number, and emails the receipt', async () => {
    const result = await confirmPayment('JWB-REF-1', NOW);

    expect(paystack.verify).toHaveBeenCalledWith('JWB-REF-1');
    expect(result).toEqual({ status: 'PAID', receiptNumber: 'JW-2026-000007' });
    expect(prismaMock.billingPayment.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'pay-1', status: 'PENDING' }, data: { status: 'PAID', channel: 'mobile_money', receiptNumber: 'JW-2026-000007' } });
    await vi.waitFor(() => expect(mail.receipt).toHaveBeenCalledWith('hr@acme.example', expect.objectContaining({ receiptNumber: 'JW-2026-000007', total: 'GHS 50.00', vat: 'GHS 6.52' })));
  });

  it('a Featured Job purchase features that job for the product\'s days', async () => {
    await confirmPayment('JWB-REF-1', NOW);

    const data = prismaMock.job.update.mock.calls[0][0].data;
    expect(data.featuredUntil.getTime()).toBe(NOW.getTime() + 30 * DAY);
    expect(prismaMock.job.update.mock.calls[0][0].where.id).toBe('job-1');
  });

  it('a purchase made while the job is already featured is added on', async () => {
    prismaMock.job.findUnique.mockResolvedValue({ featuredUntil: new Date(NOW.getTime() + 10 * DAY) });

    await confirmPayment('JWB-REF-1', NOW);

    expect(prismaMock.job.update.mock.calls[0][0].data.featuredUntil.getTime()).toBe(NOW.getTime() + 40 * DAY);
  });

  it('a Boost purchase marks the job "Urgently hiring" and tells matching job alerts', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(payment({ productKind: 'JOB_BOOST' }));
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'JOB_BOOST', durationDays: 7 }));

    await confirmPayment('JWB-REF-1', NOW);

    expect(prismaMock.job.update.mock.calls[0][0].data.boostedUntil.getTime()).toBe(NOW.getTime() + 7 * DAY);
    expect(alertsMock.notifyJobAlerts).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));
  });

  it('a pack gives its credits and records them', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(payment({ productKind: 'JOB_PACK', targetId: null, targetType: null }));
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'JOB_PACK', featuredCredits: 5, boostCredits: 2 }));

    await confirmPayment('JWB-REF-1', NOW);

    expect(prismaMock.creditAccount.upsert.mock.calls[0][0]).toMatchObject({ where: { userId: 'emp-1' }, update: { featuredCredits: { increment: 5 }, boostCredits: { increment: 2 } } });
    expect(prismaMock.creditLedger.create.mock.calls.map((call: any[]) => call[0].data)).toEqual([
      expect.objectContaining({ creditType: 'FEATURE', delta: 5, reason: 'PURCHASE', paymentId: 'pay-1' }),
      expect.objectContaining({ creditType: 'BOOST', delta: 2, reason: 'PURCHASE', paymentId: 'pay-1' }),
    ]);
  });

  it('a Featured Course purchase features the course', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(payment({ productKind: 'FEATURED_COURSE', targetType: 'COURSE', targetId: 'course-1' }));
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'FEATURED_COURSE', durationDays: 30 }));

    await confirmPayment('JWB-REF-1', NOW);

    const data = prismaMock.course.update.mock.calls[0][0].data;
    expect(data.featuredFrom).toEqual(NOW);
    expect(data.featuredUntil.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('a first subscription payment starts the plan for a month and gives that month\'s credits', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(payment({ productKind: 'SUBSCRIPTION', targetId: null, targetType: null }));
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'SUBSCRIPTION', interval: 'MONTHLY', planTier: 'STARTER', featuredCredits: 3, boostCredits: 2 }));
    prismaMock.subscription.create.mockResolvedValue({ id: 'sub-1' });
    paystack.verify.mockResolvedValue({ ...paidTx(), authorizationCode: 'AUTH_1', customerCode: 'CUS_1' });

    await confirmPayment('JWB-REF-1', NOW);

    const data = prismaMock.subscription.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'emp-1', productId: 'prod-1', status: 'ACTIVE', authorizationCode: 'AUTH_1', paystackCustomerCode: 'CUS_1' });
    expect(data.currentPeriodEnd.toISOString()).toBe('2026-12-10T10:00:00.000Z');
    expect(data.nextCreditGrantAt.toISOString()).toBe('2026-12-10T10:00:00.000Z');
    expect(prismaMock.billingPayment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { subscriptionId: 'sub-1' } });
    // The month's credits go in the plan bucket (which expires), not the bought-credits bucket.
    expect(prismaMock.creditAccount.upsert.mock.calls[0][0].update).toEqual({ planFeaturedCredits: 3, planBoostCredits: 2 });
  });

  it('an UPGRADE ends the old plan today (and stops it repeating at Paystack) and starts the new one', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(payment({ productKind: 'SUBSCRIPTION', targetId: null, targetType: null }));
    prismaMock.product.findUnique.mockResolvedValue(product({ id: 'biz', kind: 'SUBSCRIPTION', interval: 'MONTHLY', planTier: 'BUSINESS', featuredCredits: 6, boostCredits: 3 }));
    prismaMock.subscription.findMany.mockResolvedValueOnce([{ id: 'old-sub', paystackSubscriptionCode: 'SUB_OLD', paystackEmailToken: 'tok-old' }]);
    prismaMock.subscription.create.mockResolvedValue({ id: 'new-sub' });

    await confirmPayment('JWB-REF-1', NOW);

    expect(prismaMock.subscription.update).toHaveBeenCalledWith({ where: { id: 'old-sub' }, data: expect.objectContaining({ status: 'CANCELLED', currentPeriodEnd: NOW, pendingProductId: null }) });
    await vi.waitFor(() => expect(paystack.disableSubscription).toHaveBeenCalledWith({ code: 'SUB_OLD', token: 'tok-old' }));
    expect(prismaMock.subscription.create.mock.calls[0][0].data.productId).toBe('biz');
  });

  it('unused monthly credits expire when the new month\'s credits arrive, and both steps are in the ledger; bought credits stay', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(payment({ productKind: 'SUBSCRIPTION', targetId: null, subscriptionId: 'sub-1' }));
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'SUBSCRIPTION', interval: 'MONTHLY', planTier: 'STARTER', featuredCredits: 2, boostCredits: 1 }));
    prismaMock.subscription.findUnique.mockResolvedValue({ id: 'sub-1', currentPeriodEnd: NOW });
    prismaMock.creditAccount.findUnique.mockResolvedValue({ featuredCredits: 4, boostCredits: 0, planFeaturedCredits: 1, planBoostCredits: 0 });

    await confirmPayment('JWB-REF-1', NOW);

    const upsert = prismaMock.creditAccount.upsert.mock.calls[0][0];
    expect(upsert.update).toEqual({ planFeaturedCredits: 2, planBoostCredits: 1 });
    expect(upsert.update).not.toHaveProperty('featuredCredits');
    expect(prismaMock.creditLedger.create.mock.calls.map((call: any[]) => [call[0].data.creditType, call[0].data.delta, call[0].data.reason])).toEqual([
      ['FEATURE', -1, 'EXPIRY'],
      ['FEATURE', 2, 'SUBSCRIPTION'],
      ['BOOST', 1, 'SUBSCRIPTION'],
    ]);
  });

  it('a renewal moves the same plan on by one period and gives the credits again', async () => {
    const end = new Date(NOW.getTime() + 2 * DAY);
    prismaMock.billingPayment.findUnique.mockResolvedValue(payment({ productKind: 'SUBSCRIPTION', targetId: null, subscriptionId: 'sub-1' }));
    prismaMock.product.findUnique.mockResolvedValue(product({ kind: 'SUBSCRIPTION', interval: 'MONTHLY', planTier: 'STARTER', featuredCredits: 3 }));
    prismaMock.subscription.findUnique.mockResolvedValue({ id: 'sub-1', currentPeriodEnd: end });

    await confirmPayment('JWB-REF-1', NOW);

    expect(prismaMock.subscription.create).not.toHaveBeenCalled();
    const data = prismaMock.subscription.update.mock.calls[0][0].data;
    expect(data.currentPeriodStart).toEqual(end);
    expect(data.currentPeriodEnd.toISOString()).toBe(addInterval(end, 'MONTHLY').toISOString());
    expect(data.status).toBe('ACTIVE');
    // Paying up ends any grace period.
    expect(data).toMatchObject({ graceEndsAt: null, graceRemindersSent: 0, cancelAtPeriodEnd: false });
  });

  it('when a planned move to a smaller plan takes its first payment, the company moves onto that plan', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(payment({ productId: 'starter', productKind: 'SUBSCRIPTION', targetId: null, subscriptionId: 'sub-1' }));
    prismaMock.product.findUnique.mockResolvedValue(product({ id: 'starter', kind: 'SUBSCRIPTION', interval: 'MONTHLY', planTier: 'STARTER', featuredCredits: 2 }));
    prismaMock.subscription.findUnique.mockResolvedValue({ id: 'sub-1', currentPeriodEnd: NOW });

    await confirmPayment('JWB-REF-1', NOW);

    expect(prismaMock.subscription.update.mock.calls[0][0].data).toMatchObject({ productId: 'starter', pendingProductId: null, status: 'ACTIVE' });
  });

  it('settles only once: a second call (the webhook after the page, or the other way) changes nothing', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValueOnce(payment()).mockResolvedValue(payment({ status: 'PAID', receiptNumber: 'JW-2026-000007' }));
    await confirmPayment('JWB-REF-1', NOW);
    prismaMock.job.update.mockClear();
    paystack.verify.mockClear();

    const again = await confirmPayment('JWB-REF-1', NOW);

    expect(again).toEqual({ status: 'PAID', alreadyDone: true, receiptNumber: 'JW-2026-000007' });
    expect(paystack.verify).not.toHaveBeenCalled();
    expect(prismaMock.job.update).not.toHaveBeenCalled();
  });

  it('two callers at the same moment: only the one that claims it gives the purchase', async () => {
    prismaMock.billingPayment.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.billingPayment.findUnique.mockResolvedValueOnce(payment()).mockResolvedValueOnce({ receiptNumber: 'JW-2026-000007' });

    const result = await confirmPayment('JWB-REF-1', NOW);

    expect(result).toMatchObject({ status: 'PAID', alreadyDone: true });
    expect(prismaMock.job.update).not.toHaveBeenCalled();
    expect(mail.receipt).not.toHaveBeenCalled();
  });

  it('never gives anything for the wrong amount or currency', async () => {
    paystack.verify.mockResolvedValue(paidTx(100));

    expect(await confirmPayment('JWB-REF-1', NOW)).toEqual({ status: 'FAILED' });
    expect(prismaMock.billingPayment.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'FAILED', failureReason: 'AMOUNT_MISMATCH' });

    paystack.verify.mockResolvedValue({ ...paidTx(), currency: 'USD' });
    expect(await confirmPayment('JWB-REF-1', NOW)).toEqual({ status: 'FAILED' });
    expect(prismaMock.job.update).not.toHaveBeenCalled();
    expect(prismaMock.creditAccount.upsert).not.toHaveBeenCalled();
  });

  it('a failed payment is recorded, with the bank\'s reason, and the person is emailed', async () => {
    paystack.verify.mockResolvedValue({ status: 'failed', amountPesewas: 0, currency: 'GHS', channel: null, paidAt: null, failureReason: 'Insufficient funds' });

    expect(await confirmPayment('JWB-REF-1', NOW)).toEqual({ status: 'FAILED' });

    expect(prismaMock.billingPayment.updateMany.mock.calls[0][0].data).toEqual({ status: 'FAILED', failureReason: 'Insufficient funds' });
    await vi.waitFor(() => expect(mail.failed).toHaveBeenCalledWith('hr@acme.example', { productName: 'Featured job (30 days)', reason: 'Insufficient funds' }));
  });

  it('a payment still being made stays pending; an unknown reference is unknown', async () => {
    paystack.verify.mockResolvedValue({ status: 'ongoing', amountPesewas: 0, currency: 'GHS', channel: null, paidAt: null, failureReason: null });
    expect(await confirmPayment('JWB-REF-1', NOW)).toEqual({ status: 'PENDING' });

    prismaMock.billingPayment.findUnique.mockResolvedValue(null);
    expect(await confirmPayment('nope', NOW)).toEqual({ status: 'UNKNOWN' });
  });

  it('a mail that fails does not undo the payment', async () => {
    mail.receipt.mockRejectedValue(new Error('smtp down'));

    expect((await confirmPayment('JWB-REF-1', NOW)).status).toBe('PAID');
  });

  it('the page people return to settles it, but only for the person who paid', async () => {
    const respond = () => {
      const state: { status: number; body: any } = { status: 200, body: undefined };
      const res = { status(c: number) { state.status = c; return this; }, json(v: unknown) { state.body = v; return this; } } as unknown as Response;
      return { res, state };
    };
    prismaMock.billingPayment.findUnique.mockResolvedValue(payment());

    const other = respond();
    await getPaymentStatus({ user: { id: 'someone-else' }, params: { reference: 'JWB-REF-1' } } as never, other.res);
    expect(other.state.status).toBe(404);
    expect(paystack.verify).not.toHaveBeenCalled();

    const owner = respond();
    await getPaymentStatus({ user: { id: 'emp-1' }, params: { reference: 'JWB-REF-1' } } as never, owner.res);
    expect(owner.state.body).toMatchObject({ success: true, status: 'PAID' });
  });
});

// ---------------------------------------------------------------- webhooks

describe('Paystack webhooks', () => {
  const send = async (event: object, options: { signature?: string | null; raw?: Buffer } = {}) => {
    const raw = options.raw ?? Buffer.from(JSON.stringify(event));
    const signature = options.signature === null ? undefined : options.signature ?? crypto.createHmac('sha512', SECRET).update(raw).digest('hex');
    const state: { status: number; body: any } = { status: 200, body: undefined };
    const res = { status(c: number) { state.status = c; return this; }, json(v: unknown) { state.body = v; return this; } } as unknown as Response;
    await handlePaystackBillingWebhook({ rawBody: raw, body: event, header: () => signature } as unknown as Request & { rawBody?: Buffer }, res);
    return state;
  };
  const charge = { event: 'charge.success', data: { id: 99, reference: 'JWB-REF-1', status: 'success' } };

  it('refuses anything without a valid signature, before reading it', async () => {
    expect((await send(charge, { signature: null })).status).toBe(401);
    expect((await send(charge, { signature: 'a'.repeat(128) })).status).toBe(401);
    expect(prismaMock.paystackEvent.create).not.toHaveBeenCalled();
    expect(paystack.verify).not.toHaveBeenCalled();
  });

  it('a signed charge.success settles the payment (after asking Paystack again)', async () => {
    const result = await send(charge);

    expect(result.status).toBe(200);
    expect(paystack.verify).toHaveBeenCalledWith('JWB-REF-1');
    expect(prismaMock.billingPayment.updateMany.mock.calls[0][0].data.status).toBe('PAID');
    expect(prismaMock.paystackEvent.update.mock.calls[0][0].data.outcome).toBe('PAID');
  });

  it('a repeated event is recognised and does nothing', async () => {
    prismaMock.paystackEvent.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));

    const result = await send(charge);

    expect(result.body).toMatchObject({ success: true, duplicate: true });
    expect(paystack.verify).not.toHaveBeenCalled();
  });

  it('when handling fails the event is forgotten and Paystack is told to try again', async () => {
    paystack.verify.mockRejectedValue(new Error('paystack down'));

    const result = await send(charge);

    expect(result.status).toBe(500);
    expect(prismaMock.paystackEvent.deleteMany).toHaveBeenCalled();
  });

  it('a charge for a payment that is not ours is left alone', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(null);

    const result = await send({ event: 'charge.success', data: { id: 5, reference: 'someone-elses' } });

    expect(result.status).toBe(200);
    expect(prismaMock.paystackEvent.update.mock.calls[0][0].data.outcome).toBe('not_ours');
    expect(prismaMock.billingPayment.updateMany).not.toHaveBeenCalled();
  });

  describe('subscriptions', () => {
    const sub = { id: 'sub-1', userId: 'emp-1', productId: 'prod-1', product: product({ kind: 'SUBSCRIPTION', interval: 'MONTHLY', name: 'Employer plan (monthly)', paystackPlanCode: 'PLN_1' }), user: { id: 'emp-1', email: 'hr@acme.example' } };

    it('an automatic renewal creates its own payment, settles it, and moves the plan on', async () => {
      prismaMock.billingPayment.findUnique.mockResolvedValueOnce(null).mockResolvedValue(payment({ productKind: 'SUBSCRIPTION', subscriptionId: 'sub-1', reference: 'RENEW-1', totalPesewas: 15000 }));
      prismaMock.product.findFirst.mockResolvedValue(sub.product);
      prismaMock.subscription.findFirst.mockResolvedValue(sub);
      prismaMock.subscription.findUnique.mockResolvedValue({ id: 'sub-1', currentPeriodEnd: NOW });
      prismaMock.product.findUnique.mockResolvedValue(sub.product);
      paystack.verify.mockResolvedValue(paidTx(15000));

      const result = await send({ event: 'charge.success', data: { id: 7, reference: 'RENEW-1', amount: 15000, plan: { plan_code: 'PLN_1' }, customer: { customer_code: 'CUS_1', email: 'hr@acme.example' } } });

      expect(result.status).toBe(200);
      const created = prismaMock.billingPayment.create.mock.calls[0][0].data;
      expect(created).toMatchObject({ userId: 'emp-1', reference: 'RENEW-1', totalPesewas: 15000, vatPesewas: 1957, subtotalPesewas: 13043, subscriptionId: 'sub-1', productKind: 'SUBSCRIPTION' });
      expect(prismaMock.subscription.update).toHaveBeenCalled();
    });

    it('links Paystack\'s subscription codes to the plan once the first payment has settled', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 'prod-1' });
      prismaMock.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });

      await send({ event: 'subscription.create', data: { subscription_code: 'SUB_1', email_token: 'tok', plan: { plan_code: 'PLN_1' }, customer: { customer_code: 'CUS_1', email: 'hr@acme.example' } } });

      expect(prismaMock.subscription.update.mock.calls[0][0].data).toEqual({ paystackSubscriptionCode: 'SUB_1', paystackCustomerCode: 'CUS_1', paystackEmailToken: 'tok' });
    });

    it('if that comes before the first payment settles, Paystack is asked to send it again', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 'prod-1' });
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      const result = await send({ event: 'subscription.create', data: { subscription_code: 'SUB_1', plan: { plan_code: 'PLN_1' }, customer: { email: 'hr@acme.example' } } });

      expect(result.status).toBe(500);
      expect(prismaMock.paystackEvent.deleteMany).toHaveBeenCalled();
    });

    it('a failed renewal marks the plan past due and tells the owner', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue({ ...sub, graceEndsAt: null, user: { email: 'hr@acme.example' }, product: { name: 'Employer plan (monthly)' } });

      await send({ event: 'invoice.payment_failed', data: { subscription: { subscription_code: 'SUB_1' }, description: 'Card declined' } });

      const data = prismaMock.subscription.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ status: 'PAST_DUE', graceRemindersSent: 0 });
      // Seven days to put it right, counted from the first failure.
      expect(Math.round((data.graceEndsAt.getTime() - Date.now()) / DAY)).toBe(7);
      await vi.waitFor(() => expect(mail.failed).toHaveBeenCalledWith('hr@acme.example', expect.objectContaining({ productName: 'Employer plan (monthly) (renewal)', reason: 'Card declined', graceEndsOn: expect.any(String) })));
    });

    it('a cancelled plan runs to the end of the period it paid for', async () => {
      prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });

      await send({ event: 'subscription.disable', data: { subscription_code: 'SUB_1' } });

      expect(prismaMock.subscription.updateMany.mock.calls[0][0].data).toMatchObject({ cancelAtPeriodEnd: true });
      expect(prismaMock.subscription.updateMany.mock.calls[0][0].data).not.toHaveProperty('status');
    });

    it('records a refund Paystack finished', async () => {
      prismaMock.billingPayment.findUnique.mockResolvedValue({ id: 'pay-1' });
      prismaMock.billingRefund.updateMany.mockResolvedValue({ count: 1 });

      await send({ event: 'refund.processed', data: { id: 3, transaction_reference: 'JWB-REF-1' } });

      expect(prismaMock.billingRefund.updateMany.mock.calls[0][0].data).toEqual({ status: 'PROCESSED' });
    });

    it('unknown event types are acknowledged and ignored', async () => {
      const result = await send({ event: 'customeridentification.success', data: { id: 1 } });

      expect(result.status).toBe(200);
      expect(prismaMock.paystackEvent.update.mock.calls[0][0].data.outcome).toBe('ignored');
    });
  });
});

describe('managing a plan', () => {
  it('cancelling stops the next charge at Paystack first, and the plan keeps running to the period end', async () => {
    const end = new Date(NOW.getTime() + 9 * DAY);
    prismaMock.subscription.findFirst.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE', paystackSubscriptionCode: 'SUB_1', paystackEmailToken: 'tok', currentPeriodEnd: end });

    const result = await cancelSubscription('emp-1', 'sub-1');

    expect(paystack.disableSubscription).toHaveBeenCalledWith({ code: 'SUB_1', token: 'tok' });
    expect(prismaMock.subscription.update.mock.calls[0][0].data).toMatchObject({ cancelAtPeriodEnd: true });
    expect(result.endsOn).toEqual(end);
  });

  it('if Paystack cannot cancel it, we say so instead of pretending', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE', paystackSubscriptionCode: 'SUB_1', paystackEmailToken: 'tok', currentPeriodEnd: NOW });
    paystack.disableSubscription.mockRejectedValue(new Error('down'));

    await expect(cancelSubscription('emp-1', 'sub-1')).rejects.toMatchObject({ code: 'PAYSTACK_UNAVAILABLE' });
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });

  it('only your own active plan can be cancelled', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(null);

    await expect(cancelSubscription('emp-1', 'sub-9')).rejects.toBeInstanceOf(BillingError);
    expect(prismaMock.subscription.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'sub-9', userId: 'emp-1' });
  });

  describe('the daily sweep', () => {
    const due = (overrides: Record<string, unknown> = {}) => ({ id: 'sub-1', reminderSentForPeriodEnd: null, currentPeriodEnd: new Date(NOW.getTime() + 2 * DAY), user: { email: 'hr@acme.example' }, product: { name: 'Employer plan (monthly)', pricePesewas: 15000, paystackPlanAmount: 15000 }, ...overrides });

    /** The sweep asks the subscriptions table several different questions; answer each one separately. */
    const sweepData = (lists: { due?: unknown[]; owed?: unknown[]; late?: unknown[]; ending?: unknown[]; graceOver?: unknown[] }) =>
      prismaMock.subscription.findMany.mockImplementation(async (args: any) => {
        const where = args?.where ?? {};
        if (where.cancelAtPeriodEnd === false && where.currentPeriodEnd?.gt) return lists.due ?? [];
        if (where.nextCreditGrantAt) return lists.owed ?? [];
        if (where.status === 'PAST_DUE' && where.graceEndsAt?.gt) return lists.late ?? [];
        if (where.status === 'PAST_DUE' && where.graceEndsAt?.lt) return lists.graceOver ?? [];
        if (where.currentPeriodEnd?.lt) return lists.ending ?? [];
        return [];
      });

    beforeEach(() => sweepData({}));

    it('reminds people three days before renewal, once per period', async () => {
      sweepData({ due: [due()] });

      const first = await runBillingSweep(NOW);

      expect(first.reminded).toBe(1);
      expect(mail.reminder).toHaveBeenCalledWith('hr@acme.example', { planName: 'Employer plan (monthly)', renewsOn: '12 November 2026', amount: 'GHS 150.00' });

      mail.reminder.mockClear();
      sweepData({ due: [due({ reminderSentForPeriodEnd: new Date(NOW.getTime() + 2 * DAY) })] });
      expect((await runBillingSweep(NOW)).reminded).toBe(0);
      expect(mail.reminder).not.toHaveBeenCalled();
    });

    it('a yearly plan gets each month of credits inside its year, replacing what was left; a monthly plan waits for its renewal', async () => {
      const yearly = { id: 'sub-y', userId: 'emp-1', status: 'ACTIVE', currentPeriodEnd: new Date(NOW.getTime() + 200 * DAY), graceEndsAt: null, cancelAtPeriodEnd: false, nextCreditGrantAt: new Date(NOW.getTime() - DAY), product: { featuredCredits: 2, boostCredits: 1 } };
      const monthly = { ...yearly, id: 'sub-m', userId: 'emp-2', currentPeriodEnd: new Date(NOW.getTime() - 1000), nextCreditGrantAt: new Date(NOW.getTime() - 1000) };
      sweepData({ owed: [yearly, monthly] });
      prismaMock.creditAccount.findUnique.mockResolvedValue({ planFeaturedCredits: 1, planBoostCredits: 0 });

      const result = await runBillingSweep(NOW);

      expect(result.granted).toBe(1);
      expect(prismaMock.creditAccount.upsert.mock.calls[0][0]).toMatchObject({ where: { userId: 'emp-1' }, update: { planFeaturedCredits: 2, planBoostCredits: 1 } });
      expect(prismaMock.subscription.update.mock.calls[0][0].where.id).toBe('sub-y');
      expect(prismaMock.subscription.update.mock.calls[0][0].data.nextCreditGrantAt.getTime()).toBeGreaterThan(NOW.getTime());
      expect(prismaMock.creditAccount.upsert).toHaveBeenCalledTimes(1);
    });

    it('while a failed payment is in its 7 days of grace: a reminder after 2 days, a last one after 5, and no repeats', async () => {
      const grace = (daysAgo: number, sent: number) => ({ id: 'sub-1', userId: 'emp-1', status: 'PAST_DUE', graceEndsAt: new Date(NOW.getTime() + (7 - daysAgo) * DAY), graceRemindersSent: sent, user: { email: 'hr@acme.example' }, product: { name: 'Employer plan (monthly)' } });

      sweepData({ late: [grace(1, 0)] });
      expect((await runBillingSweep(NOW)).graceReminders).toBe(0);

      sweepData({ late: [grace(2, 0)] });
      expect((await runBillingSweep(NOW)).graceReminders).toBe(1);
      expect(mail.grace).toHaveBeenCalledWith('hr@acme.example', expect.objectContaining({ planName: 'Employer plan (monthly)', lastChance: false }));
      expect(prismaMock.subscription.update).toHaveBeenLastCalledWith({ where: { id: 'sub-1' }, data: { graceRemindersSent: 1 } });

      sweepData({ late: [grace(3, 1)] });
      expect((await runBillingSweep(NOW)).graceReminders).toBe(0);

      sweepData({ late: [grace(5, 1)] });
      expect((await runBillingSweep(NOW)).graceReminders).toBe(1);
      expect(mail.grace).toHaveBeenLastCalledWith('hr@acme.example', expect.objectContaining({ lastChance: true }));

      sweepData({ late: [grace(6, 2)] });
      expect((await runBillingSweep(NOW)).graceReminders).toBe(0);
    });

    it('a plan that ran out, or whose grace is over, becomes Free: the plan ends, its monthly credits go, the team is paused, and nothing is deleted', async () => {
      const over = { id: 'sub-1', userId: 'emp-1', status: 'PAST_DUE', currentPeriodEnd: new Date(NOW.getTime() - 20 * DAY), graceEndsAt: new Date(NOW.getTime() - DAY), cancelAtPeriodEnd: false };
      const cancelled = { id: 'sub-2', userId: 'emp-2', status: 'ACTIVE', currentPeriodEnd: new Date(NOW.getTime() - DAY), graceEndsAt: null, cancelAtPeriodEnd: true };
      sweepData({ ending: [over, cancelled], graceOver: [over] });
      prismaMock.creditAccount.findUnique.mockResolvedValue({ planFeaturedCredits: 2, planBoostCredits: 0, featuredCredits: 4, boostCredits: 1 });
      prismaMock.creditAccount.update.mockResolvedValue({});

      const result = await runBillingSweep(NOW);

      expect(result.expired).toBe(2);
      const ended = prismaMock.subscription.update.mock.calls.map((call: any[]) => [call[0].where.id, call[0].data.status]);
      expect(ended).toEqual([['sub-1', 'EXPIRED'], ['sub-2', 'EXPIRED']]);
      // Monthly plan credits go; credits that were bought stay.
      expect(prismaMock.creditAccount.update).toHaveBeenCalledWith({ where: { userId: 'emp-1' }, data: { planFeaturedCredits: 0, planBoostCredits: 0 } });
      expect(prismaMock.creditLedger.create.mock.calls[0][0].data).toMatchObject({ creditType: 'FEATURE', delta: -2, reason: 'EXPIRY' });
      // The team is looked at, so members above the Free limit are paused.
      expect(prismaMock.teamMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerId: 'emp-1' }) }));
    });

    it('a plan still inside its period or its grace is left alone', async () => {
      const fine = { id: 'sub-1', userId: 'emp-1', status: 'PAST_DUE', currentPeriodEnd: new Date(NOW.getTime() - 3 * DAY), graceEndsAt: new Date(NOW.getTime() + 2 * DAY), cancelAtPeriodEnd: false };
      sweepData({ ending: [fine] });

      const result = await runBillingSweep(NOW);

      expect(result.expired).toBe(0);
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    });
  });
});

// ------------------------------------------------------------------ credits

describe('credits', () => {
  const job = { id: 'job-1', featuredUntil: null, boostedUntil: null };

  beforeEach(() => {
    prismaMock.job.findFirst.mockResolvedValue(job);
    prismaMock.product.findFirst.mockResolvedValue({ durationDays: 14 });
    prismaMock.creditAccount.updateMany.mockResolvedValue({ count: 1 });
  });

  it('spending a credit features one of your open jobs for the product\'s days, and records it', async () => {
    const result = await spendCredit({ userId: 'emp-1', type: 'FEATURE', jobId: 'job-1' }, NOW);

    // The monthly plan credits (which expire) are spent first.
    expect(prismaMock.creditAccount.updateMany.mock.calls[0][0]).toEqual({ where: { userId: 'emp-1', planFeaturedCredits: { gte: 1 } }, data: { planFeaturedCredits: { decrement: 1 } } });
    expect(result.until.getTime()).toBe(NOW.getTime() + 14 * DAY);
    expect(prismaMock.creditLedger.create.mock.calls[0][0].data).toMatchObject({ userId: 'emp-1', creditType: 'FEATURE', delta: -1, reason: 'SPEND', jobId: 'job-1' });
    expect(prismaMock.job.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'job-1', employerId: 'emp-1', status: 'ACTIVE' });
  });

  it('with none left it refuses, and changes nothing about the job', async () => {
    prismaMock.creditAccount.updateMany.mockResolvedValue({ count: 0 });

    await expect(spendCredit({ userId: 'emp-1', type: 'FEATURE', jobId: 'job-1' }, NOW)).rejects.toMatchObject({ status: 402, code: 'NO_CREDITS' });
    expect(prismaMock.job.update).not.toHaveBeenCalled();
    expect(prismaMock.creditLedger.create).not.toHaveBeenCalled();
  });

  it('a boost credit marks the job "Urgently hiring" and tells matching alerts', async () => {
    await spendCredit({ userId: 'emp-1', type: 'BOOST', jobId: 'job-1' }, NOW);

    expect(prismaMock.creditAccount.updateMany.mock.calls[0][0].where).toEqual({ userId: 'emp-1', planBoostCredits: { gte: 1 } });
    expect(prismaMock.job.update.mock.calls[0][0].data.boostedUntil.getTime()).toBe(NOW.getTime() + 14 * DAY);
    expect(alertsMock.notifyJobAlerts).toHaveBeenCalled();
  });

  it('only your own open job can be promoted', async () => {
    prismaMock.job.findFirst.mockResolvedValue(null);

    await expect(spendCredit({ userId: 'emp-1', type: 'FEATURE', jobId: 'other' }, NOW)).rejects.toMatchObject({ code: 'JOB_NOT_FOUND' });
    expect(prismaMock.creditAccount.updateMany).not.toHaveBeenCalled();
  });

  describe('admin adjustments', () => {
    const admin = { id: 'admin-1', email: 'admin@jobwahala.com' };

    beforeEach(() => prismaMock.user.findUnique.mockResolvedValue({ id: 'emp-1' }));

    it('adds credits, with the reason, in the ledger and the admin action log', async () => {
      await adjustCredits({ admin, userId: 'emp-1', type: 'FEATURE', delta: 3, reason: 'Goodwill after an outage' });

      expect(prismaMock.creditLedger.create.mock.calls[0][0].data).toMatchObject({ creditType: 'FEATURE', delta: 3, reason: 'ADMIN_ADJUSTMENT', adminId: 'admin-1', note: 'Goodwill after an outage' });
      expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ adminId: 'admin-1', action: 'CREDITS_ADJUSTED', targetType: 'User', targetId: 'emp-1', reason: 'Goodwill after an outage' });
    });

    it('cannot take away more than they have', async () => {
      prismaMock.creditAccount.findUnique.mockResolvedValue({ featuredCredits: 1, boostCredits: 0 });

      await expect(adjustCredits({ admin, userId: 'emp-1', type: 'FEATURE', delta: -2, reason: 'Correction' })).rejects.toMatchObject({ code: 'NOT_ENOUGH_CREDITS' });
      expect(prismaMock.adminActionLog.create).not.toHaveBeenCalled();
    });
  });
});

// ------------------------------------------------------------------ refunds

describe('refunds', () => {
  const admin = { id: 'admin-1', email: 'admin@jobwahala.com' };
  const paid = (overrides: Record<string, unknown> = {}) => payment({ status: 'PAID', receiptNumber: 'JW-2026-000007', ...overrides });

  beforeEach(() => prismaMock.billingPayment.findUnique.mockResolvedValue(paid()));

  it('a full refund goes through Paystack, is recorded, undoes the promotion, and is logged', async () => {
    const result = await refundPayment({ admin, paymentId: 'pay-1', reason: 'Posted by mistake', reverseBenefits: true });

    expect(paystack.refund).toHaveBeenCalledWith({ reference: 'JWB-REF-1', amountPesewas: 5000 });
    expect(result).toEqual({ refundedPesewas: 5000, status: 'REFUNDED' });
    expect(prismaMock.billingPayment.update.mock.calls[0][0].data).toEqual({ refundedPesewas: { increment: 5000 }, status: 'REFUNDED' });
    expect(prismaMock.billingRefund.create.mock.calls[0][0].data).toMatchObject({ paymentId: 'pay-1', amountPesewas: 5000, reason: 'Posted by mistake', adminId: 'admin-1', reversedBenefits: true, status: 'PROCESSED' });
    expect(prismaMock.job.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { featuredUntil: null } });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'PAYMENT_REFUNDED', targetType: 'BillingPayment', targetId: 'pay-1', reason: 'Posted by mistake' });
  });

  it('a partial refund leaves the payment partly refunded', async () => {
    const result = await refundPayment({ admin, paymentId: 'pay-1', amountPesewas: 2000, reason: 'Part of it', reverseBenefits: false });

    expect(result.status).toBe('PARTIALLY_REFUNDED');
    expect(paystack.refund).toHaveBeenCalledWith({ reference: 'JWB-REF-1', amountPesewas: 2000 });
    expect(prismaMock.job.update).not.toHaveBeenCalled();
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('PAYMENT_PARTIALLY_REFUNDED');
  });

  it('cannot refund more than is left, or something unpaid or already fully refunded', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(paid({ refundedPesewas: 4000 }));
    await expect(refundPayment({ admin, paymentId: 'pay-1', amountPesewas: 2000, reason: 'Too much', reverseBenefits: false })).rejects.toMatchObject({ code: 'BAD_AMOUNT' });

    prismaMock.billingPayment.findUnique.mockResolvedValue(payment());
    await expect(refundPayment({ admin, paymentId: 'pay-1', reason: 'Unpaid one', reverseBenefits: false })).rejects.toMatchObject({ code: 'NOT_REFUNDABLE' });

    prismaMock.billingPayment.findUnique.mockResolvedValue(paid({ status: 'REFUNDED', refundedPesewas: 5000 }));
    await expect(refundPayment({ admin, paymentId: 'pay-1', reason: 'Again', reverseBenefits: false })).rejects.toMatchObject({ code: 'NOT_REFUNDABLE' });
    expect(paystack.refund).not.toHaveBeenCalled();
  });

  it('if Paystack refuses, nothing is recorded or logged', async () => {
    paystack.refund.mockRejectedValue(new Error('declined'));

    await expect(refundPayment({ admin, paymentId: 'pay-1', reason: 'Posted by mistake', reverseBenefits: true })).rejects.toMatchObject({ code: 'PAYSTACK_REFUND_FAILED' });
    expect(prismaMock.billingRefund.create).not.toHaveBeenCalled();
    expect(prismaMock.adminActionLog.create).not.toHaveBeenCalled();
  });

  it('refunding a pack takes back only the credits not yet spent', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(paid({ productKind: 'JOB_PACK', targetId: null }));
    prismaMock.creditLedger.findMany.mockResolvedValue([{ creditType: 'FEATURE', delta: 5 }]);
    prismaMock.creditAccount.findUnique.mockResolvedValue({ featuredCredits: 2, boostCredits: 0 });

    await refundPayment({ admin, paymentId: 'pay-1', reason: 'Refund the pack', reverseBenefits: true });

    expect(prismaMock.creditAccount.upsert.mock.calls[0][0].update).toEqual({ featuredCredits: { increment: -2 }, boostCredits: { increment: 0 } });
    expect(prismaMock.creditLedger.create.mock.calls[0][0].data).toMatchObject({ creditType: 'FEATURE', delta: -2, reason: 'REFUND' });
  });

  it('refunding a plan ends it', async () => {
    prismaMock.billingPayment.findUnique.mockResolvedValue(paid({ productKind: 'SUBSCRIPTION', targetId: null, subscriptionId: 'sub-1' }));
    prismaMock.creditLedger.findMany.mockResolvedValue([]);

    await refundPayment({ admin, paymentId: 'pay-1', reason: 'Refund the plan', reverseBenefits: true });

    expect(prismaMock.subscription.update.mock.calls[0][0].data).toMatchObject({ status: 'CANCELLED', cancelAtPeriodEnd: true });
  });
});

// ------------------------------------------------------------------ reports

describe('revenue', () => {
  it('adds up money in by product and by month, with refunds taken off', async () => {
    prismaMock.billingPayment.findMany.mockResolvedValue([
      { productKind: 'FEATURED_JOB', totalPesewas: 5000, vatPesewas: 652, refundedPesewas: 0, paidAt: new Date('2026-11-02T10:00:00Z') },
      { productKind: 'FEATURED_JOB', totalPesewas: 5000, vatPesewas: 652, refundedPesewas: 5000, paidAt: new Date('2026-10-20T10:00:00Z') },
      { productKind: 'JOB_PACK', totalPesewas: 20000, vatPesewas: 2609, refundedPesewas: 0, paidAt: new Date('2026-11-05T10:00:00Z') },
    ]);

    const report = await revenueReport(3, NOW);

    expect(report.byMonth.map((month) => month.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(report.byMonth[2]).toMatchObject({ count: 2, grossPesewas: 25000 });
    expect(report.byMonth[1]).toMatchObject({ count: 1, grossPesewas: 5000, refundedPesewas: 5000 });
    expect(report.byProduct[0]).toMatchObject({ kind: 'JOB_PACK', grossPesewas: 20000 });
    expect(report.byProduct[1]).toMatchObject({ kind: 'FEATURED_JOB', count: 2, grossPesewas: 10000, vatPesewas: 1304, refundedPesewas: 5000 });
    expect(report.totals).toEqual({ count: 3, grossPesewas: 30000, vatPesewas: 3913, refundedPesewas: 5000, netPesewas: 25000 });
    expect(prismaMock.billingPayment.findMany.mock.calls[0][0].where.status).toEqual({ in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] });
  });
});

describe('receipts', () => {
  const paidPayment = payment({ status: 'PAID', receiptNumber: 'JW-2026-000007', paidAt: NOW, channel: 'mobile_money', refundedPesewas: 1000 });

  it('shows the company details, the VAT and its rate, the total, the number and what was paid by', () => {
    const html = renderReceiptHtml(paidPayment as never, settings);

    expect(html).toContain('JobWahala Ltd');
    expect(html).toContain('TIN: C0012345678');
    expect(html).toContain('JW-2026-000007');
    expect(html).toContain('VAT (15%)');
    expect(html).toContain('GHS 6.52');
    expect(html).toContain('GHS 43.48');
    expect(html).toContain('GHS 50.00');
    expect(html).toContain('Mobile money');
    expect(html).toContain('Acme Ltd');
    expect(html).toContain('-GHS 10.00');
    expect(html).toContain('10 November 2026');
  });

  it('uses the admin\'s VAT rate and escapes anything typed', () => {
    const html = renderReceiptHtml({ ...paidPayment, vatRateBps: 1250, billToName: '<script>x</script>' } as never, settings);

    expect(html).toContain('VAT (12.5%)');
    expect(html).not.toContain('<script>x</script>');
  });

  it('is downloaded as a file by its owner only, and only once it has a number', async () => {
    const run = async (userId: string) => {
      const state: { status: number; body: unknown; headers: Record<string, string> } = { status: 200, body: undefined, headers: {} };
      const res = {
        status(c: number) { state.status = c; return this; },
        json(v: unknown) { state.body = v; return this; },
        type() { return this; },
        set(name: string, value: string) { state.headers[name] = value; return this; },
        send(v: unknown) { state.body = v; return this; },
      } as unknown as Response;
      await downloadReceipt({ user: { id: userId }, params: { id: 'pay-1' } } as never, res);
      return state;
    };
    prismaMock.billingPayment.findUnique.mockResolvedValue(paidPayment);

    const mine = await run('emp-1');
    expect(mine.headers['Content-Disposition']).toBe('attachment; filename="receipt-JW-2026-000007.html"');
    expect(String(mine.body)).toContain('VAT (15%)');

    expect((await run('someone-else')).status).toBe(404);

    prismaMock.billingPayment.findUnique.mockResolvedValue(payment());
    expect((await run('emp-1')).status).toBe(404);
  });
});
