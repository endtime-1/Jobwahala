import { Router } from 'express';
import { getConversations, getConversationSidebar, getMessageSummary, sendMessage, getMessages, getMessageDelta, markAsRead } from '../controllers/messageController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendMessageSchema } from '../validation/messageSchemas';

const router = Router();

router.use(authMiddleware);

// Collections
router.get('/summary', getMessageSummary);
router.get('/sidebar', getConversationSidebar);
router.get('/', getConversations);
router.post('/', validate(sendMessageSchema), sendMessage);

// Singular Threads
router.get('/:id/delta', getMessageDelta);
router.get('/:id', getMessages);
router.patch('/:id/read', markAsRead);

export default router;
