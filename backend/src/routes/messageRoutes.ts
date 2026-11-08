import { Router } from 'express';
import { getConversations, getConversationSidebar, getMessageSummary, sendMessage, getMessages, getMessageDelta, markAsRead, sendTyping } from '../controllers/messageController';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { createRateLimit } from '../middleware/security';
import { validate } from '../middleware/validate';
import { sendMessageSchema } from '../validation/messageSchemas';

const router = Router();

// Typing pings are cheap but frequent: a few every ten seconds per person is plenty.
const typingLimit = createRateLimit({ windowMs: 10_000, max: 6, scope: 'message-typing', keyOf: (req) => (req as AuthRequest).user?.id ?? 'anonymous' });

router.use(authMiddleware);

// Collections
router.get('/summary', getMessageSummary);
router.get('/sidebar', getConversationSidebar);
router.get('/', getConversations);
router.post('/', validate(sendMessageSchema), sendMessage);

// Singular Threads
router.post('/:id/typing', typingLimit, sendTyping);
router.get('/:id/delta', getMessageDelta);
router.get('/:id', getMessages);
router.patch('/:id/read', markAsRead);

export default router;
