import { Router } from 'express';
import { initiateIdentityVerification, getMyVerification } from '../controllers/verificationController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// User-facing identity verification (Ghana Card)
router.post('/identity', initiateIdentityVerification);

// Get current user's verification status
router.get('/my', getMyVerification);

export default router;
