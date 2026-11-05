import { Request, Router } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware, roleMiddleware } from '../middleware/auth';
import { actAsCompany } from '../middleware/company';
import { createRateLimit } from '../middleware/security';
import { validate } from '../middleware/validate';
import {
  blockEmployer,
  deleteSavedSearch,
  getCandidate,
  getMyActivity,
  getSavedSearches,
  inviteProfile,
  saveSearch,
  searchCvDatabase,
  unblockEmployer,
  unlockProfile,
  updateSavedSearch,
} from '../controllers/cvDatabaseController';
import { candidateFiltersSchema } from '../utils/cvDatabase';

const router = Router();
const id = z.string().min(1).max(80);

// Limits are per company (not per address), so a team cannot get round them and nobody can copy the database out slowly.
const byCompany = (req: Request) => (req as AuthRequest).user?.id ?? 'anonymous';
const searchLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 120, scope: 'cv-search', keyOf: byCompany });
const openLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 200, scope: 'cv-open', keyOf: byCompany });
const unlockLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 30, scope: 'cv-unlock', keyOf: byCompany });
const inviteLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 30, scope: 'cv-invite', keyOf: byCompany });

// ---- Job seekers: who looked, and who is blocked. (Declared first so "/me" is never read as a profile id.)
router.get('/me/activity', authMiddleware, roleMiddleware(['SEEKER']), getMyActivity);
router.post('/me/blocks', authMiddleware, roleMiddleware(['SEEKER']), validate(z.object({ body: z.object({ employerId: id }).strict() })), blockEmployer);
router.delete('/me/blocks/:employerId', authMiddleware, roleMiddleware(['SEEKER']), validate(z.object({ params: z.object({ employerId: id }) })), unblockEmployer);

// ---- Employers: team members work as the company, with its plan and its unlocks.
const employer = [authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany];

// There is deliberately no export: results are limited profiles, a few pages deep, and contact details come one unlock at a time.
router.get('/', ...employer, searchLimit, searchCvDatabase);
router.get('/saved', ...employer, getSavedSearches);
router.post(
  '/saved',
  ...employer,
  validate(z.object({ body: z.object({ name: z.string().trim().min(1).max(80), filters: z.record(z.string(), z.unknown()).default({}), alertsEnabled: z.boolean().default(true) }).strict() })),
  saveSearch,
);
router.patch('/saved/:id', ...employer, validate(z.object({ params: z.object({ id }), body: z.object({ alertsEnabled: z.boolean() }).strict() })), updateSavedSearch);
router.delete('/saved/:id', ...employer, validate(z.object({ params: z.object({ id }) })), deleteSavedSearch);
router.get('/profiles/:id', ...employer, openLimit, validate(z.object({ params: z.object({ id }) })), getCandidate);
router.post('/profiles/:id/unlock', ...employer, unlockLimit, validate(z.object({ params: z.object({ id }) })), unlockProfile);
router.post('/profiles/:id/invite', ...employer, inviteLimit, validate(z.object({ params: z.object({ id }), body: z.object({ jobId: id, message: z.string().trim().max(400).optional() }).strict() })), inviteProfile);

// Keep the filter schema referenced here so the query keys are documented next to the routes.
export const cvSearchFilterKeys = Object.keys(candidateFiltersSchema.shape);

export default router;
