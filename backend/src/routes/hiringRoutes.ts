import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { actAsCompany } from '../middleware/company';
import { createRateLimit } from '../middleware/security';
import { validate } from '../middleware/validate';
import * as c from '../controllers/hiringController';
import * as s from '../validation/hiringSchemas';

/** Employers (who make a request), job seekers (who are asked about a role) and the public page's price. */
export const hiringRouter = Router();

// Public: the "from GHS X" price and the guarantee length, so a visitor can read them before signing up.
hiringRouter.get('/info', c.getInfo);

const employer = [authMiddleware, roleMiddleware(['EMPLOYER'])];
const createLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 20, scope: 'hiring-create' });

// The owner makes a request; the whole team can follow it and answer about the candidates.
hiringRouter.post('/requests', ...employer, createLimit, validate(s.createRequestSchema), c.postRequest);
hiringRouter.get('/requests', ...employer, actAsCompany, c.getMyRequests);
hiringRouter.get('/requests/:id', ...employer, actAsCompany, validate(s.requestIdSchema), c.getMyRequest);
hiringRouter.post('/requests/:id/cancel', ...employer, validate(s.requestIdSchema), c.postCancel);
hiringRouter.post('/requests/:id/candidates/:candidateId/decision', ...employer, actAsCompany, validate(s.decisionSchema), c.postDecision);
hiringRouter.post('/requests/:id/replacement', ...employer, validate(s.replacementSchema), c.postReplacement);

// A job seeker answers a recruiter: yes (share my profile) or no.
const seeker = [authMiddleware, roleMiddleware(['SEEKER'])];
hiringRouter.get('/opportunities', ...seeker, c.getOpportunities);
hiringRouter.post('/opportunities/:candidateId/respond', ...seeker, validate(s.respondSchema), c.postOpportunityResponse);

/** Staff: recruiters (their own requests only) and admins (all of them). */
export const recruiterRouter = Router();
recruiterRouter.use(authMiddleware, roleMiddleware(['RECRUITER', 'ADMIN']));

recruiterRouter.get('/requests', c.getStaffRequests);
recruiterRouter.get('/requests/:id', validate(s.requestIdSchema), c.getStaffRequest);
recruiterRouter.get('/requests/:id/search', validate(s.requestIdSchema), c.getSearch);
recruiterRouter.post('/requests/:id/status', validate(s.statusSchema), c.postStatus);
recruiterRouter.post('/requests/:id/job', validate(s.createJobSchema), c.postJob);
recruiterRouter.post('/requests/:id/candidates', validate(s.addCandidateSchema), c.postCandidate);
recruiterRouter.post('/requests/:id/import-applicants', validate(s.requestIdSchema), c.postImportApplicants);
recruiterRouter.get('/requests/:id/candidates/:candidateId', validate(s.candidateParamsSchema), c.getCandidate);
recruiterRouter.post('/requests/:id/candidates/:candidateId/ask-consent', validate(s.candidateParamsSchema), c.postAskConsent);
recruiterRouter.patch('/requests/:id/candidates/:candidateId', validate(s.updateCandidateSchema), c.patchCandidate);
recruiterRouter.post('/requests/:id/candidates/:candidateId/drop', validate(s.dropSchema), c.postDrop);
recruiterRouter.post('/requests/:id/candidates/:candidateId/shortlist', validate(s.candidateParamsSchema), c.postShortlist);
recruiterRouter.post('/requests/:id/candidates/:candidateId/start-date', validate(s.hireStartSchema), c.postHireStart);
recruiterRouter.post('/requests/:id/send', validate(s.requestIdSchema), c.postSend);
recruiterRouter.post('/requests/:id/notes', validate(s.noteSchema), c.postNote);
