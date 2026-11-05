import crypto from 'crypto';
import env from '../config/env';
import logger from '../config/logger';
import prisma from '../config/prisma';
import { getErrorMessage } from '../utils/errors';
import { publicJobWhere } from '../utils/jobLifecycle';
import { createNotification } from '../utils/notifications';
import { recordAdminAction } from '../utils/adminAudit';
import { publicCourseWhere } from '../utils/courses';
import {
  DAY_MS,
  DEFAULT_BOOST_DAYS,
  DEFAULT_FEATURED_DAYS,
  DEFAULT_PRODUCTS,
  addInterval,
  extendPromotion,
  formatGhs,
  includesList,
  newReference,
  priceWithVat,
  receiptNumber,
  type ProductKind,
} from '../utils/billing';
import { paystackMode, realPaystack, type PaystackClient } from './paystackBilling';
import { notifyJobAlerts } from './jobAlertService';
import { sendPaymentFailedEmail, sendPaymentReceiptEmail, sendRenewalReminderEmail } from './emailService';

/** Something the person can be told: a status, a code the page can act on, and a plain message. */
export class BillingError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type Mailer = {
  receipt: typeof sendPaymentReceiptEmail;
  failed: typeof sendPaymentFailedEmail;
  reminder: typeof sendRenewalReminderEmail;
};

let paystack: PaystackClient = realPaystack;
let mail: Mailer = { receipt: sendPaymentReceiptEmail, failed: sendPaymentFailedEmail, reminder: sendRenewalReminderEmail };

/** For tests: stand in for Paystack and for email. */
export const setBillingDepsForTests = (deps?: { paystack?: PaystackClient; mail?: Partial<Mailer> }) => {
  paystack = deps?.paystack ?? realPaystack;
  mail = { receipt: sendPaymentReceiptEmail, failed: sendPaymentFailedEmail, reminder: sendRenewalReminderEmail, ...(deps?.mail ?? {}) };
};

/** A mail that fails must never undo or hold up a payment. */
const sendQuietly = (label: string, work: () => Promise<unknown>) => {
  void Promise.resolve()
    .then(work)
    .catch((error) => logger.error(label, { error: getErrorMessage(error) }));
};

// ------------------------------------------------------------------ settings & catalogue

export const getSettings = async () => {
  const existing = await prisma.billingSettings.findUnique({ where: { id: 'default' } });
  return existing ?? (await prisma.billingSettings.create({ data: { id: 'default' } }));
};

/** The first time anyone looks, the catalogue starts with sensible products for the admin to edit. */
export const ensureDefaultProducts = async () => {
  if ((await prisma.product.count()) > 0) return;
  for (const product of DEFAULT_PRODUCTS) {
    const { includes, ...rest } = product;
    await prisma.product.create({ data: { ...rest, includesJson: JSON.stringify(includes) } });
  }
};

type ProductRow = {
  id: string;
  kind: string;
  slug: string;
  name: string;
  description: string;
  audience: string;
  pricePesewas: number;
  durationDays: number | null;
  featuredCredits: number;
  boostCredits: number;
  interval: string | null;
  includesJson: string;
  active?: boolean;
  sortOrder?: number;
};

export const serializeProduct = (product: ProductRow, settings: { vatRatePercent: number; pricesIncludeVat: boolean }) => {
  const money = priceWithVat(product.pricePesewas, settings);
  return {
    id: product.id,
    kind: product.kind,
    slug: product.slug,
    name: product.name,
    description: product.description,
    audience: product.audience,
    durationDays: product.durationDays,
    featuredCredits: product.featuredCredits,
    boostCredits: product.boostCredits,
    interval: product.interval,
    includes: includesList(product),
    active: product.active ?? true,
    sortOrder: product.sortOrder ?? 0,
    priceGhs: product.pricePesewas / 100,
    totalPesewas: money.totalPesewas,
    totalLabel: formatGhs(money.totalPesewas),
    vatPesewas: money.vatPesewas,
    pricesIncludeVat: settings.pricesIncludeVat,
    vatRatePercent: settings.vatRatePercent,
  };
};

/** What this person can buy: active products for their kind of account. */
export const listCatalogue = async (user: { id: string }) => {
  await ensureDefaultProducts();
  const [settings, profile, products] = await Promise.all([
    getSettings(),
    prisma.employerProfile.findUnique({ where: { userId: user.id }, select: { isTrainingProvider: true } }),
    prisma.product.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
  ]);
  const visible = products.filter((product) => product.audience === 'EMPLOYER' || Boolean(profile?.isTrainingProvider));
  return visible.map((product) => serializeProduct(product, settings));
};

const productDays = async (kind: 'FEATURED_JOB' | 'JOB_BOOST') => {
  const product = await prisma.product.findFirst({ where: { kind, active: true }, orderBy: { sortOrder: 'asc' }, select: { durationDays: true } });
  return product?.durationDays ?? (kind === 'FEATURED_JOB' ? DEFAULT_FEATURED_DAYS : DEFAULT_BOOST_DAYS);
};

// ---------------------------------------------------------------------- checkout

const ensurePlan = async (product: { id: string; name: string; interval: string | null; paystackPlanCode: string | null; paystackPlanAmount: number | null }, totalPesewas: number) => {
  if (product.paystackPlanCode && product.paystackPlanAmount === totalPesewas) return product.paystackPlanCode;
  // A new price needs a new plan: existing subscribers stay on the price they signed up for.
  const { planCode } = await paystack.createPlan({ name: product.name, amountPesewas: totalPesewas, interval: product.interval === 'YEARLY' ? 'annually' : 'monthly' });
  await prisma.product.update({ where: { id: product.id }, data: { paystackPlanCode: planCode, paystackPlanAmount: totalPesewas } });
  return planCode;
};

/** Starts a purchase: the price is worked out here, never taken from the browser. */
export const createCheckout = async (input: { userId: string; email: string; name?: string | null; productId: string; targetId?: string }) => {
  if (paystackMode() === 'off') throw new BillingError(503, 'PAYMENTS_NOT_SET_UP', 'Payments are not available right now. Please try again later.');

  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product || !product.active) throw new BillingError(404, 'PRODUCT_NOT_FOUND', 'That product is not available.');

  if (product.audience === 'PROVIDER') {
    const profile = await prisma.employerProfile.findUnique({ where: { userId: input.userId }, select: { isTrainingProvider: true } });
    if (!profile?.isTrainingProvider) throw new BillingError(403, 'PROVIDER_ONLY', 'This is for training providers.');
  }

  let targetType: 'JOB' | 'COURSE' | null = null;
  if (product.kind === 'FEATURED_JOB' || product.kind === 'JOB_BOOST') {
    targetType = 'JOB';
    const job = input.targetId ? await prisma.job.findFirst({ where: { id: input.targetId, employerId: input.userId, ...publicJobWhere() }, select: { id: true } }) : null;
    if (!job) throw new BillingError(400, 'JOB_REQUIRED', 'Choose one of your open jobs.');
  } else if (product.kind === 'FEATURED_COURSE') {
    targetType = 'COURSE';
    const course = input.targetId ? await prisma.course.findFirst({ where: { id: input.targetId, providerId: input.userId, ...publicCourseWhere() }, select: { id: true } }) : null;
    if (!course) throw new BillingError(400, 'COURSE_REQUIRED', 'Choose one of your live courses.');
  } else if (product.kind === 'SUBSCRIPTION') {
    const current = await prisma.subscription.findFirst({ where: { userId: input.userId, productId: product.id, status: { in: ['ACTIVE', 'PAST_DUE'] } }, select: { id: true } });
    if (current) throw new BillingError(409, 'ALREADY_SUBSCRIBED', 'You already have this plan.');
  }

  const settings = await getSettings();
  const money = priceWithVat(product.pricePesewas, settings);
  const reference = newReference(crypto.randomBytes(4).toString('hex').toUpperCase());

  const payment = await prisma.billingPayment.create({
    data: {
      userId: input.userId,
      productId: product.id,
      productKind: product.kind,
      productName: product.name,
      targetType,
      targetId: targetType ? input.targetId : null,
      reference,
      ...money,
      billToName: input.name ?? null,
      billToEmail: input.email,
    },
  });

  try {
    const plan = product.kind === 'SUBSCRIPTION' ? await ensurePlan(product, money.totalPesewas) : undefined;
    const { authorizationUrl } = await paystack.initialize({
      email: input.email,
      amountPesewas: money.totalPesewas,
      reference,
      callbackUrl: `${env.frontendBaseUrl}/billing?reference=${encodeURIComponent(reference)}`,
      plan,
      metadata: { paymentId: payment.id, product: product.slug },
    });
    return { reference, authorizationUrl, mode: paystackMode() };
  } catch (error) {
    await prisma.billingPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: 'Could not start the payment' } });
    logger.error('billing_checkout_failed', { error: getErrorMessage(error) });
    throw new BillingError(502, 'PAYSTACK_UNAVAILABLE', 'We could not reach the payment provider. Nothing was charged. Please try again.');
  }
};

// ---------------------------------------------------------------------- credits

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const grantCredits = async (tx: Tx, input: { userId: string; featured?: number; boost?: number; reason: string; paymentId?: string; adminId?: string; note?: string }) => {
  const featured = input.featured ?? 0;
  const boost = input.boost ?? 0;
  if (featured === 0 && boost === 0) return;

  await tx.creditAccount.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, featuredCredits: Math.max(0, featured), boostCredits: Math.max(0, boost) },
    update: { featuredCredits: { increment: featured }, boostCredits: { increment: boost } },
  });
  const common = { userId: input.userId, reason: input.reason, paymentId: input.paymentId ?? null, adminId: input.adminId ?? null, note: input.note ?? null };
  if (featured !== 0) await tx.creditLedger.create({ data: { ...common, creditType: 'FEATURE', delta: featured } });
  if (boost !== 0) await tx.creditLedger.create({ data: { ...common, creditType: 'BOOST', delta: boost } });
};

export const getCreditBalance = async (userId: string) => {
  const account = await prisma.creditAccount.findUnique({ where: { userId } });
  return { featuredCredits: account?.featuredCredits ?? 0, boostCredits: account?.boostCredits ?? 0 };
};

/** Spend one credit to feature or boost one of the employer's open jobs. One conditional update: no double spending. */
export const spendCredit = async (input: { userId: string; type: 'FEATURE' | 'BOOST'; jobId: string }, now = new Date()) => {
  const job = await prisma.job.findFirst({ where: { id: input.jobId, employerId: input.userId, ...publicJobWhere() }, select: { id: true, featuredUntil: true, boostedUntil: true } });
  if (!job) throw new BillingError(404, 'JOB_NOT_FOUND', 'Choose one of your open jobs.');

  const days = await productDays(input.type === 'FEATURE' ? 'FEATURED_JOB' : 'JOB_BOOST');

  const until = await prisma.$transaction(async (tx) => {
    const taken = await tx.creditAccount.updateMany({
      where: { userId: input.userId, ...(input.type === 'FEATURE' ? { featuredCredits: { gte: 1 } } : { boostCredits: { gte: 1 } }) },
      data: input.type === 'FEATURE' ? { featuredCredits: { decrement: 1 } } : { boostCredits: { decrement: 1 } },
    });
    if (taken.count === 0) throw new BillingError(402, 'NO_CREDITS', input.type === 'FEATURE' ? 'You have no featured-job credits left.' : 'You have no boost credits left.');

    const ends = extendPromotion(input.type === 'FEATURE' ? job.featuredUntil : job.boostedUntil, days, now);
    await tx.job.update({ where: { id: job.id }, data: input.type === 'FEATURE' ? { featuredUntil: ends } : { boostedUntil: ends } });
    await tx.creditLedger.create({ data: { userId: input.userId, creditType: input.type, delta: -1, reason: 'SPEND', jobId: job.id } });
    return ends;
  });

  if (input.type === 'BOOST') await announceBoost(job.id);
  return { until };
};

/** A boosted job is pushed to people whose job alerts match it. */
const announceBoost = async (jobId: string) => {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, employerId: true, title: true, description: true, location: true, type: true, category: true } });
  if (job) void notifyJobAlerts(job);
};

// ------------------------------------------------------------------ fulfilment

type PaymentRow = {
  id: string;
  userId: string;
  productId: string | null;
  productKind: string;
  targetId: string | null;
  subscriptionId: string | null;
  totalPesewas: number;
};

/** What a paid purchase gives: credits, a promotion on a job or course, or a subscription. Runs inside the payment's transaction. */
const applyBenefits = async (tx: Tx, payment: PaymentRow, now: Date) => {
  const product = payment.productId ? await tx.product.findUnique({ where: { id: payment.productId } }) : null;
  const kind = payment.productKind as ProductKind;
  const out: { boostedJobId?: string } = {};

  if (kind === 'JOB_PACK' && product) {
    await grantCredits(tx, { userId: payment.userId, featured: product.featuredCredits, boost: product.boostCredits, reason: 'PURCHASE', paymentId: payment.id });
  } else if (kind === 'FEATURED_JOB' && payment.targetId) {
    const job = await tx.job.findUnique({ where: { id: payment.targetId }, select: { featuredUntil: true } });
    if (job) await tx.job.update({ where: { id: payment.targetId }, data: { featuredUntil: extendPromotion(job.featuredUntil, product?.durationDays ?? DEFAULT_FEATURED_DAYS, now) } });
  } else if (kind === 'JOB_BOOST' && payment.targetId) {
    const job = await tx.job.findUnique({ where: { id: payment.targetId }, select: { boostedUntil: true } });
    if (job) {
      await tx.job.update({ where: { id: payment.targetId }, data: { boostedUntil: extendPromotion(job.boostedUntil, product?.durationDays ?? DEFAULT_BOOST_DAYS, now) } });
      out.boostedJobId = payment.targetId;
    }
  } else if (kind === 'FEATURED_COURSE' && payment.targetId) {
    const course = await tx.course.findUnique({ where: { id: payment.targetId }, select: { featuredFrom: true, featuredUntil: true } });
    if (course) {
      const running = course.featuredUntil && course.featuredUntil.getTime() > now.getTime();
      await tx.course.update({
        where: { id: payment.targetId },
        data: { featuredFrom: running ? course.featuredFrom : now, featuredUntil: extendPromotion(course.featuredUntil, product?.durationDays ?? DEFAULT_FEATURED_DAYS, now) },
      });
    }
  } else if (kind === 'SUBSCRIPTION' && product && product.interval) {
    const interval = product.interval as 'MONTHLY' | 'YEARLY';
    let subscriptionId = payment.subscriptionId;

    if (subscriptionId) {
      // A renewal: the new period starts where the last one ended (or now, if it had lapsed).
      const existing = await tx.subscription.findUnique({ where: { id: subscriptionId } });
      if (existing) {
        const start = existing.currentPeriodEnd.getTime() > now.getTime() ? existing.currentPeriodEnd : now;
        await tx.subscription.update({ where: { id: existing.id }, data: { status: 'ACTIVE', currentPeriodStart: start, currentPeriodEnd: addInterval(start, interval) } });
      }
    } else {
      const created = await tx.subscription.create({
        data: { userId: payment.userId, productId: product.id, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: addInterval(now, interval) },
      });
      subscriptionId = created.id;
      await tx.billingPayment.update({ where: { id: payment.id }, data: { subscriptionId } });
    }
    await grantCredits(tx, { userId: payment.userId, featured: product.featuredCredits, boost: product.boostCredits, reason: 'SUBSCRIPTION', paymentId: payment.id });
  }
  return out;
};

export type ConfirmResult = { status: 'PAID' | 'PENDING' | 'FAILED' | 'UNKNOWN'; alreadyDone?: boolean; receiptNumber?: string | null };

/**
 * Settles a payment. Both the webhook and the page people land on after paying come here, and both ask Paystack directly
 * ("did this transaction succeed, for how much, in what currency?") instead of believing what the browser or the caller says.
 * The first caller marks it paid and applies the purchase; any later caller finds it done and changes nothing.
 */
export const confirmPayment = async (reference: string, now = new Date()): Promise<ConfirmResult> => {
  const payment = await prisma.billingPayment.findUnique({ where: { reference } });
  if (!payment) return { status: 'UNKNOWN' };
  if (payment.status === 'PAID' || payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED') {
    return { status: 'PAID', alreadyDone: true, receiptNumber: payment.receiptNumber };
  }

  const tx = await paystack.verify(reference);

  if (tx.status !== 'success') {
    if (['failed', 'abandoned', 'reversed'].includes(tx.status)) {
      const changed = await prisma.billingPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', failureReason: tx.failureReason ?? tx.status } });
      if (changed.count > 0 && payment.billToEmail) sendQuietly('billing_failed_email_failed', () => mail.failed(payment.billToEmail!, { productName: payment.productName, reason: tx.failureReason }));
      return { status: 'FAILED' };
    }
    return { status: 'PENDING' };
  }

  // Paid, but for the wrong amount or in the wrong currency: never hand out the purchase.
  if (tx.amountPesewas !== payment.totalPesewas || tx.currency !== 'GHS') {
    await prisma.billingPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', failureReason: 'AMOUNT_MISMATCH' } });
    logger.error('billing_amount_mismatch', { reference, expected: payment.totalPesewas, received: tx.amountPesewas, currency: tx.currency });
    return { status: 'FAILED' };
  }

  const done = await prisma.$transaction(async (db) => {
    const settings = await db.billingSettings.upsert({ where: { id: 'default' }, create: { id: 'default', receiptSeq: 1 }, update: { receiptSeq: { increment: 1 } } });
    const paidAt = tx.paidAt ? new Date(tx.paidAt) : now;
    const number = receiptNumber(paidAt.getUTCFullYear(), settings.receiptSeq);

    // Only one caller gets past this line.
    const claimed = await db.billingPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'PAID', paidAt, channel: tx.channel, receiptNumber: number } });
    if (claimed.count === 0) return null;

    const outcome = await applyBenefits(db, payment, now);
    return { number, outcome };
  });

  if (!done) {
    const current = await prisma.billingPayment.findUnique({ where: { id: payment.id }, select: { receiptNumber: true } });
    return { status: 'PAID', alreadyDone: true, receiptNumber: current?.receiptNumber };
  }

  if (done.outcome.boostedJobId) await announceBoost(done.outcome.boostedJobId);

  if (payment.billToEmail) {
    sendQuietly('billing_receipt_email_failed', () =>
      mail.receipt(payment.billToEmail!, { receiptNumber: done.number, productName: payment.productName, total: formatGhs(payment.totalPesewas), vat: formatGhs(payment.vatPesewas) }),
    );
  }
  void createNotification(prisma, { userId: payment.userId, type: 'PAYMENT_RECEIVED', title: 'Payment received', message: `${payment.productName}: ${formatGhs(payment.totalPesewas)}. Receipt ${done.number}.`, actionUrl: '/billing' }).catch(() => undefined);

  return { status: 'PAID', receiptNumber: done.number };
};

// --------------------------------------------------------------------- webhooks

type PaystackEventBody = { event?: string; data?: Record<string, any> };

const eventKeyOf = (body: PaystackEventBody) => {
  const data = body.data ?? {};
  return `${body.event}:${data.id ?? data.reference ?? data.subscription_code ?? data.transaction_reference ?? ''}:${data.status ?? ''}`;
};

/** A charge we did not start ourselves: the automatic renewal of a subscription. Creates its payment, then settles it like any other. */
const startRenewal = async (data: Record<string, any>) => {
  const planCode = data.plan?.plan_code as string | undefined;
  if (!planCode) return false;
  const customerCode = data.customer?.customer_code as string | undefined;
  const email = (data.customer?.email as string | undefined)?.toLowerCase();

  const subscription = await prisma.subscription.findFirst({
    where: {
      product: { paystackPlanCode: planCode },
      OR: [...(customerCode ? [{ paystackCustomerCode: customerCode }] : []), ...(email ? [{ user: { email } }] : [])],
    },
    include: { product: true, user: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  if (!subscription) return false;

  const settings = await getSettings();
  const total = Number(data.amount);
  const vat = Math.round((total * settings.vatRatePercent) / (100 + settings.vatRatePercent));
  await prisma.billingPayment.create({
    data: {
      userId: subscription.userId,
      productId: subscription.productId,
      productKind: 'SUBSCRIPTION',
      productName: subscription.product.name,
      reference: String(data.reference),
      subtotalPesewas: total - vat,
      vatPesewas: vat,
      totalPesewas: total,
      vatRateBps: Math.round(settings.vatRatePercent * 100),
      billToEmail: subscription.user.email,
      subscriptionId: subscription.id,
    },
  });
  return true;
};

/**
 * One Paystack webhook. The caller has already checked the signature on the raw body. Each event is recorded once, so a repeat
 * does nothing; if handling fails the record is removed so Paystack's retry can try again.
 */
export const processPaystackEvent = async (body: PaystackEventBody) => {
  const type = body.event ?? '';
  const data = body.data ?? {};
  const eventKey = eventKeyOf(body);

  try {
    await prisma.paystackEvent.create({ data: { eventKey, type, reference: data.reference ?? null } });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return { handled: false, duplicate: true };
    throw error;
  }

  try {
    let outcome = 'ignored';

    if (type === 'charge.success') {
      const reference = String(data.reference ?? '');
      let known = await prisma.billingPayment.findUnique({ where: { reference }, select: { id: true } });
      if (!known && (await startRenewal(data))) known = { id: 'renewal' };
      outcome = known ? (await confirmPayment(reference)).status : 'not_ours';
    } else if (type === 'subscription.create') {
      const planCode = data.plan?.plan_code as string | undefined;
      const email = (data.customer?.email as string | undefined)?.toLowerCase();
      const subscription = await prisma.subscription.findFirst({
        where: { paystackSubscriptionCode: null, product: { paystackPlanCode: planCode }, ...(email ? { user: { email } } : {}) },
        orderBy: { createdAt: 'desc' },
      });
      if (!subscription) throw new BillingError(409, 'SUBSCRIPTION_NOT_READY', 'The first payment has not been settled yet.');
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { paystackSubscriptionCode: data.subscription_code, paystackCustomerCode: data.customer?.customer_code ?? null, paystackEmailToken: data.email_token ?? null },
      });
      outcome = 'linked';
    } else if (type === 'invoice.payment_failed') {
      const code = data.subscription?.subscription_code ?? data.subscription_code;
      const subscription = code ? await prisma.subscription.findUnique({ where: { paystackSubscriptionCode: code }, include: { user: { select: { email: true } }, product: { select: { name: true } } } }) : null;
      if (subscription) {
        await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'PAST_DUE' } });
        if (subscription.user.email) sendQuietly('billing_failed_email_failed', () => mail.failed(subscription.user.email!, { productName: `${subscription.product.name} (renewal)`, reason: data.description ?? null }));
        void createNotification(prisma, { userId: subscription.userId, type: 'PAYMENT_FAILED', title: 'Your plan payment failed', message: 'We could not renew your plan. Please check your payment method.', actionUrl: '/billing' }).catch(() => undefined);
      }
      outcome = subscription ? 'past_due' : 'not_ours';
    } else if (type === 'subscription.disable' || type === 'subscription.not_renew') {
      const code = data.subscription_code;
      const changed = code ? await prisma.subscription.updateMany({ where: { paystackSubscriptionCode: code }, data: { cancelAtPeriodEnd: true, cancelledAt: new Date() } }) : { count: 0 };
      outcome = changed.count > 0 ? 'cancel_at_period_end' : 'not_ours';
    } else if (type === 'refund.processed' || type === 'refund.failed') {
      const reference = data.transaction_reference ?? data.transaction?.reference;
      const payment = reference ? await prisma.billingPayment.findUnique({ where: { reference }, select: { id: true } }) : null;
      if (payment) {
        await prisma.billingRefund.updateMany({ where: { paymentId: payment.id, status: 'PENDING' }, data: { status: type === 'refund.processed' ? 'PROCESSED' : 'FAILED' } });
      }
      outcome = payment ? type : 'not_ours';
    }

    await prisma.paystackEvent.update({ where: { eventKey }, data: { outcome } });
    return { handled: true, outcome };
  } catch (error) {
    await prisma.paystackEvent.deleteMany({ where: { eventKey } });
    throw error;
  }
};

// ------------------------------------------------------------------ subscriptions

export const cancelSubscription = async (userId: string, subscriptionId: string) => {
  const subscription = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId } });
  if (!subscription || !['ACTIVE', 'PAST_DUE'].includes(subscription.status)) throw new BillingError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active plan to cancel.');

  // Stop the next charge at Paystack first. If that fails, say so rather than pretend.
  if (subscription.paystackSubscriptionCode && subscription.paystackEmailToken) {
    try {
      await paystack.disableSubscription({ code: subscription.paystackSubscriptionCode, token: subscription.paystackEmailToken });
    } catch {
      throw new BillingError(502, 'PAYSTACK_UNAVAILABLE', 'We could not cancel your plan with the payment provider. Please try again in a moment.');
    }
  }
  await prisma.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true, cancelledAt: new Date() } });
  return { endsOn: subscription.currentPeriodEnd };
};

/** Daily: remind people three days before a plan renews, and end plans that were not renewed. */
export const runBillingSweep = async (now = new Date(), daysBefore = 3) => {
  const soon = new Date(now.getTime() + daysBefore * DAY_MS);
  const due = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', cancelAtPeriodEnd: false, currentPeriodEnd: { gt: now, lte: soon } },
    include: { user: { select: { email: true } }, product: { select: { name: true, pricePesewas: true, paystackPlanAmount: true } } },
    take: 500,
  });

  let reminded = 0;
  for (const subscription of due) {
    // One reminder per period.
    if (subscription.reminderSentForPeriodEnd?.getTime() === subscription.currentPeriodEnd.getTime()) continue;
    if (!subscription.user.email) continue;
    await prisma.subscription.update({ where: { id: subscription.id }, data: { reminderSentForPeriodEnd: subscription.currentPeriodEnd } });
    const amount = subscription.product.paystackPlanAmount ?? subscription.product.pricePesewas;
    sendQuietly('billing_reminder_email_failed', () =>
      mail.reminder(subscription.user.email!, { planName: subscription.product.name, renewsOn: subscription.currentPeriodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), amount: formatGhs(amount) }),
    );
    reminded += 1;
  }

  // A renewal webhook that never came: after two days of grace the plan is over.
  const expired = await prisma.subscription.updateMany({
    where: { status: { in: ['ACTIVE', 'PAST_DUE'] }, currentPeriodEnd: { lt: new Date(now.getTime() - 2 * DAY_MS) } },
    data: { status: 'EXPIRED' },
  });

  return { reminded, expired: expired.count };
};

export const runBillingSweepSafely = async () => {
  try {
    const result = await runBillingSweep();
    if (result.reminded || result.expired) logger.info('billing_sweep', result);
  } catch (error) {
    logger.error('billing_sweep_failed', { error: getErrorMessage(error) });
  }
};

// ----------------------------------------------------------------- admin actions

type Admin = { id: string; email: string };

/** Refund a payment (all or part) through Paystack, optionally taking back what it gave. Logged in the admin action log. */
export const refundPayment = async (input: { admin: Admin; paymentId: string; amountPesewas?: number; reason: string; reverseBenefits: boolean }) => {
  const payment = await prisma.billingPayment.findUnique({ where: { id: input.paymentId } });
  if (!payment || !['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status)) throw new BillingError(400, 'NOT_REFUNDABLE', 'Only a paid payment can be refunded.');

  const left = payment.totalPesewas - payment.refundedPesewas;
  const amount = input.amountPesewas ?? left;
  if (!Number.isInteger(amount) || amount <= 0 || amount > left) throw new BillingError(400, 'BAD_AMOUNT', `The refund must be between GHS 0.01 and ${formatGhs(left)}.`);

  let refund;
  try {
    refund = await paystack.refund({ reference: payment.reference, amountPesewas: amount });
  } catch {
    throw new BillingError(502, 'PAYSTACK_REFUND_FAILED', 'Paystack could not process the refund. Nothing was changed.');
  }

  const fully = payment.refundedPesewas + amount >= payment.totalPesewas;

  await prisma.$transaction(async (tx) => {
    await tx.billingRefund.create({
      data: { paymentId: payment.id, amountPesewas: amount, reason: input.reason, adminId: input.admin.id, paystackRefundId: refund.refundId, status: refund.status === 'processed' ? 'PROCESSED' : 'PENDING', reversedBenefits: input.reverseBenefits },
    });
    await tx.billingPayment.update({ where: { id: payment.id }, data: { refundedPesewas: { increment: amount }, status: fully ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });

    if (input.reverseBenefits) {
      if (payment.productKind === 'JOB_PACK' || payment.productKind === 'SUBSCRIPTION') {
        // Take back the credits this payment gave, as far as they are still unspent.
        const granted = await tx.creditLedger.findMany({ where: { paymentId: payment.id, delta: { gt: 0 } } });
        const account = await tx.creditAccount.findUnique({ where: { userId: payment.userId } });
        for (const row of granted) {
          const have = row.creditType === 'FEATURE' ? account?.featuredCredits ?? 0 : account?.boostCredits ?? 0;
          const take = Math.min(row.delta, have);
          if (take > 0) await grantCredits(tx, { userId: payment.userId, ...(row.creditType === 'FEATURE' ? { featured: -take } : { boost: -take }), reason: 'REFUND', paymentId: payment.id, adminId: input.admin.id });
        }
        if (payment.productKind === 'SUBSCRIPTION' && payment.subscriptionId) {
          await tx.subscription.update({ where: { id: payment.subscriptionId }, data: { status: 'CANCELLED', cancelAtPeriodEnd: true, cancelledAt: new Date(), currentPeriodEnd: new Date() } });
        }
      } else if (payment.targetId && payment.productKind === 'FEATURED_JOB') {
        await tx.job.update({ where: { id: payment.targetId }, data: { featuredUntil: null } });
      } else if (payment.targetId && payment.productKind === 'JOB_BOOST') {
        await tx.job.update({ where: { id: payment.targetId }, data: { boostedUntil: null } });
      } else if (payment.targetId && payment.productKind === 'FEATURED_COURSE') {
        await tx.course.update({ where: { id: payment.targetId }, data: { featuredFrom: null, featuredUntil: null } });
      }
    }

    await recordAdminAction(tx, {
      admin: input.admin,
      action: fully ? 'PAYMENT_REFUNDED' : 'PAYMENT_PARTIALLY_REFUNDED',
      targetType: 'BillingPayment',
      targetId: payment.id,
      reason: input.reason,
      metadata: { reference: payment.reference, amountPesewas: amount, reverseBenefits: input.reverseBenefits, userId: payment.userId },
    });
    await createNotification(tx, { userId: payment.userId, type: 'PAYMENT_REFUNDED', title: 'You have been refunded', message: `${formatGhs(amount)} for ${payment.productName} is on its way back to you.`, actionUrl: '/billing' });
  });

  return { refundedPesewas: payment.refundedPesewas + amount, status: fully ? 'REFUNDED' : 'PARTIALLY_REFUNDED' };
};

/** Add or take away credits by hand (a goodwill gift, a correction). Needs a reason; logged. */
export const adjustCredits = async (input: { admin: Admin; userId: string; type: 'FEATURE' | 'BOOST'; delta: number; reason: string }) => {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new BillingError(404, 'USER_NOT_FOUND', 'No such account.');

  await prisma.$transaction(async (tx) => {
    if (input.delta < 0) {
      // Never below zero.
      const account = await tx.creditAccount.findUnique({ where: { userId: input.userId } });
      const have = input.type === 'FEATURE' ? account?.featuredCredits ?? 0 : account?.boostCredits ?? 0;
      if (have + input.delta < 0) throw new BillingError(400, 'NOT_ENOUGH_CREDITS', `They only have ${have} to take away.`);
    }
    await grantCredits(tx, { userId: input.userId, ...(input.type === 'FEATURE' ? { featured: input.delta } : { boost: input.delta }), reason: 'ADMIN_ADJUSTMENT', adminId: input.admin.id, note: input.reason });
    await recordAdminAction(tx, {
      admin: input.admin,
      action: 'CREDITS_ADJUSTED',
      targetType: 'User',
      targetId: input.userId,
      reason: input.reason,
      metadata: { creditType: input.type, delta: input.delta },
    });
  });
  return getCreditBalance(input.userId);
};

// ----------------------------------------------------------------------- reports

/** Money in, by product and by month. Refunds are taken off. */
export const revenueReport = async (months = 12, now = new Date()) => {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const payments = await prisma.billingPayment.findMany({
    where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, paidAt: { gte: from } },
    select: { productKind: true, productName: true, totalPesewas: true, vatPesewas: true, refundedPesewas: true, paidAt: true },
    take: 20000,
  });

  const byProduct = new Map<string, { kind: string; name: string; count: number; grossPesewas: number; vatPesewas: number; refundedPesewas: number }>();
  const byMonth = new Map<string, { month: string; count: number; grossPesewas: number; refundedPesewas: number }>();
  for (let i = 0; i < months; i += 1) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, { month: key, count: 0, grossPesewas: 0, refundedPesewas: 0 });
  }

  for (const payment of payments) {
    const product = byProduct.get(payment.productKind) ?? { kind: payment.productKind, name: payment.productKind, count: 0, grossPesewas: 0, vatPesewas: 0, refundedPesewas: 0 };
    product.count += 1;
    product.grossPesewas += payment.totalPesewas;
    product.vatPesewas += payment.vatPesewas;
    product.refundedPesewas += payment.refundedPesewas;
    byProduct.set(payment.productKind, product);

    const key = payment.paidAt ? `${payment.paidAt.getUTCFullYear()}-${String(payment.paidAt.getUTCMonth() + 1).padStart(2, '0')}` : '';
    const month = byMonth.get(key);
    if (month) {
      month.count += 1;
      month.grossPesewas += payment.totalPesewas;
      month.refundedPesewas += payment.refundedPesewas;
    }
  }

  const products = [...byProduct.values()].sort((a, b) => b.grossPesewas - a.grossPesewas);
  const sum = (pick: (row: (typeof products)[number]) => number) => products.reduce((total, row) => total + pick(row), 0);
  return {
    byProduct: products,
    byMonth: [...byMonth.values()],
    totals: { count: sum((r) => r.count), grossPesewas: sum((r) => r.grossPesewas), vatPesewas: sum((r) => r.vatPesewas), refundedPesewas: sum((r) => r.refundedPesewas), netPesewas: sum((r) => r.grossPesewas - r.refundedPesewas) },
  };
};
