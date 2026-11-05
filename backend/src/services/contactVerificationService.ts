import env from '../config/env';
import prisma from '../config/prisma';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  generateOtp,
  hashOtp,
  otpMatches,
} from '../utils/otp';
import { sendVerificationCodeEmail } from './emailService';

export type SendCodeResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'NO_EMAIL' | 'ALREADY_CONFIRMED' | 'NOT_OPEN' | 'EMAIL_FAILED' }
  | { ok: false; reason: 'COOLDOWN'; retryAfterSeconds: number }
  | { ok: false; reason: 'TOO_MANY' };

export type ConfirmCodeResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'NO_CODE' | 'EXPIRED' | 'ALREADY_CONFIRMED' | 'NOT_OPEN' }
  | { ok: false; reason: 'WRONG'; attemptsLeft: number }
  | { ok: false; reason: 'LOCKED' };

const HOUR_MS = 60 * 60 * 1000;

/** Only the owner's own open request (still waiting for review, or waiting on them) can be confirmed. */
const OPEN_STATUSES = ['PENDING', 'NEEDS_INFO'];

/**
 * Emails a fresh 6-digit code to the company contact email on a business verification request.
 * Guards: a minute between sends, five sends an hour, and each new code replaces the old one.
 */
export const sendContactCode = async (requestId: string, ownerId: string, now: Date = new Date()): Promise<SendCodeResult> => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      userId: true,
      type: true,
      status: true,
      contactEmail: true,
      contactVerifiedAt: true,
      user: { select: { employerProfile: { select: { companyName: true } } } },
    },
  });

  if (!request || request.userId !== ownerId || request.type !== 'BUSINESS') return { ok: false, reason: 'NOT_FOUND' };
  if (!OPEN_STATUSES.includes(request.status)) return { ok: false, reason: 'NOT_OPEN' };
  if (request.contactVerifiedAt) return { ok: false, reason: 'ALREADY_CONFIRMED' };
  if (!request.contactEmail) return { ok: false, reason: 'NO_EMAIL' };

  const recent = await prisma.contactVerificationCode.findMany({
    where: { verificationRequestId: requestId, createdAt: { gt: new Date(now.getTime() - HOUR_MS) } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (recent.length >= OTP_MAX_SENDS_PER_HOUR) return { ok: false, reason: 'TOO_MANY' };

  const last = recent[0];
  if (last) {
    const waitMs = OTP_RESEND_COOLDOWN_MS - (now.getTime() - last.createdAt.getTime());
    if (waitMs > 0) return { ok: false, reason: 'COOLDOWN', retryAfterSeconds: Math.ceil(waitMs / 1000) };
  }

  const code = generateOtp();
  const record = await prisma.contactVerificationCode.create({
    data: {
      verificationRequestId: requestId,
      channel: 'EMAIL',
      target: request.contactEmail,
      codeHash: hashOtp(code, requestId, env.jwtSecret),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    },
  });

  try {
    await sendVerificationCodeEmail(request.contactEmail, code, request.user.employerProfile?.companyName);
  } catch {
    // A code nobody received is worthless and should not count against the hourly limit.
    await prisma.contactVerificationCode.delete({ where: { id: record.id } }).catch(() => undefined);
    return { ok: false, reason: 'EMAIL_FAILED' };
  }

  return { ok: true };
};

/** Checks the code the employer typed. Five wrong tries lock the code; a right one confirms the contact. */
export const confirmContactCode = async (
  requestId: string,
  ownerId: string,
  code: string,
  now: Date = new Date(),
): Promise<ConfirmCodeResult> => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, type: true, status: true, contactVerifiedAt: true },
  });

  if (!request || request.userId !== ownerId || request.type !== 'BUSINESS') return { ok: false, reason: 'NOT_FOUND' };
  if (!OPEN_STATUSES.includes(request.status)) return { ok: false, reason: 'NOT_OPEN' };
  if (request.contactVerifiedAt) return { ok: false, reason: 'ALREADY_CONFIRMED' };

  const latest = await prisma.contactVerificationCode.findFirst({
    where: { verificationRequestId: requestId, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!latest) return { ok: false, reason: 'NO_CODE' };
  if (latest.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'EXPIRED' };
  if (latest.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'LOCKED' };

  if (!otpMatches(code, requestId, env.jwtSecret, latest.codeHash)) {
    const updated = await prisma.contactVerificationCode.update({
      where: { id: latest.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return updated.attempts >= OTP_MAX_ATTEMPTS
      ? { ok: false, reason: 'LOCKED' }
      : { ok: false, reason: 'WRONG', attemptsLeft: OTP_MAX_ATTEMPTS - updated.attempts };
  }

  await prisma.$transaction([
    prisma.contactVerificationCode.update({ where: { id: latest.id }, data: { consumedAt: now } }),
    prisma.verificationRequest.update({ where: { id: requestId }, data: { contactVerifiedAt: now } }),
  ]);

  return { ok: true };
};
