import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { listMyApplications } from '../controllers/applicationController';

const router = Router();

router.get('/mine', authMiddleware, roleMiddleware(['SEEKER']), listMyApplications);

export default router;
