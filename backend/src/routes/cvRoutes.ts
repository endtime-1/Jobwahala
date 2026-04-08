import { Router } from 'express';
import { saveCVGeneration, getMyCVs, getCVById } from '../controllers/cvController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.post('/', saveCVGeneration);
router.get('/', getMyCVs);
router.get('/:id', getCVById);

export default router;
