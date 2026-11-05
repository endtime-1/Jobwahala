import { Router } from 'express';
import {
  register,
  login,
  me,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  sendPhoneCode,
  loginWithPhone,
  signupWithPhone,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createRateLimit } from '../middleware/security';
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sendPhoneCodeSchema,
  phoneLoginSchema,
  phoneSignupSchema,
} from '../validation/authSchemas';

const router = Router();

// Phone sign-up and log-in with a texted code. Texts cost money, so sending is tightly limited per IP
// (and per phone number inside the service); trying codes has its own, looser limit.
const smsSendLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 20, scope: 'sms-send' });
const smsCheckLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 60, scope: 'sms-check' });
router.post('/phone/send-code', smsSendLimit, validate(sendPhoneCodeSchema), sendPhoneCode);
router.post('/phone/login', smsCheckLimit, validate(phoneLoginSchema), loginWithPhone);
router.post('/phone/signup', smsCheckLimit, validate(phoneSignupSchema), signupWithPhone);

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authMiddleware, me);

// Email verification
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', validate(resendVerificationSchema), resendVerification);

// Password reset
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
