import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { BillingError } from '../services/billingErrors';
import {
  acceptClaim,
  attachReferral,
  createManagedCompany,
  getEmployerWeeklyReport,
  getReferralInfo,
  issueClaimLink,
  listFoundingEmployers,
  listManagedCompanies,
  previewClaim,
  revokeClaimLink,
  runWeeklyEmployerReports,
  saveFoundingSettings,
  setFoundingEmployer,
} from '../services/acquisitionService';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';
import { recordAdminAction } from '../utils/adminAudit';

const respond = (res: Response, error: unknown) => {
  if (error instanceof BillingError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  return res.status(500).json({ success: false, message: getErrorMessage(error) });
};

const adminOf = async (req: AuthRequest) => {
  const admin = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true } });
  return { id: req.user!.id, email: admin?.email ?? 'unknown' };
};

// ------------------------------------------------------------------ admin: companies and claim links

export const adminListCompanies = async (_req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, companies: await listManagedCompanies() });
  } catch (error) {
    return respond(res, error);
  }
};

export const adminCreateCompany = async (req: AuthRequest, res: Response) => {
  try {
    return res.status(201).json({ success: true, company: await createManagedCompany(await adminOf(req), req.body) });
  } catch (error) {
    return respond(res, error);
  }
};

export const adminIssueClaimLink = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as { channel: 'EMAIL' | 'WHATSAPP' | 'LINK'; email?: string; phone?: string };
    return res.status(201).json({ success: true, link: await issueClaimLink(await adminOf(req), singleValue(req.params.id)!, body) });
  } catch (error) {
    return respond(res, error);
  }
};

export const adminRevokeClaimLink = async (req: AuthRequest, res: Response) => {
  try {
    await revokeClaimLink(await adminOf(req), singleValue(req.params.id)!);
    return res.json({ success: true });
  } catch (error) {
    return respond(res, error);
  }
};

// ------------------------------------------------------------------ admin: Founding Employers

export const adminGetFounding = async (_req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, founding: await listFoundingEmployers() });
  } catch (error) {
    return respond(res, error);
  }
};

export const adminSaveFoundingSettings = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, settings: await saveFoundingSettings(await adminOf(req), req.body) });
  } catch (error) {
    return respond(res, error);
  }
};

export const adminSetFounding = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, ...(await setFoundingEmployer(await adminOf(req), singleValue(req.params.id)!, (req.body as { founding: boolean }).founding)) });
  } catch (error) {
    return respond(res, error);
  }
};

// ------------------------------------------------------------------ admin: outreach tracker

type OutreachBody = Partial<{
  businessName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  sector: string | null;
  location: string | null;
  status: string;
  notes: string | null;
  followUpAt: string | null;
}>;

/** Empty text is stored as nothing, so a field can be cleared. */
const clean = (value: string | null | undefined) => (value === undefined ? undefined : value?.trim() ? value.trim() : null);

const outreachData = (body: OutreachBody) => {
  let followUpAt: Date | null | undefined;
  if (body.followUpAt === undefined) followUpAt = undefined;
  else if (!body.followUpAt) followUpAt = null;
  else {
    followUpAt = new Date(body.followUpAt);
    if (Number.isNaN(followUpAt.getTime())) throw new BillingError(400, 'BAD_DATE', 'That follow-up date is not a valid date.');
  }
  return {
    ...(body.businessName !== undefined ? { businessName: body.businessName.trim() } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    contactName: clean(body.contactName),
    contactPhone: clean(body.contactPhone),
    contactEmail: clean(body.contactEmail),
    sector: clean(body.sector),
    location: clean(body.location),
    notes: clean(body.notes),
    followUpAt,
  };
};

export const adminListOutreach = async (req: AuthRequest, res: Response) => {
  try {
    const status = singleValue(req.query.status as string | string[] | undefined);
    const search = (singleValue(req.query.q as string | string[] | undefined) || '').trim();
    const contacts = await prisma.outreachContact.findMany({
      where: {
        ...(status && status !== 'ALL' ? { status } : {}),
        ...(search ? { OR: [{ businessName: { contains: search } }, { contactName: { contains: search } }, { sector: { contains: search } }, { location: { contains: search } }] } : {}),
      },
      orderBy: [{ followUpAt: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
    const counts = await prisma.outreachContact.groupBy({ by: ['status'], _count: { _all: true } });
    return res.json({ success: true, contacts, counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])) });
  } catch (error) {
    return respond(res, error);
  }
};

export const adminCreateOutreach = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await adminOf(req);
    const contact = await prisma.outreachContact.create({
      data: { businessName: (req.body as { businessName: string }).businessName.trim(), ...outreachData(req.body), createdById: admin.id } as Parameters<typeof prisma.outreachContact.create>[0]['data'],
    });
    return res.status(201).json({ success: true, contact });
  } catch (error) {
    return respond(res, error);
  }
};

export const adminUpdateOutreach = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id)!;
    const existing = await prisma.outreachContact.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new BillingError(404, 'NOT_FOUND', 'No such contact.');
    const contact = await prisma.outreachContact.update({ where: { id }, data: outreachData(req.body) });
    return res.json({ success: true, contact });
  } catch (error) {
    return respond(res, error);
  }
};

export const adminDeleteOutreach = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id)!;
    const result = await prisma.outreachContact.deleteMany({ where: { id } });
    if (result.count === 0) throw new BillingError(404, 'NOT_FOUND', 'No such contact.');
    return res.json({ success: true });
  } catch (error) {
    return respond(res, error);
  }
};

/** Builds and sends last week's employer reports now (they also run by themselves; this is for checking them). */
export const adminRunWeeklyReports = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await adminOf(req);
    const result = await runWeeklyEmployerReports();
    await recordAdminAction(prisma, { admin, action: 'WEEKLY_REPORTS_RUN', targetType: 'System', targetId: 'weekly-reports', metadata: result });
    return res.json({ success: true, ...result });
  } catch (error) {
    return respond(res, error);
  }
};

// ------------------------------------------------------------------ the person opening a claim link (not signed in)

export const getClaim = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, ...(await previewClaim(singleValue(req.params.token)!)) });
  } catch (error) {
    return respond(res, error);
  }
};

export const postAcceptClaim = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    return res.json({ success: true, ...(await acceptClaim(singleValue(req.params.token)!, { email, password })) });
  } catch (error) {
    return respond(res, error);
  }
};

// ------------------------------------------------------------------ employers

export const getMyReferral = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, referral: await getReferralInfo(req.user!.id) });
  } catch (error) {
    return respond(res, error);
  }
};

export const postMyReferralCode = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, ...(await attachReferral(req.user!.id, (req.body as { code: string }).code)) });
  } catch (error) {
    return respond(res, error);
  }
};

export const getMyWeeklyReport = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, ...(await getEmployerWeeklyReport(req.user!.id)) });
  } catch (error) {
    return respond(res, error);
  }
};
