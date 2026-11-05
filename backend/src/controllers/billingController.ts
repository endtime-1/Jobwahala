import { Request, Response } from 'express';
import logger from '../config/logger';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  BillingError,
  cancelSubscription,
  confirmPayment,
  createCheckout,
  getCreditBalance,
  getSettings,
  listCatalogue,
  ensureDefaultProducts,
  processPaystackEvent,
  scheduleDowngrade,
  serializeProduct,
  spendCredit,
} from '../services/billingService';
import { getEntitlements } from '../services/planService';
import { isValidPaystackSignature, paystackMode } from '../services/paystackBilling';
import { getErrorMessage } from '../utils/errors';
import { publicJobWhere } from '../utils/jobLifecycle';
import { singleValue } from '../utils/request';
import { renderReceiptHtml } from '../utils/receiptRender';
import { publicCourseWhere, isFeaturedNow } from '../utils/courses';
import { promotionOf } from '../utils/billing';
import { monthStart } from '../utils/cvDatabase';

/** Turns a BillingError into the answer the page can act on; anything else is a plain 500. */
export const respondBillingError = (res: Response, error: unknown) => {
  if (error instanceof BillingError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  return res.status(500).json({ success: false, message: getErrorMessage(error) });
};

export const getCatalogue = async (req: AuthRequest, res: Response) => {
  try {
    const [products, settings] = await Promise.all([listCatalogue({ id: req.user!.id, role: req.user!.role }), getSettings()]);
    return res.json({ success: true, mode: paystackMode(), products, vatRatePercent: settings.vatRatePercent, pricesIncludeVat: settings.pricesIncludeVat });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

/** Everything the billing page shows: credits, plans, payment history, and the jobs and courses that can be promoted. */
export const getMyBilling = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [credits, subscriptions, payments, jobs, courses] = await Promise.all([
      getCreditBalance(userId),
      prisma.subscription.findMany({
        where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
        include: { product: { select: { name: true, interval: true, featuredCredits: true, boostCredits: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.billingPayment.findMany({
        where: { userId, status: { not: 'PENDING' } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, reference: true, productName: true, status: true, totalPesewas: true, vatPesewas: true, refundedPesewas: true, receiptNumber: true, paidAt: true, createdAt: true, channel: true },
      }),
      prisma.job.findMany({ where: { employerId: userId, ...publicJobWhere() }, select: { id: true, title: true, featuredUntil: true, boostedUntil: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.course.findMany({ where: { providerId: userId, ...publicCourseWhere() }, select: { id: true, title: true, featuredFrom: true, featuredUntil: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);

    return res.json({
      success: true,
      credits,
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        name: subscription.product.name,
        interval: subscription.product.interval,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      })),
      payments,
      jobs: jobs.map((job) => ({ id: job.id, title: job.title, promotion: promotionOf(job), featuredUntil: job.featuredUntil, boostedUntil: job.boostedUntil })),
      courses: courses.map((course) => ({ id: course.id, title: course.title, featured: isFeaturedNow(course), featuredUntil: course.featuredUntil })),
    });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const startCheckout = async (req: AuthRequest, res: Response) => {
  try {
    const { productId, targetId } = req.body as { productId: string; targetId?: string };
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true, employerProfile: { select: { companyName: true } } } });
    if (!user?.email) throw new BillingError(400, 'EMAIL_REQUIRED', 'Add an email address to your account first: Paystack sends your receipt there.');

    const checkout = await createCheckout({ userId: req.user!.id, role: req.user!.role, email: user.email, name: user.employerProfile?.companyName ?? null, productId, targetId });
    return res.status(201).json({ success: true, ...checkout });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

/** The page people land on after paying asks here. We ask Paystack; we do not take the browser's word for it. */
export const getPaymentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const reference = singleValue(req.params.reference) || '';
    const payment = await prisma.billingPayment.findUnique({ where: { reference }, select: { userId: true } });
    if (!payment || payment.userId !== req.user!.id) return res.status(404).json({ success: false, message: 'Payment not found' });

    const result = await confirmPayment(reference);
    return res.json({ success: true, status: result.status, receiptNumber: result.receiptNumber ?? null });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const promoteJob = async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.body as { type: 'FEATURE' | 'BOOST' };
    const result = await spendCredit({ userId: req.user!.id, type, jobId: singleValue(req.params.id) || '' });
    return res.json({ success: true, until: result.until, credits: await getCreditBalance(req.user!.id) });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const cancelMySubscription = async (req: AuthRequest, res: Response) => {
  try {
    const result = await cancelSubscription(req.user!.id, singleValue(req.params.id) || '');
    return res.json({ success: true, endsOn: result.endsOn });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

/** A receipt for a payment that went through, with the VAT. The owner only. */
export const downloadReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const payment = await prisma.billingPayment.findUnique({ where: { id } });
    if (!payment || payment.userId !== req.user!.id || !payment.receiptNumber) return res.status(404).json({ success: false, message: 'Receipt not found' });

    const settings = await getSettings();
    res.type('html');
    res.set('Content-Disposition', `attachment; filename="receipt-${payment.receiptNumber}.html"`);
    res.set('Cache-Control', 'private, no-store');
    return res.send(renderReceiptHtml(payment, settings));
  } catch (error) {
    return respondBillingError(res, error);
  }
};

type RawBodyRequest = Request & { rawBody?: Buffer };

/**
 * Paystack's webhook. The signature is checked against the exact bytes Paystack sent; anything else is refused before it is
 * read. A good answer is 200; if handling fails we answer 500 so Paystack tries again later.
 */
export const handlePaystackBillingWebhook = async (req: RawBodyRequest, res: Response) => {
  if (!isValidPaystackSignature(req.rawBody, req.header('x-paystack-signature'))) {
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  try {
    const result = await processPaystackEvent(req.body);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error('billing_webhook_failed', { error: getErrorMessage(error) });
    return res.status(500).json({ success: false, message: 'Could not process this event' });
  }
};

/** The plan page: every plan side by side, the one this company is on, and how much of it is used. */
export const getPlans = async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user!.id;
    await ensureDefaultProducts();
    const [settings, products, entitlements, credits, teamSeats, unlocksUsed] = await Promise.all([
      getSettings(),
      prisma.product.findMany({ where: { planTier: { not: null }, active: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      getEntitlements(ownerId),
      getCreditBalance(ownerId),
      prisma.teamMember.count({ where: { ownerId, status: { in: ['ACTIVE', 'INVITED'] } } }),
      prisma.cvUnlock.count({ where: { employerId: ownerId, createdAt: { gte: monthStart(new Date()) } } }),
    ]);

    return res.json({
      success: true,
      mode: paystackMode(),
      plans: products.map((product) => serializeProduct(product, settings)),
      current: {
        tier: entitlements.tier,
        planName: entitlements.planName,
        productId: entitlements.productId,
        interval: entitlements.interval,
        subscription: entitlements.subscription,
        features: { teamLimit: entitlements.teamLimit, cvDatabase: entitlements.cvDatabase, monthlyUnlocks: entitlements.monthlyUnlocks, brandedPage: entitlements.brandedPage, hiringReports: entitlements.hiringReports, topEmployers: entitlements.topEmployers },
      },
      usage: {
        featuredCredits: credits.featuredCredits,
        boostCredits: credits.boostCredits,
        planCredits: credits.plan,
        purchasedCredits: credits.purchased,
        monthlyFeaturedCredits: entitlements.monthlyFeaturedCredits,
        monthlyBoostCredits: entitlements.monthlyBoostCredits,
        teamSeatsUsed: 1 + teamSeats,
        teamLimit: entitlements.teamLimit,
        unlocksUsed,
        monthlyUnlocks: entitlements.monthlyUnlocks,
      },
    });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

/** Move to a smaller plan (or to Free): it starts when the current period ends. Moving up is a normal purchase. */
export const changePlan = async (req: AuthRequest, res: Response) => {
  try {
    const result = await scheduleDowngrade(req.user!.id, (req.body as { productId: string }).productId);
    return res.json({ success: true, ...result });
  } catch (error) {
    return respondBillingError(res, error);
  }
};
