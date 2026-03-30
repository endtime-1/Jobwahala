import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  compareAgreements,
  createAgreementDispute,
  createAgreementMilestonePaymentSession,
  createAgreementMilestone,
  createAgreementReview,
  generateAgreementDecisionSummary,
  getMyAgreements,
  verifyAgreementPayment,
  updateAgreementPaymentStatus,
  updateAgreementMilestonePaymentStatus,
  updateAgreementMilestoneStatus,
  updateAgreementStatus,
} from '../controllers/agreementController';
import {
  agreementDecisionBriefSchema,
  compareAgreementsSchema,
  createAgreementDisputeSchema,
  createAgreementMilestonePaymentSessionSchema,
  createAgreementMilestoneSchema,
  createAgreementReviewSchema,
  updateAgreementPaymentStatusSchema,
  updateAgreementMilestonePaymentStatusSchema,
  updateAgreementMilestoneStatusSchema,
  updateAgreementStatusSchema,
  verifyAgreementPaymentSchema,
} from '../validation/agreementSchemas';

const router = Router();

router.use(authMiddleware);

router.get('/', getMyAgreements);
router.post('/compare', validate(compareAgreementsSchema), compareAgreements);
router.post('/:id/decision-brief', validate(agreementDecisionBriefSchema), generateAgreementDecisionSummary);
router.post('/:id/milestones', validate(createAgreementMilestoneSchema), createAgreementMilestone);
router.post('/:id/reviews', validate(createAgreementReviewSchema), createAgreementReview);
router.post('/:id/disputes', validate(createAgreementDisputeSchema), createAgreementDispute);
router.patch(
  '/:id/milestones/:milestoneId/status',
  validate(updateAgreementMilestoneStatusSchema),
  updateAgreementMilestoneStatus,
);
router.patch(
  '/:id/milestones/:milestoneId/payment',
  validate(updateAgreementMilestonePaymentStatusSchema),
  updateAgreementMilestonePaymentStatus,
);
router.post(
  '/:id/milestones/:milestoneId/payments',
  validate(createAgreementMilestonePaymentSessionSchema),
  createAgreementMilestonePaymentSession,
);
router.patch(
  '/:id/payments/:paymentId/status',
  validate(updateAgreementPaymentStatusSchema),
  updateAgreementPaymentStatus,
);
router.post(
  '/:id/payments/:paymentId/verify',
  validate(verifyAgreementPaymentSchema),
  verifyAgreementPayment,
);
router.patch('/:id/status', validate(updateAgreementStatusSchema), updateAgreementStatus);

export default router;
