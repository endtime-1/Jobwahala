import env from '../config/env';
import logger from '../config/logger';
import prisma from '../config/prisma';
import { getErrorMessage } from '../utils/errors';
import { OTP_MAX_ATTEMPTS, generateOtp, hashOtp, otpMatches } from '../utils/otp';
import { sendSms } from './sms';

export const PHONE_OTP_PURPOSES = ['SIGNUP', 'LOGIN', 'ADD_PHONE', 'EMPLOYER_VERIFICATION'] as const;
export type PhoneOtpPurpose = (typeof PHONE_OTP_PURPOSES)[number];

/** Codes sent by SMS last 5 minutes. */
export const PHONE_OTP_TTL_MS = 5 * 60 * 1000;
export const PHONE_RESEND_COOLDOWN_MS = 60 * 1000;
/** Most codes any one phone number can be sent in an hour, whatever they were for. */
export const PHONE_MAX_SENDS_PER_HOUR = 5;
/** Most codes any one IP address can ask for in an hour. */
export const IP_MAX_SENDS_PER_HOUR = 10;

const HOUR_MS = 60 * 60 * 1000;

type Subject = { phone: string; purpose: PhoneOtpPurpose; subjectId?: string | null };

export type IssueResult =
  | { ok: true }
  | { ok: false; reason: 'COOLDOWN'; retryAfterSeconds: number }
  | { ok: false; reason: 'PHONE_LIMIT' | 'IP_LIMIT' | 'SMS_FAILED' };

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'NO_CODE' | 'EXPIRED' | 'LOCKED' }
  | { ok: false; reason: 'WRONG'; attemptsLeft: number };

/** The code is tied to the number, the reason it was asked for and who it is for, so it works nowhere else. */
const hashKey = ({ phone, purpose, subjectId }: Subject) => `${phone}|${purpose}|${subjectId ?? ''}`;

/**
 * Texts a fresh 6-digit code to a +233 number. Guards, in order:
 *  - five codes per phone number per hour, and one a minute
 *  - ten codes per IP address per hour
 * A code the provider could not send is deleted, so it never counts against anyone.
 */
export const issuePhoneOtp = async (
  subject: Subject & { ip?: string | null },
  now: Date = new Date(),
): Promise<IssueResult> => {
  const since = new Date(now.getTime() - HOUR_MS);

  const forPhone = await prisma.phoneOtp.findMany({
    where: { phone: subject.phone, createdAt: { gt: since } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (forPhone.length >= PHONE_MAX_SENDS_PER_HOUR) return { ok: false, reason: 'PHONE_LIMIT' };

  const last = forPhone[0];
  if (last) {
    const waitMs = PHONE_RESEND_COOLDOWN_MS - (now.getTime() - last.createdAt.getTime());
    if (waitMs > 0) return { ok: false, reason: 'COOLDOWN', retryAfterSeconds: Math.ceil(waitMs / 1000) };
  }

  if (subject.ip) {
    const fromIp = await prisma.phoneOtp.count({ where: { requestIp: subject.ip, createdAt: { gt: since } } });
    if (fromIp >= IP_MAX_SENDS_PER_HOUR) return { ok: false, reason: 'IP_LIMIT' };
  }

  const code = generateOtp();
  const record = await prisma.phoneOtp.create({
    data: {
      phone: subject.phone,
      purpose: subject.purpose,
      subjectId: subject.subjectId ?? null,
      codeHash: hashOtp(code, hashKey(subject), env.jwtSecret),
      expiresAt: new Date(now.getTime() + PHONE_OTP_TTL_MS),
      requestIp: subject.ip ?? null,
    },
  });

  try {
    await sendSms(subject.phone, `Your JobWahala code is ${code}. It expires in 5 minutes. Never share it with anyone.`);
  } catch (error) {
    logger.error('sms_otp_send_failed', { purpose: subject.purpose, error: getErrorMessage(error) });
    await prisma.phoneOtp.delete({ where: { id: record.id } }).catch(() => undefined);
    return { ok: false, reason: 'SMS_FAILED' };
  }

  return { ok: true };
};

/** Checks a typed code against the newest unused one for this number and purpose. Five wrong tries lock it. */
export const verifyPhoneOtp = async (subject: Subject & { code: string }, now: Date = new Date()): Promise<VerifyResult> => {
  const latest = await prisma.phoneOtp.findFirst({
    where: { phone: subject.phone, purpose: subject.purpose, subjectId: subject.subjectId ?? null, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!latest) return { ok: false, reason: 'NO_CODE' };
  if (latest.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'EXPIRED' };
  if (latest.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'LOCKED' };

  if (!otpMatches(subject.code, hashKey(subject), env.jwtSecret, latest.codeHash)) {
    const updated = await prisma.phoneOtp.update({
      where: { id: latest.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return updated.attempts >= OTP_MAX_ATTEMPTS
      ? { ok: false, reason: 'LOCKED' }
      : { ok: false, reason: 'WRONG', attemptsLeft: OTP_MAX_ATTEMPTS - updated.attempts };
  }

  // A code works once, even if two requests arrive together: only the first to claim it wins.
  const claim = await prisma.phoneOtp.updateMany({ where: { id: latest.id, consumedAt: null }, data: { consumedAt: now } });
  return claim.count === 1 ? { ok: true } : { ok: false, reason: 'NO_CODE' };
};
