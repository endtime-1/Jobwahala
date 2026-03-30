import { Router } from 'express';
import { streamRealtimeEvents } from '../controllers/realtimeController';
import { authStreamMiddleware } from '../middleware/auth';

const router = Router();

router.get('/stream', authStreamMiddleware, streamRealtimeEvents);

export default router;
