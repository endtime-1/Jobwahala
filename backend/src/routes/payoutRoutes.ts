import { Router } from 'express';
import * as payoutController from '../controllers/payoutController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * Get the list of supported banks in Ghana.
 */
router.get('/banks', authMiddleware as any, payoutController.getBanks as any);

/**
 * Save user payout account details (Bank/Mobile Money).
 */
router.post('/account', authMiddleware as any, payoutController.savePayoutAccount as any);

/**
 * Get the current user's payout account.
 */
router.get('/account', authMiddleware as any, payoutController.getMyPayoutAccount as any);

export default router;
