import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { listSavedJobIds, listSavedJobs, saveJob, unsaveJob } from '../controllers/savedJobController';
import { savedJobParamsSchema } from '../validation/savedJobSchemas';

const router = Router();

router.use(authMiddleware, roleMiddleware(['SEEKER']));

router.get('/', listSavedJobs);
router.get('/ids', listSavedJobIds);
router.post('/:jobId', validate(savedJobParamsSchema), saveJob);
router.delete('/:jobId', validate(savedJobParamsSchema), unsaveJob);

export default router;
