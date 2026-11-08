import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { BillingError } from '../services/billingErrors';
import * as hiring from '../services/hiringService';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';

const respond = (res: Response, error: unknown) => {
  if (error instanceof BillingError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  return res.status(500).json({ success: false, message: getErrorMessage(error) });
};

const actorOf = async (req: AuthRequest): Promise<hiring.Actor> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true } });
  return { id: req.user!.id, role: req.user!.role, email: user?.email ?? null };
};

const param = (req: AuthRequest, name: string) => singleValue(req.params[name]) as string;
const query = (req: AuthRequest, name: string) => singleValue(req.query[name] as string | string[] | undefined);

/** Wraps a handler so every one of them answers errors the same way. */
const handle = (action: (req: AuthRequest, res: Response) => Promise<unknown>) => async (req: AuthRequest, res: Response) => {
  try {
    await action(req, res);
  } catch (error) {
    respond(res, error);
  }
};

const ok = (res: Response, extra: Record<string, unknown> = {}) => res.json({ success: true, ...extra });

// ------------------------------------------------------------------ public and employer

export const getInfo = handle(async (_req, res) => ok(res, { info: await hiring.getHiringInfo() }));

export const postRequest = handle(async (req, res) => res.status(201).json({ success: true, request: await hiring.createRequest(req.user!.id, req.body) }));
export const getMyRequests = handle(async (req, res) => ok(res, { requests: await hiring.listClientRequests(req.user!.id) }));
export const getMyRequest = handle(async (req, res) => ok(res, await hiring.getClientRequest(req.user!.id, param(req, 'id'))));
export const postCancel = handle(async (req, res) => {
  await hiring.cancelByClient(req.user!.id, param(req, 'id'));
  ok(res);
});
export const postDecision = handle(async (req, res) => ok(res, await hiring.decideOnCandidate(req.user!.id, param(req, 'id'), param(req, 'candidateId'), req.body)));
export const postReplacement = handle(async (req, res) => {
  await hiring.requestReplacement(req.user!.id, param(req, 'id'), (req.body as { reason: string }).reason);
  ok(res);
});

// ------------------------------------------------------------------ the candidate

export const getOpportunities = handle(async (req, res) => ok(res, { opportunities: await hiring.listOpportunities(req.user!.id) }));
export const postOpportunityResponse = handle(async (req, res) => {
  await hiring.respondToOpportunity(req.user!.id, param(req, 'candidateId'), req.body);
  ok(res);
});

// ------------------------------------------------------------------ staff

export const getStaffRequests = handle(async (req, res) =>
  ok(res, { requests: await hiring.listStaffRequests(await actorOf(req), { status: query(req, 'status'), recruiterId: query(req, 'recruiterId'), from: query(req, 'from'), to: query(req, 'to') }) }),
);
export const getStaffRequest = handle(async (req, res) => ok(res, await hiring.getStaffRequest(await actorOf(req), param(req, 'id'))));
export const getCandidate = handle(async (req, res) => ok(res, { candidate: await hiring.openCandidate(await actorOf(req), param(req, 'id'), param(req, 'candidateId')) }));

export const getSearch = handle(async (req, res) => {
  const { page, ...filters } = req.query as Record<string, string>;
  ok(res, await hiring.searchForRequest(await actorOf(req), param(req, 'id'), filters, Number(page) || 1));
});

export const postCandidate = handle(async (req, res) => res.status(201).json({ success: true, candidate: await hiring.addCandidate(await actorOf(req), param(req, 'id'), req.body) }));
export const postImportApplicants = handle(async (req, res) => ok(res, await hiring.importApplicants(await actorOf(req), param(req, 'id'))));
export const postAskConsent = handle(async (req, res) => {
  await hiring.askConsent(await actorOf(req), param(req, 'id'), param(req, 'candidateId'));
  ok(res);
});
export const patchCandidate = handle(async (req, res) => ok(res, { candidate: await hiring.updateCandidate(await actorOf(req), param(req, 'id'), param(req, 'candidateId'), req.body) }));
export const postDrop = handle(async (req, res) => {
  await hiring.dropCandidate(await actorOf(req), param(req, 'id'), param(req, 'candidateId'), (req.body as { reason: string }).reason);
  ok(res);
});
export const postShortlist = handle(async (req, res) => {
  await hiring.shortlistCandidate(await actorOf(req), param(req, 'id'), param(req, 'candidateId'));
  ok(res);
});
export const postSend = handle(async (req, res) => ok(res, await hiring.sendShortlist(await actorOf(req), param(req, 'id'))));
export const postNote = handle(async (req, res) => {
  await hiring.addNote(await actorOf(req), param(req, 'id'), req.body);
  res.status(201).json({ success: true });
});
export const postStatus = handle(async (req, res) => {
  const body = req.body as { status: string; reason?: string | null };
  await hiring.setStatus(await actorOf(req), param(req, 'id'), body.status, body.reason);
  ok(res);
});
export const postJob = handle(async (req, res) => res.status(201).json({ success: true, ...(await hiring.createJobFromRequest(await actorOf(req), param(req, 'id'), req.body)) }));
export const postHireStart = handle(async (req, res) => {
  await hiring.setHireStartDate(await actorOf(req), param(req, 'id'), param(req, 'candidateId'), (req.body as { startDate: string }).startDate);
  ok(res);
});

// ------------------------------------------------------------------ admin

export const postAssign = handle(async (req, res) => {
  await hiring.assignRecruiter(await actorOf(req), param(req, 'id'), (req.body as { recruiterId: string }).recruiterId);
  ok(res);
});
export const putTerms = handle(async (req, res) => {
  await hiring.updateTerms(await actorOf(req), param(req, 'id'), req.body);
  ok(res);
});
export const postPayment = handle(async (req, res) => res.status(201).json({ success: true, payment: await hiring.recordPayment(await actorOf(req), param(req, 'id'), req.body) }));
export const deletePayment = handle(async (req, res) => {
  await hiring.removePayment(await actorOf(req), param(req, 'id'), param(req, 'paymentId'), (req.body as { reason: string }).reason);
  ok(res);
});
export const putSettings = handle(async (req, res) => ok(res, { info: await hiring.saveHiringSettings(await actorOf(req), req.body) }));
export const getStaff = handle(async (_req, res) => ok(res, { staff: await hiring.listStaff(), info: await hiring.getHiringInfo() }));
export const postRecruiter = handle(async (req, res) => res.status(201).json({ success: true, ...(await hiring.createRecruiter(await actorOf(req), req.body)) }));
export const patchRecruiter = handle(async (req, res) => {
  await hiring.setRecruiterActive(await actorOf(req), param(req, 'userId'), (req.body as { active: boolean }).active);
  ok(res);
});
