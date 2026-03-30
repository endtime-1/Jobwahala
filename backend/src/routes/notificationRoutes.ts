import { Router } from 'express';
import { getMyNotificationSummary, getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../controllers/notificationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/summary', getMyNotificationSummary);
router.get('/', getMyNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);

export default router;
