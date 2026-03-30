import { Router } from 'express';
import { handlePaystackWebhook } from '../controllers/paymentController';

const router = Router();

router.post('/webhooks/paystack', handlePaystackWebhook);

export default router;
