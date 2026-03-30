import { Router } from 'express';
import { getProfile, updateProfile, getAllUsers, getDashboardData, getWorkspaceSignals, getDashboardWorkflowSummary, getDashboardOverview, getProfileOptimization } from '../controllers/userController';
import { createVerificationRequest, getMyVerification } from '../controllers/verificationController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate, validateWith } from '../middleware/validate';
import { getProfileUpdateSchema } from '../validation/profileSchemas';
import { createVerificationRequestSchema } from '../validation/verificationSchemas';

const router = Router();

router.get('/dashboard', authMiddleware, getDashboardData);
router.get('/overview', authMiddleware, getDashboardOverview);
router.get('/signals', authMiddleware, getWorkspaceSignals);
router.get('/workflow-summary', authMiddleware, getDashboardWorkflowSummary);
router.get('/profile-optimization', authMiddleware, roleMiddleware(['SEEKER']), getProfileOptimization);
router.get('/verification', authMiddleware, getMyVerification);
router.post('/verification', authMiddleware, validate(createVerificationRequestSchema), createVerificationRequest);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, validateWith((req) => getProfileUpdateSchema((req as any).user?.role)), updateProfile);
router.get('/', authMiddleware, roleMiddleware(['ADMIN']), getAllUsers);

export default router;
