import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { actAsCompany } from '../middleware/company';
import { getHiringReport, searchCvDatabase } from '../controllers/planFeaturesController';

const router = Router();

// Team members use these as the company, with the company's plan.
router.get('/hiring-reports', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, getHiringReport);
router.get('/cv-database', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, searchCvDatabase);

export default router;
