import { Router } from 'express';
import { validate } from '../middleware/validate';
import { createRateLimit } from '../middleware/security';
import { createInterestSignup } from '../controllers/interestController';
import { createInterestSignupSchema } from '../validation/interestSchemas';

const router = Router();

// Public form: keep it tight so it cannot be used to fill the table.
const interestRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 10, scope: 'interest' });

router.post('/', interestRateLimit, validate(createInterestSignupSchema), createInterestSignup);

export default router;
