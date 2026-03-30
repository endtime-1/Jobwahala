import crypto from 'crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import env from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { serializeVerificationStatus } from '../utils/verification';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';

const allowedRegistrationRoles = ['SEEKER', 'EMPLOYER', 'FREELANCER'] as const;

const generateToken = (id: string, role: string) => {
  const options: jwt.SignOptions = {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign({ id, role }, env.jwtSecret, options);
};

const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

// ── Registration ──────────────────────────────────────────────────────

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;
    const normalizedRole = typeof role === 'string' ? role.toUpperCase() : 'SEEKER';

    if (!allowedRegistrationRoles.includes(normalizedRole as (typeof allowedRegistrationRoles)[number])) {
      return res.status(400).json({ success: false, message: 'Invalid registration role' });
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
      await prisma.jobSeekerProfile.create({ data: { userId: user.id } });
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
    sendVerificationEmail(user.email, verificationToken).catch((err) => {
      console.error('[jobwahala] Failed to send verification email:', err.message);
    });

    const token = generateToken(user.id, user.role);

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, emailVerified: false },
      message: 'Account created. Please check your email to verify your address.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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

    const token = generateToken(user.id, user.role);

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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

    const latestVerificationRequest = user.verificationRequests[0] || null;
    const { verificationRequests, ...safeUser } = user;

    res.json({
      success: true,
      user: {
        ...safeUser,
        ...serializeVerificationStatus(latestVerificationRequest),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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

    sendVerificationEmail(user.email, verificationToken).catch((err) => {
      console.error('[jobwahala] Failed to resend verification email:', err.message);
    });

    res.json({ success: true, message: 'If an account exists with that email and is unverified, a verification email has been sent.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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

    sendPasswordResetEmail(user.email, resetToken).catch((err) => {
      console.error('[jobwahala] Failed to send password reset email:', err.message);
    });

    res.json({ success: true, message: 'If an account exists with that email, a password reset link has been sent.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
