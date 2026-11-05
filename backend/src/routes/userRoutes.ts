import { Router } from 'express';
import { getProfile, updateProfile, getAllUsers, getDashboardData, getWorkspaceSignals, getDashboardWorkflowSummary, getDashboardOverview, getProfileOptimization } from '../controllers/userController';
import { sendAddPhoneCode, confirmAddPhone } from '../controllers/authController';
import { clearBuilderCv, clearUploadedCv, getMyCvFiles, setBuilderCv, setUploadedCv } from '../controllers/cvFileController';
import { setCvFileSchema } from '../validation/cvFileSchemas';
import { deleteMyAccount, exportMyData, getMyDeletionPreview, sendDeletionCode } from '../controllers/accountController';
import { addPhoneSchema, confirmAddPhoneSchema, deleteAccountSchema } from '../validation/authSchemas';
import { createVerificationRequest, getMyVerification, requestContactCode, submitContactCode } from '../controllers/verificationController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validate, validateWith } from '../middleware/validate';
import { getProfileUpdateSchema } from '../validation/profileSchemas';
import {
  confirmVerificationCodeSchema,
  createBusinessVerificationRequestSchema,
  createVerificationRequestSchema,
  requestVerificationCodeSchema,
} from '../validation/verificationSchemas';
import { createRateLimit } from '../middleware/security';
import { actAsCompany } from '../middleware/company';

const router = Router();

// A team member sees the company's dashboard; for everyone else actAsCompany does nothing.
router.get('/dashboard', authMiddleware, actAsCompany, getDashboardData);
router.get('/overview', authMiddleware, actAsCompany, getDashboardOverview);
router.get('/signals', authMiddleware, actAsCompany, getWorkspaceSignals);
router.get('/workflow-summary', authMiddleware, actAsCompany, getDashboardWorkflowSummary);
router.get('/profile-optimization', authMiddleware, roleMiddleware(['SEEKER']), getProfileOptimization);
router.get('/verification', authMiddleware, getMyVerification);
// Companies send the full set of business details; other roles send the short form.
router.post(
  '/verification',
  authMiddleware,
  validateWith((req) =>
    (req as any).user?.role === 'EMPLOYER' ? createBusinessVerificationRequestSchema : createVerificationRequestSchema,
  ),
  createVerificationRequest,
);

// One-time codes: tight limits on top of the per-request limits in the service.
const otpRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 30, scope: 'otp' });
router.post('/verification/:id/code', authMiddleware, roleMiddleware(['EMPLOYER']), otpRateLimit, validate(requestVerificationCodeSchema), requestContactCode);
router.post('/verification/:id/confirm', authMiddleware, roleMiddleware(['EMPLOYER']), otpRateLimit, validate(confirmVerificationCodeSchema), submitContactCode);
// Add and confirm a phone number on an existing account.
const addPhoneSendLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 20, scope: 'sms-send' });
const addPhoneCheckLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 60, scope: 'sms-check' });
router.post('/phone/send-code', authMiddleware, addPhoneSendLimit, validate(addPhoneSchema), sendAddPhoneCode);
router.post('/phone/confirm', authMiddleware, addPhoneCheckLimit, validate(confirmAddPhoneSchema), confirmAddPhone);

// Your data: download it, or delete the account. Both are rate limited; deleting also re-checks who you are.
const exportLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 10, scope: 'data-export' });
const deleteLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 10, scope: 'account-delete' });
router.get('/me/export', authMiddleware, exportLimit, exportMyData);
router.get('/me/deletion-preview', authMiddleware, getMyDeletionPreview);
router.post('/me/delete-code', authMiddleware, addPhoneSendLimit, sendDeletionCode);
router.post('/me/delete', authMiddleware, deleteLimit, validate(deleteAccountSchema), deleteMyAccount);

// A seeker's CV files (the upload itself goes through /api/uploads/evidence with category "cv").
router.get('/cv', authMiddleware, roleMiddleware(['SEEKER']), getMyCvFiles);
router.put('/cv/uploaded', authMiddleware, roleMiddleware(['SEEKER']), validate(setCvFileSchema), setUploadedCv);
router.delete('/cv/uploaded', authMiddleware, roleMiddleware(['SEEKER']), clearUploadedCv);
router.put('/cv/builder', authMiddleware, roleMiddleware(['SEEKER']), validate(setCvFileSchema), setBuilderCv);
router.delete('/cv/builder', authMiddleware, roleMiddleware(['SEEKER']), clearBuilderCv);

router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, validateWith((req) => getProfileUpdateSchema((req as any).user?.role)), updateProfile);
router.get('/', authMiddleware, roleMiddleware(['ADMIN']), getAllUsers);

export default router;
