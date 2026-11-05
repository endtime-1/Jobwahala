import { Router } from 'express';
import { requireCaptcha } from '../middleware/captcha';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createReportSchema } from '../validation/reportSchemas';
import { createReport } from '../controllers/reportController';

const router = Router();

router.post('/', authMiddleware, requireCaptcha(), validate(createReportSchema), createReport);

export default router;
