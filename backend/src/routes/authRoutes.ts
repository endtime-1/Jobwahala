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
  continueWithGoogle,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createRateLimit } from '../middleware/security';
import { requireCaptcha } from '../middleware/captcha';
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
  googleAuthSchema,
} from '../validation/authSchemas';

const router = Router();

// Phone sign-up and log-in with a texted code. Texts cost money, so sending is tightly limited per IP
// (and per phone number inside the service); trying codes has its own, looser limit.
const smsSendLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 20, scope: 'sms-send' });
const smsCheckLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 60, scope: 'sms-check' });
// A bot check before any text is sent (each one costs money) and before an account can be created.
const captcha = requireCaptcha();
router.post('/phone/send-code', smsSendLimit, captcha, validate(sendPhoneCodeSchema), sendPhoneCode);
router.post('/phone/login', smsCheckLimit, validate(phoneLoginSchema), loginWithPhone);
router.post('/phone/signup', smsCheckLimit, validate(phoneSignupSchema), signupWithPhone);

// "Continue with Google". Google does the bot checking; the limit stops someone hammering the endpoint.
const googleLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 60, scope: 'google-auth' });
router.post('/google', googleLimit, validate(googleAuthSchema), continueWithGoogle);

router.post('/register', captcha, validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authMiddleware, me);

// Email verification
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', validate(resendVerificationSchema), resendVerification);

// Password reset
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
