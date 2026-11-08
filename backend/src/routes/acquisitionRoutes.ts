import { Router } from 'express';
import { actAsCompany } from '../middleware/company';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { createRateLimit } from '../middleware/security';
import { validate } from '../middleware/validate';
import { acceptClaimSchema, claimTokenSchema, referralCodeSchema } from '../validation/acquisitionSchemas';
import { getClaim, getMyReferral, getMyWeeklyReport, postAcceptClaim, postMyReferralCode } from '../controllers/acquisitionController';

/** Public: the page a company owner opens from a claim link. */
export const claimRouter = Router();
const claimLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 30, scope: 'company-claim' });
claimRouter.get('/:token', claimLimit, validate(claimTokenSchema), getClaim);
claimRouter.post('/:token/accept', claimLimit, validate(acceptClaimSchema), postAcceptClaim);

/** Employers: their referral link and last week's report. */
export const growthRouter = Router();
growthRouter.use(authMiddleware, roleMiddleware(['EMPLOYER']));
// The referral belongs to the signed-in owner; the weekly report is shared with the team.
growthRouter.get('/referral', getMyReferral);
growthRouter.post('/referral', validate(referralCodeSchema), postMyReferralCode);
growthRouter.get('/weekly-report', actAsCompany, getMyWeeklyReport);
