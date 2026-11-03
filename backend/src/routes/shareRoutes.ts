import { Router } from 'express';
import { getFreelancerSharePage } from '../controllers/shareController';

const router = Router();

router.get('/freelancers/:id', getFreelancerSharePage);

export default router;
