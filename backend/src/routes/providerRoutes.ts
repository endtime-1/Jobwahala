import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCourse,
  decideCompletion,
  enableProvider,
  getProviderStatus,
  listCompletionRequests,
  listEnquiries,
  listMyCourses,
  markEnquiryRead,
  pauseCourse,
  removeCourse,
  resumeCourse,
  updateCourse,
} from '../controllers/providerController';
import { courseIdSchema, createCourseSchema, decisionSchema, updateCourseSchema } from '../validation/courseSchemas';

const router = Router();

// Training providers are employer accounts that opted in.
router.use(authMiddleware, roleMiddleware(['EMPLOYER']));

router.get('/me', getProviderStatus);
router.post('/enable', enableProvider);
router.get('/courses', listMyCourses);
router.post('/courses', validate(createCourseSchema), createCourse);
router.put('/courses/:id', validate(updateCourseSchema), updateCourse);
router.post('/courses/:id/pause', validate(courseIdSchema), pauseCourse);
router.post('/courses/:id/resume', validate(courseIdSchema), resumeCourse);
router.delete('/courses/:id', validate(courseIdSchema), removeCourse);
router.get('/enquiries', listEnquiries);
router.post('/enquiries/:id/read', validate(courseIdSchema), markEnquiryRead);
router.get('/completions', listCompletionRequests);
router.post('/completions/:id', validate(decisionSchema), decideCompletion);

export default router;
