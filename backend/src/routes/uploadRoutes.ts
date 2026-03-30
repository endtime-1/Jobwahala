import { Router } from 'express';
import { uploadEvidence } from '../controllers/uploadController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadEvidenceSchema } from '../validation/uploadSchemas';

const router = Router();

router.post('/evidence', authMiddleware, validate(uploadEvidenceSchema), uploadEvidence);

export default router;
