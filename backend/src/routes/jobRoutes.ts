import { Router } from 'express';
import { compareJobsForSeeker, createJob, generateJobApplicantComparison, generateJobApplicantDecisionBrief, generateJobDraft, getJobs, getJobById, applyForJob, getJobApplicants, updateApplicationStatus, deleteApplication, updateOwnedJobStatus, getMyJobApplication, generateJobShortlistSummary, getJobApplicationCoaching } from '../controllers/jobController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { strictAiRateLimit } from '../middleware/security';
import { applyForJobSchema, compareJobsSchema, createJobSchema, generateApplicantComparisonSchema, generateApplicantDecisionBriefSchema, generateJobDraftSchema, generateShortlistSummarySchema, jobIdParamSchema, updateApplicationStatusSchema, updateJobStatusSchema } from '../validation/jobSchemas';

const router = Router();

router.get('/', getJobs);
router.get('/:id/my-application', authMiddleware, roleMiddleware(['SEEKER']), validate(jobIdParamSchema), getMyJobApplication);
router.get('/:id/application-coaching', authMiddleware, roleMiddleware(['SEEKER']), validate(jobIdParamSchema), strictAiRateLimit, getJobApplicationCoaching);
router.post('/draft', authMiddleware, roleMiddleware(['EMPLOYER']), validate(generateJobDraftSchema), strictAiRateLimit, generateJobDraft);
router.post('/compare', authMiddleware, roleMiddleware(['SEEKER']), validate(compareJobsSchema), strictAiRateLimit, compareJobsForSeeker);
router.get('/:id', getJobById);

// Protected routes
router.post('/', authMiddleware, roleMiddleware(['EMPLOYER']), validate(createJobSchema), createJob);
router.patch('/:id/status', authMiddleware, roleMiddleware(['EMPLOYER']), validate(updateJobStatusSchema), updateOwnedJobStatus);
router.post('/:id/apply', authMiddleware, roleMiddleware(['SEEKER']), validate(applyForJobSchema), applyForJob);
router.get('/:id/applicants', authMiddleware, roleMiddleware(['EMPLOYER']), getJobApplicants);
router.post('/:id/shortlist-summary', authMiddleware, roleMiddleware(['EMPLOYER']), validate(generateShortlistSummarySchema), strictAiRateLimit, generateJobShortlistSummary);
router.post('/:id/applicant-comparison', authMiddleware, roleMiddleware(['EMPLOYER']), validate(generateApplicantComparisonSchema), strictAiRateLimit, generateJobApplicantComparison);
router.post('/applications/:applicationId/decision-brief', authMiddleware, roleMiddleware(['EMPLOYER']), validate(generateApplicantDecisionBriefSchema), strictAiRateLimit, generateJobApplicantDecisionBrief);
router.patch('/applications/:applicationId/status', authMiddleware, roleMiddleware(['EMPLOYER']), validate(updateApplicationStatusSchema), updateApplicationStatus);
router.delete('/applications/:applicationId', authMiddleware, roleMiddleware(['SEEKER']), deleteApplication);

export default router;
