import crypto from 'crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import env from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { serializeVerificationStatus } from '../utils/verification';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';
import logger from '../config/logger';
import { getErrorMessage } from '../utils/errors';
import { GoogleAuthError, verifyGoogleIdToken } from '../services/googleAuth';
import { IssueResult, VerifyResult, issuePhoneOtp, verifyPhoneOtp } from '../services/phoneOtpService';

const allowedRegistrationRoles = ['SEEKER', 'EMPLOYER', 'FREELANCER'] as const;

const generateToken = (id: string, role: string, tokenVersion: number) => {
  const options: jwt.SignOptions = {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign({ id, role, tokenVersion }, env.jwtSecret, options);
};

const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

// ── Registration ──────────────────────────────────────────────────────

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, role, cvVisibility } = req.body;
    const normalizedRole = typeof role === 'string' ? role.toUpperCase() : 'SEEKER';

    if (!allowedRegistrationRoles.includes(normalizedRole as (typeof allowedRegistrationRoles)[number])) {
      return res.status(400).json({ success: false, message: 'Invalid registration role' });
    }

    if (normalizedRole === 'FREELANCER' && !env.freelanceEnabled) {
      return res.status(403).json({ success: false, code: 'FREELANCE_DISABLED', message: 'Freelance accounts are not open yet. Join as a job seeker or employer for now.' });
    }

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: normalizedRole,
      },
    });

    // Create profile based on role
    if (user.role === 'SEEKER') {
      await prisma.jobSeekerProfile.create({ data: { userId: user.id, ...(cvVisibility === 'VERIFIED_EMPLOYERS' ? { cvVisibility, cvVisibleSince: new Date() } : {}) } });
    } else if (user.role === 'EMPLOYER') {
      await prisma.employerProfile.create({ data: { userId: user.id, companyName: 'New Company' } });
    } else if (user.role === 'FREELANCER') {
      await prisma.freelancerProfile.create({ data: { userId: user.id } });
    }

    // Create email verification token and send email
    const verificationToken = generateSecureToken();
    await prisma.emailVerificationToken.create({
      data: {
        token: verificationToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Fire-and-forget: don't block registration on email delivery
    sendVerificationEmail(email, verificationToken).catch((err) => {
      logger.error('verification_email_failed', { email, error: err.message });
    });

    const token = generateToken(user.id, user.role, 0);

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, emailVerified: false },
      message: 'Account created. Please check your email to verify your address.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// ── Login ─────────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account is not active' });
    }

    const token = generateToken(user.id, user.role, user.tokenVersion);

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// ── Current User ──────────────────────────────────────────────────────

export const me = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        emailVerified: true,
        jobSeekerProfile: true,
        employerProfile: true,
        freelancerProfile: true,
        verificationRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Employers can filter the CV database by when a person was last active. Once an hour is plenty.
    if (user.role === 'SEEKER' && user.jobSeekerProfile) {
      const last = user.jobSeekerProfile.lastActiveAt;
      if (!last || Date.now() - last.getTime() > 60 * 60 * 1000) {
        try {
          await prisma.jobSeekerProfile.update({ where: { userId: user.id }, data: { lastActiveAt: new Date() } });
        } catch {
          // Not worth failing the page for.
        }
      }
    }

    const latestVerificationRequest = user.verificationRequests[0] || null;
    const { verificationRequests: _verificationRequests, ...safeUser } = user;

    res.json({
      success: true,
      user: {
        ...safeUser,
        ...serializeVerificationStatus(latestVerificationRequest),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// ── Email Verification ────────────────────────────────────────────────

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, emailVerified: true } } },
    });

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid verification token' });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification token has expired. Please request a new one.' });
    }

    if (record.user.emailVerified) {
      // Already verified — clean up and return success
      await prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } });
      return res.json({ success: true, message: 'Email is already verified' });
    }

    // Mark verified and clean up all tokens for this user
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user || user.emailVerified) {
      return res.json({ success: true, message: 'If an account exists with that email and is unverified, a verification email has been sent.' });
    }

    // Rate-limit: only 1 token per 2 minutes
    const recentToken = await prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
      },
    });

    if (recentToken) {
      return res.json({ success: true, message: 'If an account exists with that email and is unverified, a verification email has been sent.' });
    }

    // Clean up old tokens and create new one
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

    const verificationToken = generateSecureToken();
    await prisma.emailVerificationToken.create({
      data: {
        token: verificationToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    sendVerificationEmail(email, verificationToken).catch((err) => {
      logger.error('resend_verification_email_failed', { email, error: err.message });
    });

    res.json({ success: true, message: 'If an account exists with that email and is unverified, a verification email has been sent.' });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// ── Password Reset ────────────────────────────────────────────────────

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If an account exists with that email, a password reset link has been sent.' });
    }

    // Rate-limit: only 1 reset email per 2 minutes
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
      },
    });

    if (recentToken) {
      return res.json({ success: true, message: 'If an account exists with that email, a password reset link has been sent.' });
    }

    // Invalidate old tokens
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const resetToken = generateSecureToken();
    await prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    sendPasswordResetEmail(email, resetToken).catch((err) => {
      logger.error('password_reset_email_failed', { email, error: err.message });
    });

    res.json({ success: true, message: 'If an account exists with that email, a password reset link has been sent.' });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid reset token' });
    }

    if (record.usedAt) {
      return res.status(400).json({ success: false, message: 'This reset link has already been used' });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset link has expired. Please request a new one.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 }, // Invalidate all existing sessions
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// ── Phone sign-up, log-in and adding a phone ──────────────────────────

const LOGIN_CODE_NOTICE = 'If this number has an account, we have texted it a 6-digit code.';

export const respondToIssue = (res: Response, result: IssueResult) => {
  if (result.ok) return res.json({ success: true, message: 'We have texted you a 6-digit code.' });

  switch (result.reason) {
    case 'COOLDOWN':
      return res.status(429).json({
        success: false,
        retryAfterSeconds: result.retryAfterSeconds,
        message: 'Please wait ' + result.retryAfterSeconds + ' seconds before asking for another code.',
      });
    case 'PHONE_LIMIT':
      return res.status(429).json({ success: false, message: 'Too many codes have been sent to this number. Try again in an hour.' });
    case 'IP_LIMIT':
      return res.status(429).json({ success: false, message: 'Too many codes have been requested from this connection. Try again in an hour.' });
    default:
      return res.status(502).json({ success: false, message: 'We could not send the text message just now. Please try again.' });
  }
};

export const respondToWrongCode = (res: Response, result: Exclude<VerifyResult, { ok: true }>) => {
  switch (result.reason) {
    case 'NO_CODE':
      return res.status(400).json({ success: false, message: 'Ask for a code first.' });
    case 'EXPIRED':
      return res.status(400).json({ success: false, message: 'That code has expired. Ask for a new one.' });
    case 'LOCKED':
      return res.status(429).json({ success: false, message: 'Too many wrong tries. Ask for a new code.' });
    default:
      return res.status(400).json({
        success: false,
        attemptsLeft: result.attemptsLeft,
        message: 'That code is not right. ' + result.attemptsLeft + (result.attemptsLeft === 1 ? ' try' : ' tries') + ' left.',
      });
  }
};

const createProfileForRole = async (userId: string, role: string) => {
  if (role === 'SEEKER') await prisma.jobSeekerProfile.create({ data: { userId } });
  else if (role === 'EMPLOYER') await prisma.employerProfile.create({ data: { userId, companyName: 'New Company' } });
  else if (role === 'FREELANCER') await prisma.freelancerProfile.create({ data: { userId } });
};

/** Texts a code for signing up or logging in. For log-in, an unknown number gets the same answer and no text. */
export const sendPhoneCode = async (req: Request, res: Response) => {
  try {
    const { phone, purpose } = req.body as { phone: string; purpose: 'LOGIN' | 'SIGNUP' };
    const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true, status: true } });

    if (purpose === 'SIGNUP' && existing) {
      return res.status(409).json({ success: false, message: 'This number already has an account. Log in instead.' });
    }

    if (purpose === 'LOGIN' && (!existing || existing.status !== 'ACTIVE')) {
      return res.json({ success: true, message: LOGIN_CODE_NOTICE });
    }

    return respondToIssue(res, await issuePhoneOtp({ phone, purpose, ip: req.ip }));
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const loginWithPhone = async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body as { phone: string; code: string };
    const user = await prisma.user.findUnique({ where: { phone } });

    // The same answer for "no account" and "wrong code", so this cannot be used to find out who has one.
    if (!user || user.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'That code is not right, or it has expired.' });
    }

    const result = await verifyPhoneOtp({ phone, purpose: 'LOGIN', code });
    if (!result.ok) return respondToWrongCode(res, result);

    const token = generateToken(user.id, user.role, user.tokenVersion);
    return res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, phone: user.phone, role: user.role, emailVerified: user.emailVerified },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const signupWithPhone = async (req: Request, res: Response) => {
  try {
    const { phone, code, role } = req.body as { phone: string; code: string; role: string };

    if (role === 'FREELANCER' && !env.freelanceEnabled) {
      return res.status(403).json({ success: false, code: 'FREELANCE_DISABLED', message: 'Freelance accounts are not open yet. Join as a job seeker or employer for now.' });
    }

    if (await prisma.user.findUnique({ where: { phone }, select: { id: true } })) {
      return res.status(409).json({ success: false, message: 'This number already has an account. Log in instead.' });
    }

    const result = await verifyPhoneOtp({ phone, purpose: 'SIGNUP', code });
    if (!result.ok) return respondToWrongCode(res, result);

    // No password for a phone account: the stored one is random and nobody knows it.
    const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    let user;
    try {
      user = await prisma.user.create({
        data: { phone, phoneVerifiedAt: new Date(), password: unusablePassword, role },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return res.status(409).json({ success: false, message: 'This number already has an account. Log in instead.' });
      }
      throw error;
    }

    await createProfileForRole(user.id, user.role);

    return res.status(201).json({
      success: true,
      token: generateToken(user.id, user.role, 0),
      user: { id: user.id, email: null, phone: user.phone, role: user.role, emailVerified: false },
      message: 'Account created.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Signed-in members: text a code to a number they want to add to their account. */
export const sendAddPhoneCode = async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = req.body as { phone: string };
    const owner = await prisma.user.findUnique({ where: { phone }, select: { id: true } });

    if (owner) {
      return res.status(409).json({
        success: false,
        message: owner.id === req.user!.id ? 'This number is already on your account.' : 'This number is already used by another account.',
      });
    }

    return respondToIssue(res, await issuePhoneOtp({ phone, purpose: 'ADD_PHONE', subjectId: req.user!.id, ip: req.ip }));
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const confirmAddPhone = async (req: AuthRequest, res: Response) => {
  try {
    const { phone, code } = req.body as { phone: string; code: string };
    const result = await verifyPhoneOtp({ phone, purpose: 'ADD_PHONE', subjectId: req.user!.id, code });
    if (!result.ok) return respondToWrongCode(res, result);

    try {
      await prisma.user.update({ where: { id: req.user!.id }, data: { phone, phoneVerifiedAt: new Date() } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return res.status(409).json({ success: false, message: 'This number is already used by another account.' });
      }
      throw error;
    }

    return res.json({ success: true, phone, message: 'Your phone number is confirmed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// ── Continue with Google ──────────────────────────────────────────────

const unusablePasswordHash = () => bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

/**
 * Sign up or log in with a Google account. The token is checked with Google first. Then:
 * - someone who used Google before is logged in;
 * - someone with an account on the same verified email gets Google linked to it and is logged in;
 * - otherwise a new account is made (the person must say whether they want a job or are hiring).
 * Email and phone log-in keep working as they were.
 */
export const continueWithGoogle = async (req: Request, res: Response) => {
  try {
    if (!env.googleClientId) {
      return res.status(503).json({ success: false, code: 'GOOGLE_NOT_CONFIGURED', message: 'Google sign-in is not available right now. Use your email or phone instead.' });
    }

    const { credential, role } = req.body as { credential: string; role?: 'SEEKER' | 'EMPLOYER' };

    let identity;
    try {
      identity = await verifyGoogleIdToken(credential, env.googleClientId);
    } catch (error) {
      if (error instanceof GoogleAuthError) return res.status(401).json({ success: false, message: error.message });
      throw error;
    }

    // Only an email Google has confirmed belongs to the person can be trusted to find or make an account.
    if (!identity.emailVerified) {
      return res.status(400).json({ success: false, message: 'Your Google email address is not verified, so we cannot use it. Use your email or phone instead.' });
    }

    const respond = (user: { id: string; email: string | null; phone?: string | null; role: string; tokenVersion: number }, status: number, isNew: boolean) =>
      res.status(status).json({
        success: true,
        token: generateToken(user.id, user.role, user.tokenVersion),
        isNew,
        user: { id: user.id, email: user.email, phone: user.phone ?? null, role: user.role, emailVerified: true },
      });

    const byGoogle = await prisma.user.findUnique({ where: { googleId: identity.subject } });
    const user = byGoogle ?? (await prisma.user.findUnique({ where: { email: identity.email } }));

    if (user) {
      if (user.status !== 'ACTIVE') {
        return res.status(403).json({ success: false, message: 'Account is not active' });
      }
      // The email matches an account that is already tied to a different Google account.
      if (user.googleId && user.googleId !== identity.subject) {
        return res.status(409).json({ success: false, message: 'This email is already linked to another Google account.' });
      }

      if (!user.googleId) {
        // Linking. If the email was never confirmed on the old account, whoever made it may not own it, so the
        // old password is replaced and every old session ends: only Google (or a password reset) gets in now.
        const unconfirmed = !user.emailVerified;
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: identity.subject,
            emailVerified: true,
            ...(unconfirmed ? { password: await unusablePasswordHash(), tokenVersion: { increment: 1 } } : {}),
          },
        });
        return respond(updated, 200, false);
      }

      return respond(user, 200, false);
    }

    // A new person: we need to know what they came for.
    if (!role) {
      return res.status(404).json({ success: false, code: 'ROLE_REQUIRED', message: 'No account yet. Tell us whether you want a job or are hiring to create one.' });
    }

    let created;
    try {
      created = await prisma.user.create({
        data: { email: identity.email, googleId: identity.subject, emailVerified: true, password: await unusablePasswordHash(), role },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return res.status(409).json({ success: false, message: 'This account already exists. Please try again.' });
      }
      throw error;
    }

    if (created.role === 'SEEKER') {
      await prisma.jobSeekerProfile.create({ data: { userId: created.id, firstName: identity.givenName, lastName: identity.familyName } });
    } else {
      await createProfileForRole(created.id, created.role);
    }

    return respond(created, 201, true);
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
