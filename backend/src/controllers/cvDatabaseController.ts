import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { BillingError } from '../services/billingErrors';
import {
  blockCompany,
  createSavedSearch,
  getMyCvActivity,
  inviteCandidate,
  listSavedSearches,
  searchCandidates,
  unblockCompany,
  unlockCandidate,
  viewCandidate,
} from '../services/cvDatabaseService';
import { candidateFiltersSchema, cleanFilters } from '../utils/cvDatabase';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';

const respond = (res: Response, error: unknown) => {
  if (error instanceof BillingError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  return res.status(500).json({ success: false, message: getErrorMessage(error) });
};

type Acting = AuthRequest & { actorId?: string };

// ------------------------------------------------------------------ employers (a team member acts as the company)

export const searchCvDatabase = async (req: AuthRequest, res: Response) => {
  try {
    const { page, ...rest } = req.query as Record<string, string | string[] | undefined>;
    const filters = cleanFilters(Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, singleValue(value)])));
    const result = await searchCandidates(req.user!.id, filters, Number(singleValue(page)) || 1);
    return res.json({ success: true, ...result });
  } catch (error) {
    return respond(res, error);
  }
};

export const getCandidate = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, ...(await viewCandidate(req.user!.id, req.params.id as string)) });
  } catch (error) {
    return respond(res, error);
  }
};

export const unlockProfile = async (req: Acting, res: Response) => {
  try {
    const result = await unlockCandidate(req.user!.id, req.actorId, req.params.id as string);
    return res.status(result.alreadyUnlocked ? 200 : 201).json({ success: true, ...result });
  } catch (error) {
    return respond(res, error);
  }
};

export const inviteProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId, message } = req.body as { jobId: string; message?: string };
    return res.status(201).json({ success: true, ...(await inviteCandidate(req.user!.id, req.params.id as string, jobId, message)) });
  } catch (error) {
    return respond(res, error);
  }
};

export const getSavedSearches = async (req: AuthRequest, res: Response) => {
  try {
    const rows = await listSavedSearches(req.user!.id);
    return res.json({
      success: true,
      searches: rows.map(({ filtersJson, ...row }) => ({ ...row, filters: safeFilters(filtersJson) })),
    });
  } catch (error) {
    return respond(res, error);
  }
};

const safeFilters = (json: string) => {
  try {
    return candidateFiltersSchema.parse(JSON.parse(json));
  } catch {
    return {};
  }
};

export const saveSearch = async (req: AuthRequest, res: Response) => {
  try {
    const { name, filters, alertsEnabled } = req.body as { name: string; filters: Record<string, unknown>; alertsEnabled: boolean };
    const saved = await createSavedSearch(req.user!.id, { name, filters, alertsEnabled });
    return res.status(201).json({ success: true, search: { id: saved.id, name: saved.name, alertsEnabled: saved.alertsEnabled, filters: safeFilters(saved.filtersJson) } });
  } catch (error) {
    return respond(res, error);
  }
};

export const updateSavedSearch = async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.savedCandidateSearch.updateMany({ where: { id: req.params.id as string, employerId: req.user!.id }, data: { alertsEnabled: (req.body as { alertsEnabled: boolean }).alertsEnabled } });
    if (result.count === 0) return res.status(404).json({ success: false, message: 'Saved search not found' });
    return res.json({ success: true });
  } catch (error) {
    return respond(res, error);
  }
};

export const deleteSavedSearch = async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.savedCandidateSearch.deleteMany({ where: { id: req.params.id as string, employerId: req.user!.id } });
    if (result.count === 0) return res.status(404).json({ success: false, message: 'Saved search not found' });
    return res.json({ success: true });
  } catch (error) {
    return respond(res, error);
  }
};

// ------------------------------------------------------------------ job seekers

export const getMyActivity = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, ...(await getMyCvActivity(req.user!.id)) });
  } catch (error) {
    return respond(res, error);
  }
};

export const blockEmployer = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, ...(await blockCompany(req.user!.id, (req.body as { employerId: string }).employerId)) });
  } catch (error) {
    return respond(res, error);
  }
};

export const unblockEmployer = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, ...(await unblockCompany(req.user!.id, req.params.employerId as string)) });
  } catch (error) {
    return respond(res, error);
  }
};
