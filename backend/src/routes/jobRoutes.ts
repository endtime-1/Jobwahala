import { Router } from 'express';
import { maskPublicEmails } from '../middleware/privacy';
import { compareJobsForSeeker, createJob, generateJobApplicantComparison, generateJobApplicantDecisionBrief, generateJobDraft, getJobs, getJobById, applyForJob, getJobApplicants, updateApplicationStatus, deleteApplication, updateOwnedJobStatus, getMyJobApplication, generateJobShortlistSummary, getJobApplicationCoaching, updateOwnedJob, duplicateOwnedJob, extendOwnedJob, reviewApplication, bulkRejectApplicants } from '../controllers/jobController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { actAsCompany } from '../middleware/company';
import { createRateLimit } from '../middleware/security';
import { trackJobView } from '../controllers/planFeaturesController';
import { validate } from '../middleware/validate';
import { strictAiRateLimit } from '../middleware/security';
import { applyForJobSchema, compareJobsSchema, createJobSchema, generateApplicantComparisonSchema, generateApplicantDecisionBriefSchema, generateJobDraftSchema, generateShortlistSummarySchema, jobIdParamSchema, updateApplicationStatusSchema, updateJobStatusSchema, updateJobSchema, extendJobSchema, applicationReviewSchema, bulkRejectSchema } from '../validation/jobSchemas';

const router = Router();

router.get('/', maskPublicEmails, getJobs);
router.get('/:id/my-application', authMiddleware, roleMiddleware(['SEEKER']), validate(jobIdParamSchema), getMyJobApplication);
router.get('/:id/application-coaching', authMiddleware, roleMiddleware(['SEEKER']), validate(jobIdParamSchema), strictAiRateLimit, getJobApplicationCoaching);
router.post('/draft', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(generateJobDraftSchema), strictAiRateLimit, generateJobDraft);
router.post('/compare', authMiddleware, roleMiddleware(['SEEKER']), validate(compareJobsSchema), strictAiRateLimit, compareJobsForSeeker);
// A visit to a job page, counted once a day per visitor, for hiring reports.
router.post('/:id/view', createRateLimit({ windowMs: 60 * 1000, max: 60, scope: 'job-views' }), trackJobView);
router.get('/:id', maskPublicEmails, getJobById);

// Protected routes
router.post('/', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(createJobSchema), createJob);
router.patch('/:id', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(updateJobSchema), updateOwnedJob);
router.post('/:id/duplicate', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(jobIdParamSchema), duplicateOwnedJob);
router.post('/:id/extend', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(extendJobSchema), extendOwnedJob);
router.patch('/:id/status', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(updateJobStatusSchema), updateOwnedJobStatus);
router.post('/:id/apply', authMiddleware, roleMiddleware(['SEEKER']), validate(applyForJobSchema), applyForJob);
router.get('/:id/applicants', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, getJobApplicants);
router.post('/:id/shortlist-summary', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(generateShortlistSummarySchema), strictAiRateLimit, generateJobShortlistSummary);
router.post('/:id/applicant-comparison', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(generateApplicantComparisonSchema), strictAiRateLimit, generateJobApplicantComparison);
router.post('/applications/:applicationId/decision-brief', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(generateApplicantDecisionBriefSchema), strictAiRateLimit, generateJobApplicantDecisionBrief);
router.put('/applications/:applicationId/review', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(applicationReviewSchema), reviewApplication);
router.post('/:id/applicants/bulk-reject', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(bulkRejectSchema), bulkRejectApplicants);
router.patch('/applications/:applicationId/status', authMiddleware, roleMiddleware(['EMPLOYER']), actAsCompany, validate(updateApplicationStatusSchema), updateApplicationStatus);
router.delete('/applications/:applicationId', authMiddleware, roleMiddleware(['SEEKER']), deleteApplication);

export default router;
