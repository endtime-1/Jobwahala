import { getAdminOverview, getSystemHealth } from '../controllers/adminOverviewController';
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
import {
  adminCreateCompany, adminCreateOutreach, adminDeleteOutreach, adminGetFounding, adminIssueClaimLink, adminListCompanies, adminListOutreach,
  adminRevokeClaimLink, adminRunWeeklyReports, adminSaveFoundingSettings, adminSetFounding, adminUpdateOutreach,
} from '../controllers/acquisitionController';
import { claimIdSchema, claimLinkSchema, createCompanySchema, createOutreachSchema, foundingSettingsSchema, foundingToggleSchema, outreachIdSchema, updateOutreachSchema } from '../validation/acquisitionSchemas';
import { getVerificationRequests, updateVerificationRequestStatus } from '../controllers/verificationController';
import { getAdminAuditLog } from '../controllers/adminAuditController';
import { getCourseQueue, reviewCourse, reviewProvider, setFeatured } from '../controllers/adminCourseController';
import { courseReviewSchema, featuredSchema, providerReviewSchema } from '../validation/courseSchemas';
import { adjustUserCredits, createProduct, getBillingSettings, getRevenue, listPayments, listProducts, lookupAccount, refund, updateBillingSettings, updateProduct } from '../controllers/adminBillingController';
import { creditAdjustmentSchema, createProductSchema, refundSchema, settingsSchema, updateProductSchema } from '../validation/billingSchemas';
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
router.get('/overview', getAdminOverview);
router.get('/health', getSystemHealth);
router.get('/reports', getReports);
router.get('/users', getAllUsers);
router.get('/jobs', getAllJobs);
router.get('/services', getAllServices);
router.get('/verifications', getVerificationRequests);
router.get('/audit-log', getAdminAuditLog);
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

// Employer acquisition: companies set up for employers, claim links, Founding Employers, outreach
router.get('/acquisition/companies', adminListCompanies);
router.post('/acquisition/companies', validate(createCompanySchema), adminCreateCompany);
router.post('/acquisition/companies/:id/claim-link', validate(claimLinkSchema), adminIssueClaimLink);
router.post('/acquisition/claims/:id/revoke', validate(claimIdSchema), adminRevokeClaimLink);
router.get('/acquisition/founding', adminGetFounding);
router.put('/acquisition/founding/settings', validate(foundingSettingsSchema), adminSaveFoundingSettings);
router.post('/acquisition/companies/:id/founding', validate(foundingToggleSchema), adminSetFounding);
router.get('/acquisition/outreach', adminListOutreach);
router.post('/acquisition/outreach', validate(createOutreachSchema), adminCreateOutreach);
router.patch('/acquisition/outreach/:id', validate(updateOutreachSchema), adminUpdateOutreach);
router.delete('/acquisition/outreach/:id', validate(outreachIdSchema), adminDeleteOutreach);
router.post('/acquisition/weekly-reports/run', adminRunWeeklyReports);

router.get('/courses/queue', getCourseQueue);
router.post('/providers/:userId/review', validate(providerReviewSchema), reviewProvider);
router.post('/courses/:id/review', validate(courseReviewSchema), reviewCourse);
router.post('/courses/:id/featured', validate(featuredSchema), setFeatured);

router.get('/billing/products', listProducts);
router.post('/billing/products', validate(createProductSchema), createProduct);
router.put('/billing/products/:id', validate(updateProductSchema), updateProduct);
router.get('/billing/settings', getBillingSettings);
router.put('/billing/settings', validate(settingsSchema), updateBillingSettings);
router.get('/billing/revenue', getRevenue);
router.get('/billing/payments', listPayments);
router.post('/billing/payments/:id/refund', validate(refundSchema), refund);
router.get('/billing/account', lookupAccount);
router.post('/billing/credits', validate(creditAdjustmentSchema), adjustUserCredits);

export default router;
