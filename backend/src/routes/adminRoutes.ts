import { Router } from 'express';
import { 
  createAdminJob,
  getReports, 
  getAllUsers, 
  getAllJobs, 
  getAllServices, 
  getAgreementDisputes,
  updateReportStatus,
  updateReportsStatusBulk,
  updateUserStatus, 
  updateUsersStatusBulk,
  updateJobStatus, 
  updateJobsStatusBulk,
  updateAgreementDisputeStatus,
  updateServiceStatus,
  updateServicesStatusBulk, 
  deleteUser 
} from '../controllers/adminController';
import { getVerificationRequests, updateVerificationRequestStatus } from '../controllers/verificationController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  deleteAdminUserSchema,
  createAdminJobSchema,
  updateAgreementDisputeStatusSchema,
  updateAdminBulkJobStatusSchema,
  updateAdminBulkReportStatusSchema,
  updateAdminBulkServiceStatusSchema,
  updateAdminBulkUserStatusSchema,
  updateAdminJobStatusSchema,
  updateAdminReportStatusSchema,
  updateAdminServiceStatusSchema,
  updateAdminUserStatusSchema,
  updateVerificationRequestStatusSchema,
} from '../validation/adminSchemas';

const router = Router();

// Secure entire admin module
router.use(authMiddleware, roleMiddleware(['ADMIN']));

// Collections
router.get('/reports', getReports);
router.get('/users', getAllUsers);
router.get('/jobs', getAllJobs);
router.get('/services', getAllServices);
router.get('/verifications', getVerificationRequests);
router.get('/disputes', getAgreementDisputes);
router.post('/jobs', validate(createAdminJobSchema), createAdminJob);
router.patch('/reports/bulk-status', validate(updateAdminBulkReportStatusSchema), updateReportsStatusBulk);
router.patch('/users/bulk-status', validate(updateAdminBulkUserStatusSchema), updateUsersStatusBulk);
router.patch('/jobs/bulk-status', validate(updateAdminBulkJobStatusSchema), updateJobsStatusBulk);
router.patch('/services/bulk-status', validate(updateAdminBulkServiceStatusSchema), updateServicesStatusBulk);

// Moderation Actions
router.patch('/reports/:id/status', validate(updateAdminReportStatusSchema), updateReportStatus);
router.patch('/users/:id/status', validate(updateAdminUserStatusSchema), updateUserStatus);
router.patch('/jobs/:id/status', validate(updateAdminJobStatusSchema), updateJobStatus);
router.patch('/services/:id/status', validate(updateAdminServiceStatusSchema), updateServiceStatus);
router.patch('/verifications/:id/status', validate(updateVerificationRequestStatusSchema), updateVerificationRequestStatus);
router.patch('/disputes/:id/status', validate(updateAgreementDisputeStatusSchema), updateAgreementDisputeStatus);
router.delete('/users/:id', validate(deleteAdminUserSchema), deleteUser);

export default router;
