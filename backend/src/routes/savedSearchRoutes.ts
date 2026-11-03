import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  updateSavedSearch,
} from '../controllers/savedSearchController';
import {
  createSavedSearchSchema,
  savedSearchIdSchema,
  updateSavedSearchSchema,
} from '../validation/savedSearchSchemas';

const router = Router();

router.use(authMiddleware, roleMiddleware(['SEEKER']));

router.get('/', listSavedSearches);
router.post('/', validate(createSavedSearchSchema), createSavedSearch);
router.patch('/:id', validate(updateSavedSearchSchema), updateSavedSearch);
router.delete('/:id', validate(savedSearchIdSchema), deleteSavedSearch);

export default router;
