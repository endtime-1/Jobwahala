import crypto from 'crypto';

/** One-time codes for confirming a company's contact email (and phone, once SMS is set up). */
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_SENDS_PER_HOUR = 5;

export const generateOtp = () => crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');

/** Only this hash is stored, never the code. It is tied to one request, so a code cannot be reused elsewhere. */
export const hashOtp = (code: string, requestId: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(`${requestId}:${code}`).digest('hex');

export const otpMatches = (code: string, requestId: string, secret: string, storedHash: string) => {
  const candidate = Buffer.from(hashOtp(code.trim(), requestId, secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
};

export const isWellFormedOtp = (code: unknown): code is string =>
  typeof code === 'string' && new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code.trim());
