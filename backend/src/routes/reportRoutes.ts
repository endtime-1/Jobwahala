import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createReportSchema } from '../validation/reportSchemas';
import { createReport } from '../controllers/reportController';

const router = Router();

router.post('/', authMiddleware, validate(createReportSchema), createReport);

export default router;
