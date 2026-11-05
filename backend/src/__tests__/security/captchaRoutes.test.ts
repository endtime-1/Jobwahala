import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The real app, with a Turnstile secret set, to prove the check really sits in front of each form.
// Cloudflare is faked: a token of "good-token" passes, anything else fails. Nothing leaves the machine.
describe('bot check on the real forms', () => {
  let server: Server;
  let base = '';
  const realFetch = globalThis.fetch;
  const cloudflareCalls: string[] = [];

  beforeAll(async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('https://challenges.cloudflare.com/')) {
        const form = init?.body as URLSearchParams;
        cloudflareCalls.push(form.get('response') ?? '');
        return new Response(JSON.stringify({ success: form.get('response') === 'good-token' }), { status: 200 });
      }
      return realFetch(input, init);
    });

    const { default: app } = await import('../../app');
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.unstubAllGlobals();
    server?.close();
  });

  const post = (path: string, body: unknown) =>
    fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const forms: [string, string, Record<string, unknown>][] = [
    ['email sign-up', '/api/auth/register', { email: 'ama@example.com', password: 'Passw0rd!Passw0rd', role: 'SEEKER' }],
    ['text-message code', '/api/auth/phone/send-code', { phone: '0241234567', purpose: 'SIGNUP' }],
    ['freelance waitlist', '/api/interest', { email: 'ama@example.com', source: 'landing_freelance_gigs' }],
  ];

  for (const [name, path, body] of forms) {
    it(`${name} asks for the check when none is sent`, async () => {
      const response = await post(path, body);

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'CAPTCHA_REQUIRED' });
    });

    it(`${name} refuses a token Cloudflare rejects`, async () => {
      const response = await post(path, { ...body, captchaToken: 'forged' });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'CAPTCHA_FAILED' });
    });
  }

  it('a good token gets past the check to the form\'s own validation (strict schemas never see the token)', async () => {
    // Invalid on purpose, so it stops at validation and never touches a database.
    const response = await post('/api/auth/phone/send-code', { phone: '0301234567', purpose: 'SIGNUP', captchaToken: 'good-token' });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBeUndefined();
    expect(body.message).toBe('Validation failed');
    expect(cloudflareCalls).toContain('good-token');
  });

  it('a good token on the waitlist also reaches validation, not a "field not allowed" error', async () => {
    const response = await post('/api/interest', { source: 'landing_freelance_gigs', captchaToken: 'good-token' });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe('Validation failed');
    expect(JSON.stringify(body.errors)).not.toMatch(/captchaToken|Unrecognized/);
  });

  it('does not put the bot check in front of things it should not slow down, like logging in by email', async () => {
    const response = await post('/api/auth/login', { email: 'not-an-email', password: 'x' });
    const body = await response.json();

    expect(body.code).toBeUndefined();
  });
});
