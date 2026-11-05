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
import { BillingError } from './billingErrors';
import { expirePlanCredits, getCreditBalance, getEntitlements, grantMonthlyPlanCredits, reconcileTeam } from './planService';
import { DEFAULT_PLANS, GRACE_DAYS, featuresOf, graceEndFrom, graceRemindersDue, isLive, planLevel } from '../utils/plans';
import { notifyJobAlerts } from './jobAlertService';
import { sendGraceReminderEmail, sendPaymentFailedEmail, sendPaymentReceiptEmail, sendRenewalReminderEmail } from './emailService';

export { BillingError };
export { getCreditBalance };

type Mailer = {
  receipt: typeof sendPaymentReceiptEmail;
  failed: typeof sendPaymentFailedEmail;
  reminder: typeof sendRenewalReminderEmail;
  grace: typeof sendGraceReminderEmail;
};

let paystack: PaystackClient = realPaystack;
let mail: Mailer = { receipt: sendPaymentReceiptEmail, failed: sendPaymentFailedEmail, reminder: sendRenewalReminderEmail, grace: sendGraceReminderEmail };

/** For tests: stand in for Paystack and for email. */
export const setBillingDepsForTests = (deps?: { paystack?: PaystackClient; mail?: Partial<Mailer> }) => {
  paystack = deps?.paystack ?? realPaystack;
  mail = { receipt: sendPaymentReceiptEmail, failed: sendPaymentFailedEmail, reminder: sendRenewalReminderEmail, grace: sendGraceReminderEmail, ...(deps?.mail ?? {}) };
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
  // Each kind of product is added once, when the catalogue has none of that kind (so a new kind appears on its own).
  for (const product of DEFAULT_PRODUCTS) {
    if ((await prisma.product.count({ where: { kind: product.kind } })) > 0) continue;
    const { includes, ...rest } = product;
    await prisma.product.create({ data: { ...rest, includesJson: JSON.stringify(includes) } });
  }
  // Employer plans: the Free plan and the paid tiers, to start from. Added once, whenever there are none.
  if ((await prisma.product.count({ where: { planTier: { not: null } } })) === 0) {
    for (const plan of DEFAULT_PLANS) {
      const { includes, ...rest } = plan;
      await prisma.product.create({ data: { ...rest, kind: 'SUBSCRIPTION', audience: 'EMPLOYER', includesJson: JSON.stringify(includes), durationDays: null } });
    }
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
  planTier?: string | null;
  teamLimit?: number;
  cvDatabase?: boolean;
  monthlyUnlocks?: number;
  brandedPage?: boolean;
  hiringReports?: boolean;
  topEmployers?: boolean;
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
    planTier: product.planTier ?? null,
    teamLimit: product.teamLimit ?? 1,
    cvDatabase: product.cvDatabase ?? false,
    monthlyUnlocks: product.monthlyUnlocks ?? 0,
    brandedPage: product.brandedPage ?? false,
    hiringReports: product.hiringReports ?? false,
    topEmployers: product.topEmployers ?? false,
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
export const listCatalogue = async (user: { id: string; role?: string }) => {
  await ensureDefaultProducts();
  const [settings, profile, products] = await Promise.all([
    getSettings(),
    prisma.employerProfile.findUnique({ where: { userId: user.id }, select: { isTrainingProvider: true } }),
    prisma.product.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
  ]);
  const seeker = user.role === 'SEEKER';
  const visible = products.filter((product) => (seeker ? product.audience === 'SEEKER' : product.audience === 'EMPLOYER' || (product.audience === 'PROVIDER' && Boolean(profile?.isTrainingProvider))));
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
export const createCheckout = async (input: { userId: string; role?: string; email: string; name?: string | null; productId: string; targetId?: string }) => {
  if (paystackMode() === 'off') throw new BillingError(503, 'PAYMENTS_NOT_SET_UP', 'Payments are not available right now. Please try again later.');

  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product || !product.active) throw new BillingError(404, 'PRODUCT_NOT_FOUND', 'That product is not available.');

  // Job seekers buy seeker products (a profile boost); everyone else buys the rest.
  if ((input.role === 'SEEKER') !== (product.audience === 'SEEKER')) throw new BillingError(403, 'NOT_FOR_YOU', 'That product is not for your kind of account.');

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
  } else if (product.kind === 'PROFILE_BOOST') {
    const profile = await prisma.jobSeekerProfile.findUnique({ where: { userId: input.userId }, select: { cvVisibility: true } });
    if (!profile) throw new BillingError(403, 'SEEKER_ONLY', 'A profile boost is for job seekers.');
    if (profile.cvVisibility !== 'VERIFIED_EMPLOYERS') throw new BillingError(400, 'PROFILE_HIDDEN', 'Your profile is hidden, so a boost would show it to nobody. Set it to "Visible to verified employers" first.');
  } else if (product.kind === 'SUBSCRIPTION') {
    if (product.planTier === 'FREE' || product.pricePesewas <= 0) throw new BillingError(400, 'FREE_PLAN', 'The Free plan costs nothing. To move to it, cancel your paid plan.');

    const current = await getEntitlements(input.userId);
    if (current.productId === product.id) throw new BillingError(409, 'ALREADY_SUBSCRIBED', 'You already have this plan.');
    // Moving up takes effect straight away and is paid now. Moving down waits for the end of the period, through "Change plan".
    if (current.subscription && product.planTier && planLevel(product) <= planLevel({ planTier: current.tier, interval: current.interval })) {
      throw new BillingError(409, 'USE_DOWNGRADE', 'To move to a smaller plan, use "Change plan": it starts when your current period ends, so you keep what you paid for.');
    }
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

/** Spend one credit to feature or boost one of the employer's open jobs. One conditional update: no double spending. */
export const spendCredit = async (input: { userId: string; type: 'FEATURE' | 'BOOST'; jobId: string }, now = new Date()) => {
  const job = await prisma.job.findFirst({ where: { id: input.jobId, employerId: input.userId, ...publicJobWhere() }, select: { id: true, featuredUntil: true, boostedUntil: true } });
  if (!job) throw new BillingError(404, 'JOB_NOT_FOUND', 'Choose one of your open jobs.');

  const days = await productDays(input.type === 'FEATURE' ? 'FEATURED_JOB' : 'JOB_BOOST');

  const until = await prisma.$transaction(async (tx) => {
    // Monthly plan credits go first (they expire), then credits that were bought or given. Each is one conditional update.
    const feature = input.type === 'FEATURE';
    let taken = await tx.creditAccount.updateMany({
      where: { userId: input.userId, ...(feature ? { planFeaturedCredits: { gte: 1 } } : { planBoostCredits: { gte: 1 } }) },
      data: feature ? { planFeaturedCredits: { decrement: 1 } } : { planBoostCredits: { decrement: 1 } },
    });
    if (taken.count === 0) {
      taken = await tx.creditAccount.updateMany({
        where: { userId: input.userId, ...(feature ? { featuredCredits: { gte: 1 } } : { boostCredits: { gte: 1 } }) },
        data: feature ? { featuredCredits: { decrement: 1 } } : { boostCredits: { decrement: 1 } },
      });
    }
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
type PaymentInfo = { authorizationCode?: string | null; customerCode?: string | null };

const applyBenefits = async (tx: Tx, payment: PaymentRow, now: Date, info: PaymentInfo = {}) => {
  const product = payment.productId ? await tx.product.findUnique({ where: { id: payment.productId } }) : null;
  const kind = payment.productKind as ProductKind;
  const out: { boostedJobId?: string; reconcileTeamFor?: string; stopRepeating: { code: string; token: string }[] } = { stopRepeating: [] };

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
  } else if (kind === 'PROFILE_BOOST' && product) {
    const profile = await tx.jobSeekerProfile.findUnique({ where: { userId: payment.userId }, select: { profileBoostedUntil: true } });
    if (profile) await tx.jobSeekerProfile.update({ where: { userId: payment.userId }, data: { profileBoostedUntil: extendPromotion(profile.profileBoostedUntil, product.durationDays ?? 30, now) } });
  } else if (kind === 'SUBSCRIPTION' && product && product.interval) {
    const interval = product.interval as 'MONTHLY' | 'YEARLY';
    let subscriptionId = payment.subscriptionId;

    if (subscriptionId) {
      // A renewal, or a scheduled move to a smaller plan starting: the new period starts where the last one ended (or now, if it had lapsed).
      const existing = await tx.subscription.findUnique({ where: { id: subscriptionId } });
      if (existing) {
        const start = existing.currentPeriodEnd.getTime() > now.getTime() ? existing.currentPeriodEnd : now;
        await tx.subscription.update({
          where: { id: existing.id },
          data: {
            productId: product.id,
            status: 'ACTIVE',
            currentPeriodStart: start,
            currentPeriodEnd: addInterval(start, interval),
            nextCreditGrantAt: addInterval(start, 'MONTHLY'),
            // Paid up again: the grace period is over, and a planned move has now happened.
            graceEndsAt: null,
            graceRemindersSent: 0,
            pendingProductId: null,
            cancelAtPeriodEnd: false,
            cancelledAt: null,
            ...(info.authorizationCode ? { authorizationCode: info.authorizationCode } : {}),
          },
        });
      }
    } else {
      // A new plan. If the company already has one, this is an upgrade and it takes effect now: the old plan ends today.
      const earlier = await tx.subscription.findMany({ where: { userId: payment.userId, status: { in: ['ACTIVE', 'PAST_DUE'] } } });
      for (const old of earlier) {
        await tx.subscription.update({ where: { id: old.id }, data: { status: 'CANCELLED', cancelAtPeriodEnd: true, cancelledAt: now, currentPeriodEnd: now, pendingProductId: null } });
        if (old.paystackSubscriptionCode && old.paystackEmailToken) out.stopRepeating.push({ code: old.paystackSubscriptionCode, token: old.paystackEmailToken });
      }
      const created = await tx.subscription.create({
        data: {
          userId: payment.userId,
          productId: product.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: addInterval(now, interval),
          nextCreditGrantAt: addInterval(now, 'MONTHLY'),
          authorizationCode: info.authorizationCode ?? null,
          paystackCustomerCode: info.customerCode ?? null,
        },
      });
      subscriptionId = created.id;
      await tx.billingPayment.update({ where: { id: payment.id }, data: { subscriptionId } });
    }

    // This month's plan credits. What was left of last month's expires now (that is the rule); pack credits are untouched.
    await grantMonthlyPlanCredits(payment.userId, { featured: product.featuredCredits, boost: product.boostCredits }, tx as never, payment.id);
    out.reconcileTeamFor = payment.userId;
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

    const outcome = await applyBenefits(db, payment, now, { authorizationCode: tx.authorizationCode, customerCode: tx.customerCode });
    return { number, outcome };
  });

  if (!done) {
    const current = await prisma.billingPayment.findUnique({ where: { id: payment.id }, select: { receiptNumber: true } });
    return { status: 'PAID', alreadyDone: true, receiptNumber: current?.receiptNumber };
  }

  if (done.outcome.boostedJobId) await announceBoost(done.outcome.boostedJobId);

  // An upgrade ends the old plan at Paystack too, so it is not charged again. Best effort: the local plan is already over.
  for (const old of done.outcome.stopRepeating) {
    sendQuietly('billing_stop_old_plan_failed', () => paystack.disableSubscription({ code: old.code, token: old.token }));
  }
  if (done.outcome.reconcileTeamFor) await reconcileTeam(done.outcome.reconcileTeamFor);

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

  // The plan being charged: the one the company is on, or the smaller one it asked to move to at the end of the period.
  const charged = await prisma.product.findFirst({ where: { paystackPlanCode: planCode } });
  if (!charged) return false;

  const subscription = await prisma.subscription.findFirst({
    where: {
      OR: [{ productId: charged.id }, { pendingProductId: charged.id }],
      AND: [{ OR: [...(customerCode ? [{ paystackCustomerCode: customerCode }] : []), ...(email ? [{ user: { email } }] : [])] }],
    },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  if (!subscription) return false;

  const settings = await getSettings();
  const total = Number(data.amount);
  const vat = Math.round((total * settings.vatRatePercent) / (100 + settings.vatRatePercent));
  await prisma.billingPayment.create({
    data: {
      userId: subscription.userId,
      productId: charged.id,
      productKind: 'SUBSCRIPTION',
      productName: charged.name,
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
      const planProduct = planCode ? await prisma.product.findFirst({ where: { paystackPlanCode: planCode }, select: { id: true } }) : null;
      // Either the first payment's plan, or the smaller plan the company asked to move to at the end of its period.
      const subscription = planProduct
        ? await prisma.subscription.findFirst({
            where: { OR: [{ paystackSubscriptionCode: null, productId: planProduct.id }, { pendingProductId: planProduct.id }], ...(email ? { user: { email } } : {}) },
            orderBy: { createdAt: 'desc' },
          })
        : null;
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
        // The plan keeps working for 7 days while the payment is put right. The clock starts at the first failure only.
        const graceEndsAt = subscription.graceEndsAt ?? graceEndFrom(new Date());
        await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'PAST_DUE', graceEndsAt, ...(subscription.graceEndsAt ? {} : { graceRemindersSent: 0 }) } });
        if (subscription.user.email) {
          sendQuietly('billing_failed_email_failed', () =>
            mail.failed(subscription.user.email!, { productName: `${subscription.product.name} (renewal)`, reason: data.description ?? null, graceEndsOn: graceEndsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }),
          );
        }
        void createNotification(prisma, { userId: subscription.userId, type: 'PAYMENT_FAILED', title: 'Your plan payment failed', message: `We could not renew your plan. It keeps working for ${GRACE_DAYS} days while you fix the payment.`, actionUrl: '/plans' }).catch(() => undefined);
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

const fullDate = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Move to a smaller plan. It starts when the current period ends, so the company keeps what it paid for. With a saved card the
 * smaller plan is scheduled at Paystack to begin on that day; without one, the current plan simply is not renewed and the
 * company chooses the smaller plan when it ends. The Free plan is the same as cancelling.
 */
export const scheduleDowngrade = async (userId: string, targetProductId: string) => {
  const current = await getEntitlements(userId);
  if (!current.subscription) throw new BillingError(400, 'NO_PLAN', 'You are on the Free plan already.');

  const target = await prisma.product.findUnique({ where: { id: targetProductId } });
  if (!target || !target.active || !target.planTier) throw new BillingError(404, 'PRODUCT_NOT_FOUND', 'That plan is not available.');

  if (target.planTier === 'FREE') {
    const result = await cancelSubscription(userId, current.subscription.id);
    return { effectiveOn: result.endsOn, scheduled: true, to: target.name };
  }
  if (planLevel(target) >= planLevel({ planTier: current.tier, interval: current.interval })) {
    throw new BillingError(400, 'NOT_A_DOWNGRADE', 'That is not a smaller plan. To move up, buy it: it starts straight away.');
  }

  const subscription = await prisma.subscription.findUnique({ where: { id: current.subscription.id } });
  if (!subscription) throw new BillingError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active plan.');

  let scheduled = false;
  if (subscription.authorizationCode && subscription.paystackCustomerCode) {
    const settings = await getSettings();
    try {
      const planCode = await ensurePlan(target, priceWithVat(target.pricePesewas, settings).totalPesewas);
      await paystack.createSubscription({ customerCode: subscription.paystackCustomerCode, planCode, authorizationCode: subscription.authorizationCode, startDate: subscription.currentPeriodEnd });
      scheduled = true;
    } catch (error) {
      logger.error('billing_schedule_downgrade_failed', { error: getErrorMessage(error) });
      throw new BillingError(502, 'PAYSTACK_UNAVAILABLE', 'We could not schedule that change with the payment provider. Nothing was changed. Please try again.');
    }
  }

  // Either way the current plan stops repeating: it runs to the end of the period it was paid for.
  if (subscription.paystackSubscriptionCode && subscription.paystackEmailToken) {
    try {
      await paystack.disableSubscription({ code: subscription.paystackSubscriptionCode, token: subscription.paystackEmailToken });
    } catch {
      throw new BillingError(502, 'PAYSTACK_UNAVAILABLE', 'We could not change your plan with the payment provider. Please try again in a moment.');
    }
  }
  await prisma.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true, pendingProductId: scheduled ? target.id : null } });
  return { effectiveOn: subscription.currentPeriodEnd, scheduled, to: target.name };
};

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

/**
 * Daily: remind people three days before a plan renews, give yearly plans their monthly credits, remind people whose payment
 * failed (during the 7-day grace period), and end plans that are over. Ending a plan never deletes anything: the company moves
 * to Free, its monthly credits go, and team members above the Free limit are paused.
 */
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
    sendQuietly('billing_reminder_email_failed', () => mail.reminder(subscription.user.email!, { planName: subscription.product.name, renewsOn: fullDate(subscription.currentPeriodEnd), amount: formatGhs(amount) }));
    reminded += 1;
  }

  // A yearly plan's credits come monthly, inside the year it paid for. (A monthly plan's come with each renewal.)
  const owed = await prisma.subscription.findMany({ where: { status: { in: ['ACTIVE', 'PAST_DUE'] }, nextCreditGrantAt: { lte: now } }, include: { product: true }, take: 500 });
  let granted = 0;
  for (const subscription of owed) {
    if (!isLive(subscription, now) || !subscription.nextCreditGrantAt || subscription.nextCreditGrantAt.getTime() >= subscription.currentPeriodEnd.getTime()) continue;
    await prisma.$transaction(async (tx) => {
      await grantMonthlyPlanCredits(subscription.userId, { featured: subscription.product.featuredCredits, boost: subscription.product.boostCredits }, tx as never);
      await tx.subscription.update({ where: { id: subscription.id }, data: { nextCreditGrantAt: addInterval(subscription.nextCreditGrantAt!, 'MONTHLY') } });
    });
    granted += 1;
  }

  // Renewal payment failed: reminders while the 7 days of grace run.
  const late = await prisma.subscription.findMany({
    where: { status: 'PAST_DUE', graceEndsAt: { gt: now } },
    include: { user: { select: { email: true } }, product: { select: { name: true } } },
    take: 500,
  });
  let graceReminders = 0;
  for (const subscription of late) {
    const owedReminders = graceRemindersDue(subscription.graceEndsAt!, now);
    if (owedReminders <= subscription.graceRemindersSent) continue;
    await prisma.subscription.update({ where: { id: subscription.id }, data: { graceRemindersSent: owedReminders } });
    if (subscription.user.email) {
      sendQuietly('billing_grace_email_failed', () => mail.grace(subscription.user.email!, { planName: subscription.product.name, endsOn: fullDate(subscription.graceEndsAt!), lastChance: owedReminders >= 2 }));
    }
    graceReminders += 1;
  }

  // Plans that are over: past the end of the period they paid for (or cancelled), or past their grace. The company is on Free from here.
  const ending = await prisma.subscription.findMany({ where: { status: { in: ['ACTIVE', 'PAST_DUE'] }, currentPeriodEnd: { lt: now } }, take: 500 });
  let expired = 0;
  const owners = new Set<string>();
  for (const subscription of [...ending, ...(await prisma.subscription.findMany({ where: { status: 'PAST_DUE', graceEndsAt: { lt: now } }, take: 500 }))]) {
    if (isLive(subscription, now) || owners.has(subscription.id)) continue;
    owners.add(subscription.id);
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'EXPIRED' } });
    await expirePlanCredits(subscription.userId);
    await reconcileTeam(subscription.userId, now);
    expired += 1;
  }

  return { reminded, granted, graceReminders, expired };
};

export const runBillingSweepSafely = async () => {
  try {
    const result = await runBillingSweep();
    if (result.reminded || result.expired || result.granted || result.graceReminders) logger.info('billing_sweep', result);
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
      if (payment.productKind === 'JOB_PACK') {
        // Take back the credits this payment gave, as far as they are still unspent.
        const granted = await tx.creditLedger.findMany({ where: { paymentId: payment.id, delta: { gt: 0 } } });
        const account = await tx.creditAccount.findUnique({ where: { userId: payment.userId } });
        for (const row of granted) {
          const have = row.creditType === 'FEATURE' ? account?.featuredCredits ?? 0 : account?.boostCredits ?? 0;
          const take = Math.min(row.delta, have);
          if (take > 0) await grantCredits(tx, { userId: payment.userId, ...(row.creditType === 'FEATURE' ? { featured: -take } : { boost: -take }), reason: 'REFUND', paymentId: payment.id, adminId: input.admin.id });
        }
      } else if (payment.productKind === 'SUBSCRIPTION') {
        // The plan ends now, and so do its monthly credits. Credits that were bought stay.
        if (payment.subscriptionId) {
          await tx.subscription.update({ where: { id: payment.subscriptionId }, data: { status: 'CANCELLED', cancelAtPeriodEnd: true, cancelledAt: new Date(), currentPeriodEnd: new Date(), pendingProductId: null } });
        }
        await expirePlanCredits(payment.userId, tx as never);
      } else if (payment.productKind === 'PROFILE_BOOST') {
        await tx.jobSeekerProfile.update({ where: { userId: payment.userId }, data: { profileBoostedUntil: null } });
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
