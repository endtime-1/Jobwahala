import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { createRateLimit } from '../middleware/security';
import { validate } from '../middleware/validate';
import {
  cancelMySubscription,
  downloadReceipt,
  getCatalogue,
  getMyBilling,
  getPaymentStatus,
  handlePaystackBillingWebhook,
  promoteJob,
  startCheckout,
} from '../controllers/billingController';
import { checkoutSchema, idSchema, promoteSchema, referenceSchema } from '../validation/billingSchemas';

const router = Router();

// Paystack calls this itself, with no login. It is trusted only after its signature is checked on the raw body.
router.post('/webhooks/paystack', handlePaystackBillingWebhook);

// Everything else is for signed-in employers (training providers are employer accounts).
router.use(authMiddleware, roleMiddleware(['EMPLOYER']));

const checkoutLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 20, scope: 'billing-checkout' });
const statusLimit = createRateLimit({ windowMs: 60 * 1000, max: 30, scope: 'billing-status' });

router.get('/catalogue', getCatalogue);
router.get('/me', getMyBilling);
router.post('/checkout', checkoutLimit, validate(checkoutSchema), startCheckout);
router.get('/payments/:reference/status', statusLimit, validate(referenceSchema), getPaymentStatus);
router.get('/payments/:id/receipt', validate(idSchema), downloadReceipt);
router.post('/jobs/:id/promote', validate(promoteSchema), promoteJob);
router.post('/subscriptions/:id/cancel', validate(idSchema), cancelMySubscription);

export default router;
