import { Router } from 'express';
import { getFreelancerSharePage, getSitemap } from '../controllers/shareController';

const router = Router();

router.get('/sitemap.xml', getSitemap);
router.get('/freelancers/:id', getFreelancerSharePage);

export default router;
