import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requireCaptcha, verifyTurnstileToken } from '../../middleware/captcha';

const run = async (
  middleware: ReturnType<typeof requireCaptcha>,
  body: Record<string, unknown> | undefined,
  ip = '10.0.0.1',
) => {
  let status = 0;
  let payload: any;
  let nexted = false;
  const req = { body, ip } as unknown as Request;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;
  await middleware(req, res, (() => {
    nexted = true;
  }) as NextFunction);
  return { status, payload, nexted, body: req.body };
};

describe('verifying a Turnstile token with Cloudflare', () => {
  const answer = (value: unknown, ok = true) => vi.fn(async () => new Response(JSON.stringify(value), { status: ok ? 200 : 500 }));

  it('posts the secret, the token and the visitor\'s address as a form', async () => {
    const fetchMock = answer({ success: true });

    expect(await verifyTurnstileToken('tok', 'sekrit', '1.2.3.4', fetchMock as unknown as typeof fetch)).toBe('PASSED');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    const form = init.body as URLSearchParams;
    expect(form.get('secret')).toBe('sekrit');
    expect(form.get('response')).toBe('tok');
    expect(form.get('remoteip')).toBe('1.2.3.4');
  });

  it('fails a token Cloudflare rejects', async () => {
    const fetchMock = answer({ success: false, 'error-codes': ['invalid-input-response'] });
    expect(await verifyTurnstileToken('bad', 's', undefined, fetchMock as unknown as typeof fetch)).toBe('FAILED');
  });

  it('says unavailable, not failed, when Cloudflare cannot be reached or errors', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await verifyTurnstileToken('t', 's', undefined, down as unknown as typeof fetch)).toBe('UNAVAILABLE');
    expect(await verifyTurnstileToken('t', 's', undefined, answer({}, false) as unknown as typeof fetch)).toBe('UNAVAILABLE');
  });
});

describe('the bot check in front of a form', () => {
  const configured = (verify: ReturnType<typeof vi.fn>) =>
    requireCaptcha({ secret: () => 'sekrit', isProduction: () => true, verify: verify as never });

  it('lets a request through when the token checks out, and removes the token from the body', async () => {
    const verify = vi.fn(async () => 'PASSED');

    const result = await run(configured(verify), { email: 'a@b.com', captchaToken: 'tok' }, '9.9.9.9');

    expect(result.nexted).toBe(true);
    expect(verify).toHaveBeenCalledWith('tok', 'sekrit', '9.9.9.9');
    expect(result.body).toEqual({ email: 'a@b.com' });
  });

  it('asks for the check when there is no token, and never calls Cloudflare', async () => {
    const verify = vi.fn();

    const result = await run(configured(verify), { email: 'a@b.com' });

    expect(result.nexted).toBe(false);
    expect(result.status).toBe(400);
    expect(result.payload).toMatchObject({ code: 'CAPTCHA_REQUIRED' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('treats a blank or non-string token as missing', async () => {
    const verify = vi.fn();
    for (const captchaToken of ['', '   ', 123, null, { a: 1 }]) {
      expect((await run(configured(verify), { captchaToken })).payload).toMatchObject({ code: 'CAPTCHA_REQUIRED' });
    }
    expect(verify).not.toHaveBeenCalled();
  });

  it('refuses a token that fails', async () => {
    const result = await run(configured(vi.fn(async () => 'FAILED')), { captchaToken: 'bad' });

    expect(result.nexted).toBe(false);
    expect(result.status).toBe(400);
    expect(result.payload).toMatchObject({ code: 'CAPTCHA_FAILED' });
  });

  it('tells the person to try again when Cloudflare is unreachable', async () => {
    const result = await run(configured(vi.fn(async () => 'UNAVAILABLE')), { captchaToken: 'tok' });

    expect(result.nexted).toBe(false);
    expect(result.status).toBe(503);
    expect(result.payload).toMatchObject({ code: 'CAPTCHA_UNAVAILABLE' });
  });

  it('copes with a request that has no body at all', async () => {
    const result = await run(configured(vi.fn()), undefined);

    expect(result.status).toBe(400);
    expect(result.payload).toMatchObject({ code: 'CAPTCHA_REQUIRED' });
  });

  describe('with no secret configured', () => {
    it('stays out of the way in development and tests', async () => {
      const verify = vi.fn();
      const result = await run(requireCaptcha({ secret: () => '', isProduction: () => false, verify: verify as never }), { captchaToken: 'x', a: 1 });

      expect(result.nexted).toBe(true);
      expect(verify).not.toHaveBeenCalled();
      expect(result.body).toEqual({ a: 1 });
    });

    it('keeps the form closed in production rather than quietly running without protection', async () => {
      const result = await run(requireCaptcha({ secret: () => '', isProduction: () => true, verify: vi.fn() as never }), { captchaToken: 'x' });

      expect(result.nexted).toBe(false);
      expect(result.status).toBe(503);
      expect(result.payload).toMatchObject({ code: 'CAPTCHA_NOT_CONFIGURED' });
    });
  });
});
