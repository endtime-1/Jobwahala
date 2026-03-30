import { Router } from 'express';
import { getPlatformStats } from '../controllers/platformController';

const router = Router();

// Public endpoint — no auth required
router.get('/stats', getPlatformStats);

export default router;
