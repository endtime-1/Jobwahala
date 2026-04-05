import { Router } from 'express';
import { handlePaystackWebhook, initializeMilestonePayment } from '../controllers/paymentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * Initialize a milestone payment via Paystack.
 */
router.post('/milestones/initialize', authMiddleware as any, initializeMilestonePayment as any);

/**
 * Handle Paystack Webhooks.
 */
router.post('/webhooks/paystack', handlePaystackWebhook);

export default router;
