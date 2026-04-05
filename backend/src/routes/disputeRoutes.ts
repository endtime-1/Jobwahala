import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { openDispute, getDisputeDetails, addDisputeMessage, resolveDispute } from '../controllers/disputeController';

const router = Router();

// Secure all dispute routes
router.use(authMiddleware);

// Open a dispute on an agreement
router.post('/agreement/:id', openDispute);

// Get specific dispute details
router.get('/:disputeId', getDisputeDetails);

// Post a message/evidence in a dispute
router.post('/:disputeId/messages', addDisputeMessage);

// Resolve a dispute (Admin only)
router.post('/:disputeId/resolve', resolveDispute);

export default router;
