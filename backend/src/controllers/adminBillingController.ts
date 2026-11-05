import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { adjustCredits, ensureDefaultProducts, getSettings, refundPayment, revenueReport, serializeProduct } from '../services/billingService';
import { respondBillingError } from './billingController';
import { recordAdminAction } from '../utils/adminAudit';
import { ghsToPesewas, slugify } from '../utils/billing';
import { singleValue } from '../utils/request';

const adminOf = async (req: AuthRequest) => {
  const admin = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true } });
  return { id: req.user!.id, email: admin?.email ?? 'unknown' };
};

type ProductBody = {
  kind: string;
  name: string;
  description: string;
  audience: string;
  priceGhs: number;
  durationDays?: number | null;
  featuredCredits: number;
  boostCredits: number;
  interval?: string | null;
  includes: string[];
  active: boolean;
  sortOrder: number;
  planTier?: string | null;
  teamLimit: number;
  cvDatabase: boolean;
  brandedPage: boolean;
  hiringReports: boolean;
  topEmployers: boolean;
};

const productData = (body: ProductBody) => ({
  kind: body.kind,
  name: body.name,
  description: body.description,
  audience: body.audience,
  pricePesewas: ghsToPesewas(body.priceGhs) as number,
  durationDays: body.durationDays ?? null,
  featuredCredits: body.featuredCredits,
  boostCredits: body.boostCredits,
  interval: body.kind === 'SUBSCRIPTION' && body.planTier !== 'FREE' ? body.interval ?? null : null,
  planTier: body.kind === 'SUBSCRIPTION' ? body.planTier ?? null : null,
  teamLimit: body.teamLimit,
  cvDatabase: body.cvDatabase,
  brandedPage: body.brandedPage,
  hiringReports: body.hiringReports,
  topEmployers: body.topEmployers,
  includesJson: JSON.stringify(body.includes),
  active: body.active,
  sortOrder: body.sortOrder,
});

export const listProducts = async (_req: AuthRequest, res: Response) => {
  try {
    await ensureDefaultProducts();
    const [settings, products] = await Promise.all([getSettings(), prisma.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })]);
    return res.json({ success: true, products: products.map((product) => serializeProduct(product, settings)) });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as ProductBody;
    const admin = await adminOf(req);
    const created = await prisma.$transaction(async (tx) => {
      const base = slugify(body.name) || 'product';
      const clash = await tx.product.count({ where: { slug: { startsWith: base } } });
      const product = await tx.product.create({ data: { ...productData(body), slug: clash ? `${base}-${clash + 1}` : base } });
      await recordAdminAction(tx, { admin, action: 'PRODUCT_CREATED', targetType: 'Product', targetId: product.id, metadata: { name: product.name, pricePesewas: product.pricePesewas } });
      return product;
    });
    return res.status(201).json({ success: true, id: created.id });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

/** Change a product. Past payments keep what they were bought at. A changed price gets a new Paystack plan at the next purchase. */
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const body = req.body as ProductBody;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });
    const admin = await adminOf(req);

    const data = productData(body);
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data });
      await recordAdminAction(tx, {
        admin,
        action: 'PRODUCT_UPDATED',
        targetType: 'Product',
        targetId: id,
        metadata: { name: data.name, before: { pricePesewas: existing.pricePesewas, active: existing.active, durationDays: existing.durationDays, teamLimit: existing.teamLimit, featuredCredits: existing.featuredCredits, boostCredits: existing.boostCredits, cvDatabase: existing.cvDatabase, hiringReports: existing.hiringReports }, after: { pricePesewas: data.pricePesewas, active: data.active, durationDays: data.durationDays, teamLimit: data.teamLimit, featuredCredits: data.featuredCredits, boostCredits: data.boostCredits, cvDatabase: data.cvDatabase, hiringReports: data.hiringReports } },
      });
    });
    return res.json({ success: true });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const getBillingSettings = async (_req: AuthRequest, res: Response) => {
  try {
    const { receiptSeq: _seq, id: _id, updatedAt: _updated, ...settings } = await getSettings();
    return res.json({ success: true, settings });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const updateBillingSettings = async (req: AuthRequest, res: Response) => {
  try {
    const before = await getSettings();
    const admin = await adminOf(req);
    await prisma.$transaction(async (tx) => {
      await tx.billingSettings.update({ where: { id: 'default' }, data: req.body });
      await recordAdminAction(tx, { admin, action: 'BILLING_SETTINGS_UPDATED', targetType: 'BillingSettings', targetId: 'default', metadata: { vatBefore: before.vatRatePercent, vatAfter: req.body.vatRatePercent, includeVatBefore: before.pricesIncludeVat, includeVatAfter: req.body.pricesIncludeVat } });
    });
    return res.json({ success: true });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const getRevenue = async (req: AuthRequest, res: Response) => {
  try {
    const months = Math.min(36, Math.max(1, Number(singleValue(req.query.months as string | string[] | undefined)) || 12));
    const report = await revenueReport(months);
    const names = new Map((await prisma.product.findMany({ select: { kind: true, name: true }, orderBy: { sortOrder: 'asc' } })).map((product) => [product.kind, product.name.replace(/\s*\(.*\)\s*$/, '')]));
    return res.json({ success: true, ...report, byProduct: report.byProduct.map((row) => ({ ...row, name: names.get(row.kind) ?? row.kind })) });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const listPayments = async (req: AuthRequest, res: Response) => {
  try {
    const status = singleValue(req.query.status as string | string[] | undefined);
    const q = (singleValue(req.query.q as string | string[] | undefined) || '').trim();
    const page = Math.max(1, Number(singleValue(req.query.page as string | string[] | undefined)) || 1);

    const rows = await prisma.billingPayment.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ reference: { contains: q } }, { receiptNumber: { contains: q } }, { billToEmail: { contains: q } }, { billToName: { contains: q } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50,
      select: { id: true, userId: true, reference: true, productKind: true, productName: true, status: true, totalPesewas: true, vatPesewas: true, refundedPesewas: true, receiptNumber: true, billToName: true, billToEmail: true, channel: true, paidAt: true, createdAt: true, failureReason: true },
    });
    return res.json({ success: true, payments: rows, page });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const refund = async (req: AuthRequest, res: Response) => {
  try {
    const { amountGhs, reason, reverseBenefits } = req.body as { amountGhs?: number; reason: string; reverseBenefits: boolean };
    const result = await refundPayment({
      admin: await adminOf(req),
      paymentId: singleValue(req.params.id) || '',
      amountPesewas: amountGhs !== undefined ? (ghsToPesewas(amountGhs) ?? undefined) : undefined,
      reason,
      reverseBenefits,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const adjustUserCredits = async (req: AuthRequest, res: Response) => {
  try {
    const { email, userId, type, delta, reason } = req.body as { email?: string; userId?: string; type: 'FEATURE' | 'BOOST'; delta: number; reason: string };
    const user = await prisma.user.findFirst({ where: userId ? { id: userId } : { email }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'No account with that email.' });

    const credits = await adjustCredits({ admin: await adminOf(req), userId: user.id, type, delta, reason });
    return res.json({ success: true, credits });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

/** The credits and any plan an account has, for the admin to look up before adjusting. */
export const lookupAccount = async (req: AuthRequest, res: Response) => {
  try {
    const email = (singleValue(req.query.email as string | string[] | undefined) || '').trim().toLowerCase();
    const user = email ? await prisma.user.findFirst({ where: { email }, select: { id: true, email: true, role: true, creditAccount: { select: { featuredCredits: true, boostCredits: true } }, subscriptions: { where: { status: { in: ['ACTIVE', 'PAST_DUE'] } }, select: { product: { select: { name: true } }, status: true, currentPeriodEnd: true } } } }) : null;
    if (!user) return res.status(404).json({ success: false, message: 'No account with that email.' });
    return res.json({ success: true, account: { id: user.id, email: user.email, role: user.role, featuredCredits: user.creditAccount?.featuredCredits ?? 0, boostCredits: user.creditAccount?.boostCredits ?? 0, plans: user.subscriptions.map((s) => ({ name: s.product.name, status: s.status, currentPeriodEnd: s.currentPeriodEnd })) } });
  } catch (error) {
    return respondBillingError(res, error);
  }
};

