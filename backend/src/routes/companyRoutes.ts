import { Router } from 'express';
import { getCompany, listHiringCompanies } from '../controllers/companyController';
import { maskPublicEmails } from '../middleware/privacy';

const router = Router();

router.get('/', maskPublicEmails, listHiringCompanies);
router.get('/:id', maskPublicEmails, getCompany);

export default router;
