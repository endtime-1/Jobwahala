import { NextFunction, Request, Response } from 'express';
import env from '../config/env';
import logger from '../config/logger';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;

export type CaptchaOutcome = 'PASSED' | 'FAILED' | 'UNAVAILABLE';

/**
 * Asks Cloudflare whether a Turnstile token is genuine. A token works once. If Cloudflare cannot be
 * reached we say UNAVAILABLE rather than FAILED, so a real person is told to try again.
 */
export const verifyTurnstileToken = async (
  token: string,
  secret: string,
  ip?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CaptchaOutcome> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.set('remoteip', ip);

    const response = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) return 'UNAVAILABLE';
    const body = (await response.json().catch(() => null)) as { success?: boolean } | null;
    return body?.success === true ? 'PASSED' : 'FAILED';
  } catch {
    return 'UNAVAILABLE';
  } finally {
    clearTimeout(timer);
  }
};

type Dependencies = {
  secret: () => string;
  isProduction: () => boolean;
  verify: (token: string, secret: string, ip?: string) => Promise<CaptchaOutcome>;
};

let warnedAboutMissingSecret = false;

/**
 * Bot check for forms anyone can submit. The page sends the Turnstile token as `captchaToken` in the JSON
 * body; this middleware checks it with Cloudflare, removes it from the body, and only then lets the
 * request on to validation.
 *
 * With no secret configured: development and tests let everything through, but production REFUSES,
 * because quietly running without the check is worse than a form that tells you it is not set up.
 */
export const requireCaptcha = (overrides: Partial<Dependencies> = {}) => {
  const deps: Dependencies = {
    secret: () => env.turnstileSecretKey,
    isProduction: () => env.isProduction,
    verify: (token, secret, ip) => verifyTurnstileToken(token, secret, ip),
    ...overrides,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Take the token out of the body whatever happens, so strict validation never sees it.
    const token = typeof req.body?.captchaToken === 'string' ? req.body.captchaToken.trim() : '';
    if (req.body && typeof req.body === 'object') delete req.body.captchaToken;

    const secret = deps.secret();

    if (!secret) {
      if (deps.isProduction()) {
        if (!warnedAboutMissingSecret) {
          warnedAboutMissingSecret = true;
          logger.error('captcha_not_configured', { hint: 'Set TURNSTILE_SECRET_KEY, or sign-up and similar forms stay closed.' });
        }
        return res.status(503).json({
          success: false,
          code: 'CAPTCHA_NOT_CONFIGURED',
          message: 'This form is temporarily unavailable. Please try again later.',
        });
      }
      return next();
    }

    if (!token) {
      return res.status(400).json({ success: false, code: 'CAPTCHA_REQUIRED', message: 'Please complete the security check.' });
    }

    const outcome = await deps.verify(token, secret, req.ip);

    if (outcome === 'PASSED') return next();
    if (outcome === 'UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        code: 'CAPTCHA_UNAVAILABLE',
        message: 'We could not run the security check just now. Please try again.',
      });
    }
    return res.status(400).json({
      success: false,
      code: 'CAPTCHA_FAILED',
      message: 'The security check did not pass. Please try again.',
    });
  };
};
