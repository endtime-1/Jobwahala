import { Router } from 'express';
import { serveProtectedUpload, signUploadUrl, uploadEvidence } from '../controllers/uploadController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { signUploadSchema, uploadEvidenceSchema } from '../validation/uploadSchemas';

const router = Router();

router.post('/evidence', authMiddleware, validate(uploadEvidenceSchema), uploadEvidence);
router.post('/sign', authMiddleware, validate(signUploadSchema), signUploadUrl);

// Private files are only served with a valid signed link (logos are public and served separately).
router.get('/:category/:file', serveProtectedUpload);

export default router;
