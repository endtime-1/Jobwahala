import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addLearnerCourse, listLearnerCourses, removeLearnerCourse, requestConfirmation } from '../controllers/learnerCourseController';
import { courseIdSchema, learnerCourseSchema } from '../validation/courseSchemas';

const router = Router();

router.use(authMiddleware, roleMiddleware(['SEEKER']));

router.get('/', listLearnerCourses);
router.post('/', validate(learnerCourseSchema), addLearnerCourse);
router.delete('/:id', validate(courseIdSchema), removeLearnerCourse);
router.post('/:id/request-confirmation', validate(courseIdSchema), requestConfirmation);

export default router;
