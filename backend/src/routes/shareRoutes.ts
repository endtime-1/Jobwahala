import { Router } from 'express';
import { getCourseHubSharePage, getCourseLandingSharePage, getCourseSharePage, getFreelancerSharePage, getJobListSharePage, getLandingJson, getLandingSharePage, getCompanySharePage,
  getJobSharePage, getSitemap, getSitemapIndex, getSitemapPart } from '../controllers/shareController';

import { appShellMiddleware } from '../utils/appShell';

const router = Router();

// Every page is merged into the app's own shell, so people and crawlers get the same full HTML.
router.use(appShellMiddleware());

router.get('/sitemap.xml', getSitemapIndex);
router.get('/sitemap-all.xml', getSitemap);
router.get('/sitemap/:part', getSitemapPart);
router.get('/freelancers/:id', getFreelancerSharePage);
router.get('/jobs/:id', getJobSharePage);
router.get('/companies/:id', getCompanySharePage);
router.get('/seo/:slug', getLandingSharePage);
router.get('/course-pages/hub', getCourseHubSharePage);
router.get('/course-pages/:kind/:slug', getCourseLandingSharePage);
router.get('/course/:slug', getCourseSharePage);
router.get('/seo-json/:slug', getLandingJson);
router.get('/pages/home', getJobListSharePage);
router.get('/pages/jobs', getJobListSharePage);
router.get('/pages/internships', getJobListSharePage);
router.get('/pages/jobs-in/:country', getJobListSharePage);

export default router;
