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
import { issuePhoneOtp, verifyPhoneOtp } from './phoneOtpService';

export type ContactChannel = 'EMAIL' | 'PHONE';

export type SendCodeResult =
  | { ok: true; channel: ContactChannel }
  | { ok: false; reason: 'NOT_FOUND' | 'NO_EMAIL' | 'NO_PHONE' | 'ALREADY_CONFIRMED' | 'NOT_OPEN' | 'EMAIL_FAILED' | 'SMS_FAILED' }
  | { ok: false; reason: 'COOLDOWN'; retryAfterSeconds: number }
  | { ok: false; reason: 'TOO_MANY' };

export type ConfirmCodeResult =
  | { ok: true; channel: ContactChannel }
  | { ok: false; reason: 'NOT_FOUND' | 'NO_CODE' | 'EXPIRED' | 'ALREADY_CONFIRMED' | 'NOT_OPEN' }
  | { ok: false; reason: 'WRONG'; attemptsLeft: number }
  | { ok: false; reason: 'LOCKED' };

const HOUR_MS = 60 * 60 * 1000;

/** Only the owner's own open request (still waiting for review, or waiting on them) can be confirmed. */
const OPEN_STATUSES = ['PENDING', 'NEEDS_INFO'];

/**
 * Sends a fresh 6-digit code to the company contact on a business verification request: by email
 * (10 minutes to use it) or by SMS through the shared SMS service (5 minutes, with its per-phone and
 * per-IP limits). With no channel given, email is used when there is one, otherwise the phone.
 * Email guards: a minute between sends and five an hour per request.
 */
export const sendContactCode = async (
  requestId: string,
  ownerId: string,
  now: Date = new Date(),
  options: { channel?: ContactChannel; ip?: string | null } = {},
): Promise<SendCodeResult> => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      userId: true,
      type: true,
      status: true,
      contactEmail: true,
      contactPhone: true,
      contactVerifiedAt: true,
      user: { select: { employerProfile: { select: { companyName: true } } } },
    },
  });

  if (!request || request.userId !== ownerId || request.type !== 'BUSINESS') return { ok: false, reason: 'NOT_FOUND' };
  if (!OPEN_STATUSES.includes(request.status)) return { ok: false, reason: 'NOT_OPEN' };
  if (request.contactVerifiedAt) return { ok: false, reason: 'ALREADY_CONFIRMED' };

  const channel: ContactChannel = options.channel ?? (request.contactEmail ? 'EMAIL' : 'PHONE');

  if (channel === 'PHONE') {
    if (!request.contactPhone) return { ok: false, reason: 'NO_PHONE' };

    const issued = await issuePhoneOtp(
      { phone: request.contactPhone, purpose: 'EMPLOYER_VERIFICATION', subjectId: requestId, ip: options.ip },
      now,
    );
    if (issued.ok) return { ok: true, channel };
    if (issued.reason === 'COOLDOWN') return { ok: false, reason: 'COOLDOWN', retryAfterSeconds: issued.retryAfterSeconds };
    if (issued.reason === 'SMS_FAILED') return { ok: false, reason: 'SMS_FAILED' };
    return { ok: false, reason: 'TOO_MANY' };
  }

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

  return { ok: true, channel };
};

/**
 * Checks the code the employer typed. It is matched against whichever channel they asked for last.
 * Five wrong tries lock a code; a right one confirms the contact and records how.
 */
export const confirmContactCode = async (
  requestId: string,
  ownerId: string,
  code: string,
  now: Date = new Date(),
): Promise<ConfirmCodeResult> => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, type: true, status: true, contactPhone: true, contactVerifiedAt: true },
  });

  if (!request || request.userId !== ownerId || request.type !== 'BUSINESS') return { ok: false, reason: 'NOT_FOUND' };
  if (!OPEN_STATUSES.includes(request.status)) return { ok: false, reason: 'NOT_OPEN' };
  if (request.contactVerifiedAt) return { ok: false, reason: 'ALREADY_CONFIRMED' };

  const [latestEmail, latestPhone] = await Promise.all([
    prisma.contactVerificationCode.findFirst({
      where: { verificationRequestId: requestId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    request.contactPhone
      ? prisma.phoneOtp.findFirst({
          where: { phone: request.contactPhone, purpose: 'EMPLOYER_VERIFICATION', subjectId: requestId, consumedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  if (!latestEmail && !latestPhone) return { ok: false, reason: 'NO_CODE' };

  // Use whichever code was asked for most recently.
  const usePhone = Boolean(latestPhone) && (!latestEmail || latestPhone!.createdAt.getTime() >= latestEmail.createdAt.getTime());

  if (usePhone) {
    const result = await verifyPhoneOtp(
      { phone: request.contactPhone!, purpose: 'EMPLOYER_VERIFICATION', subjectId: requestId, code },
      now,
    );
    if (!result.ok) return result;

    await prisma.verificationRequest.update({
      where: { id: requestId },
      data: { contactVerifiedAt: now, contactVerifiedVia: 'PHONE' },
    });
    return { ok: true, channel: 'PHONE' };
  }

  const emailCode = latestEmail!;
  if (emailCode.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'EXPIRED' };
  if (emailCode.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'LOCKED' };

  if (!otpMatches(code, requestId, env.jwtSecret, emailCode.codeHash)) {
    const updated = await prisma.contactVerificationCode.update({
      where: { id: emailCode.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return updated.attempts >= OTP_MAX_ATTEMPTS
      ? { ok: false, reason: 'LOCKED' }
      : { ok: false, reason: 'WRONG', attemptsLeft: OTP_MAX_ATTEMPTS - updated.attempts };
  }

  await prisma.$transaction([
    prisma.contactVerificationCode.update({ where: { id: emailCode.id }, data: { consumedAt: now } }),
    prisma.verificationRequest.update({ where: { id: requestId }, data: { contactVerifiedAt: now, contactVerifiedVia: 'EMAIL' } }),
  ]);

  return { ok: true, channel: 'EMAIL' };
};
