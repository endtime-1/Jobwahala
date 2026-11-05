import { Router } from 'express';
import { getProfile, updateProfile, getAllUsers, getDashboardData, getWorkspaceSignals, getDashboardWorkflowSummary, getDashboardOverview, getProfileOptimization } from '../controllers/userController';
import { createVerificationRequest, getMyVerification, requestContactCode, submitContactCode } from '../controllers/verificationController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate, validateWith } from '../middleware/validate';
import { getProfileUpdateSchema } from '../validation/profileSchemas';
import {
  confirmVerificationCodeSchema,
  createBusinessVerificationRequestSchema,
  createVerificationRequestSchema,
  verificationCodeParamsSchema,
} from '../validation/verificationSchemas';
import { createRateLimit } from '../middleware/security';

const router = Router();

router.get('/dashboard', authMiddleware, getDashboardData);
router.get('/overview', authMiddleware, getDashboardOverview);
router.get('/signals', authMiddleware, getWorkspaceSignals);
router.get('/workflow-summary', authMiddleware, getDashboardWorkflowSummary);
router.get('/profile-optimization', authMiddleware, roleMiddleware(['SEEKER']), getProfileOptimization);
router.get('/verification', authMiddleware, getMyVerification);
// Companies send the full set of business details; other roles send the short form.
router.post(
  '/verification',
  authMiddleware,
  validateWith((req) =>
    (req as any).user?.role === 'EMPLOYER' ? createBusinessVerificationRequestSchema : createVerificationRequestSchema,
  ),
  createVerificationRequest,
);

// One-time codes: tight limits on top of the per-request limits in the service.
const otpRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 30, scope: 'otp' });
router.post('/verification/:id/code', authMiddleware, roleMiddleware(['EMPLOYER']), otpRateLimit, validate(verificationCodeParamsSchema), requestContactCode);
router.post('/verification/:id/confirm', authMiddleware, roleMiddleware(['EMPLOYER']), otpRateLimit, validate(confirmVerificationCodeSchema), submitContactCode);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, validateWith((req) => getProfileUpdateSchema((req as any).user?.role)), updateProfile);
router.get('/', authMiddleware, roleMiddleware(['ADMIN']), getAllUsers);

export default router;
