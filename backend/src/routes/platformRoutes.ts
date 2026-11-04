import { Router } from 'express';
import { getPlatformConfig, getPlatformStats } from '../controllers/platformController';

const router = Router();

// Public endpoint — no auth required
router.get('/stats', getPlatformStats);
router.get('/config', getPlatformConfig);

export default router;
