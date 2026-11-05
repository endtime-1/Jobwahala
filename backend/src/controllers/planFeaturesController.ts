import { Request, Response } from 'express';
import env from '../config/env';
import prisma from '../config/prisma';
import { AuthRequest, optionalUser } from '../middleware/auth';
import { BillingError } from '../services/billingErrors';
import { loadHiringReport } from '../services/hiringReports';
import { requireFeature } from '../services/planService';
import { getErrorMessage } from '../utils/errors';
import { publicJobWhere } from '../utils/jobLifecycle';
import { singleValue } from '../utils/request';
import { visitorHash } from '../utils/courses';

const respond = (res: Response, error: unknown) => {
  if (error instanceof BillingError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  return res.status(500).json({ success: false, message: getErrorMessage(error) });
};

// ---------------------------------------------------------------- hiring reports

/** Hiring reports: Business plans. The plan is checked here, on the server. */
export const getHiringReport = async (req: AuthRequest, res: Response) => {
  try {
    await requireFeature(req.user!.id, 'hiringReports');
    const months = Math.min(24, Math.max(1, Number(singleValue(req.query.months as string | string[] | undefined)) || 12));
    return res.json({ success: true, months, ...(await loadHiringReport(req.user!.id, months)) });
  } catch (error) {
    return respond(res, error);
  }
};

// -------------------------------------------------------------------- job views

/** Looking at a crawler or a link preview is not a person reading the job, so it is not counted. */
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|headless/i;

/** One view per visitor per day, never the employer looking at their own job. Feeds the views in hiring reports. */
export const trackJobView = async (req: Request, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const userAgent = req.get('user-agent') || '';
    if (!userAgent || BOT.test(userAgent)) return res.json({ success: true, counted: false });

    const job = await prisma.job.findFirst({ where: { id, ...publicJobWhere() }, select: { id: true, employerId: true } });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const viewer = await optionalUser(req);
    if (viewer?.id === job.employerId) return res.json({ success: true, counted: false });
    if (viewer?.role === 'EMPLOYER') {
      // A team member reading their own company's job is not a visitor either.
      const member = await prisma.teamMember.findFirst({ where: { userId: viewer.id, ownerId: job.employerId, status: 'ACTIVE' }, select: { id: true } });
      if (member) return res.json({ success: true, counted: false });
    }

    try {
      await prisma.jobView.create({ data: { jobId: job.id, visitorHash: visitorHash(env.jwtSecret, req.ip || '', userAgent, job.id, 'VIEW') } });
      return res.json({ success: true, counted: true });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return res.json({ success: true, counted: false });
      throw error;
    }
  } catch (error) {
    return respond(res, error);
  }
};
