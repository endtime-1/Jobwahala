import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  compareProposals,
  counterProposal,
  createJobProposal,
  createServiceProposal,
  generateProposalDecisionSummary,
  generateJobProposalDraft,
  generateServiceProposalDraft,
  getMyProposals,
  getProposalById,
  updateProposalStatus,
} from '../controllers/proposalController';
import {
  compareProposalsSchema,
  counterProposalSchema,
  createJobProposalSchema,
  createServiceProposalSchema,
  generateJobProposalDraftSchema,
  generateServiceProposalDraftSchema,
  proposalDecisionBriefSchema,
  proposalIdParamSchema,
  updateProposalStatusSchema,
} from '../validation/proposalSchemas';

const router = Router();

router.use(authMiddleware);

router.get('/', getMyProposals);
router.post('/compare', validate(compareProposalsSchema), compareProposals);
router.post('/:id/decision-brief', validate(proposalDecisionBriefSchema), generateProposalDecisionSummary);
router.post('/job/:applicationId/draft', roleMiddleware(['EMPLOYER']), validate(generateJobProposalDraftSchema), generateJobProposalDraft);
router.post('/service/:requestId/draft', roleMiddleware(['FREELANCER']), validate(generateServiceProposalDraftSchema), generateServiceProposalDraft);
router.get('/:id', validate(proposalIdParamSchema), getProposalById);
router.post('/job/:applicationId', roleMiddleware(['EMPLOYER']), validate(createJobProposalSchema), createJobProposal);
router.post('/service/:requestId', roleMiddleware(['FREELANCER']), validate(createServiceProposalSchema), createServiceProposal);
router.post('/:id/counter', validate(counterProposalSchema), counterProposal);
router.patch('/:id/status', validate(updateProposalStatusSchema), updateProposalStatus);

export default router;
