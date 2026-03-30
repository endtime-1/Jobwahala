import { Router } from 'express';
import { 
  compareMarketplaceFreelancers,
  createService, 
  generateServiceDraft,
  getFreelancerComparison,
  getServiceRequestCoaching,
  getRecommendedServices,
  getServices, 
  updateService, 
  deleteService, 
  getFreelancerDetails,
  createServiceRequest,
  getReceivedServiceRequests,
  getSentServiceRequests,
  updateServiceRequestStatus,
  deleteSentServiceRequest,
  updateOwnedServiceStatus
} from '../controllers/serviceController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  compareMarketplaceServicesSchema,
  createServiceRequestSchema,
  createServiceSchema,
  generateServiceDraftSchema,
  serviceIdParamSchema,
  updateOwnedServiceStatusSchema,
  updateServiceRequestStatusSchema,
  updateServiceSchema,
} from '../validation/serviceSchemas';

const router = Router();

// Public Routes
router.get('/', getServices);
router.get('/freelancer/:id', getFreelancerDetails);
router.get('/freelancer/:id/comparison', authMiddleware, roleMiddleware(['SEEKER', 'EMPLOYER']), validate(serviceIdParamSchema), getFreelancerComparison);

// Authenticated Service Request Routes
router.get('/recommendations', authMiddleware, roleMiddleware(['SEEKER', 'EMPLOYER']), getRecommendedServices);
router.post('/compare', authMiddleware, roleMiddleware(['SEEKER', 'EMPLOYER']), validate(compareMarketplaceServicesSchema), compareMarketplaceFreelancers);
router.get('/requests/sent', authMiddleware, getSentServiceRequests);
router.get('/requests/received', authMiddleware, roleMiddleware(['FREELANCER']), getReceivedServiceRequests);
router.get('/:id/request-coaching', authMiddleware, validate(serviceIdParamSchema), getServiceRequestCoaching);
router.post('/draft', authMiddleware, roleMiddleware(['FREELANCER']), validate(generateServiceDraftSchema), generateServiceDraft);
router.post('/:id/requests', authMiddleware, validate(createServiceRequestSchema), createServiceRequest);
router.patch('/requests/:requestId/status', authMiddleware, roleMiddleware(['FREELANCER']), validate(updateServiceRequestStatusSchema), updateServiceRequestStatus);
router.delete('/requests/:requestId', authMiddleware, deleteSentServiceRequest);

// Protected Freelancer Routes
router.post('/', authMiddleware, roleMiddleware(['FREELANCER']), validate(createServiceSchema), createService);
router.patch('/:id/status', authMiddleware, roleMiddleware(['FREELANCER']), validate(updateOwnedServiceStatusSchema), updateOwnedServiceStatus);
router.put('/:id', authMiddleware, roleMiddleware(['FREELANCER']), validate(updateServiceSchema), updateService);
router.delete('/:id', authMiddleware, roleMiddleware(['FREELANCER']), deleteService);

export default router;
