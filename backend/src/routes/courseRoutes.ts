import { Router } from 'express';
import { validate } from '../middleware/validate';
import { createRateLimit } from '../middleware/security';
import { requireCaptcha } from '../middleware/captcha';
import { coursesForJob, createEnquiry, getCourse, getCourseLanding, getProviderPage, listCourses, trackCourseEvent } from '../controllers/courseController';
import { courseEventSchema, enquirySchema } from '../validation/courseSchemas';

const router = Router();

// Views and clicks are cheap but billable: a modest limit keeps one visitor from filling the log.
const eventLimit = createRateLimit({ windowMs: 60 * 1000, max: 60, scope: 'course-events' });
const enquiryLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 10, scope: 'course-enquiries' });

router.get('/', listCourses);
router.get('/landing/:kind/:slug', getCourseLanding);
router.get('/for-job/:jobId', coursesForJob);
router.get('/providers/:id', getProviderPage);
router.post('/:id/events', eventLimit, validate(courseEventSchema), trackCourseEvent);
router.post('/:id/enquiries', enquiryLimit, requireCaptcha(), validate(enquirySchema), createEnquiry);
router.get('/:slug', getCourse);

export default router;
