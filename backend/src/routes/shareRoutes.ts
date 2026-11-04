import { Router } from 'express';
import { getFreelancerSharePage, getJobListSharePage, getJobSharePage, getSitemap } from '../controllers/shareController';

const router = Router();

router.get('/sitemap.xml', getSitemap);
router.get('/freelancers/:id', getFreelancerSharePage);
router.get('/jobs/:id', getJobSharePage);
router.get('/pages/home', getJobListSharePage);
router.get('/pages/jobs', getJobListSharePage);
router.get('/pages/jobs-in/:country', getJobListSharePage);

export default router;
