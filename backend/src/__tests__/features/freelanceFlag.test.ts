import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireFreelanceEnabled } from '../../middleware/featureFlags';

const run = (middleware: ReturnType<typeof requireFreelanceEnabled>, path = '/x') => {
  let status = 0;
  let body: unknown;
  let nexted = false;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  middleware({ path } as Request, res, (() => {
    nexted = true;
  }) as NextFunction);
  return { status, body, nexted };
};

describe('requireFreelanceEnabled', () => {
  it('blocks with a 404 and a clear code when the flag is off', () => {
    const result = run(requireFreelanceEnabled({ isEnabled: () => false }));
    expect(result.nexted).toBe(false);
    expect(result.status).toBe(404);
    expect(result.body).toMatchObject({ success: false, code: 'FREELANCE_DISABLED' });
  });

  it('lets requests through when the flag is on', () => {
    expect(run(requireFreelanceEnabled({ isEnabled: () => true })).nexted).toBe(true);
  });

  it('can allow named paths (the payment webhook) while off', () => {
    const guard = requireFreelanceEnabled({ isEnabled: () => false, allow: (req) => req.path.startsWith('/webhooks/') });
    expect(run(guard, '/webhooks/paystack').nexted).toBe(true);
    expect(run(guard, '/checkout').nexted).toBe(false);
  });
});

// The real app, with FREELANCE_ENABLED unset (the default): the routes must be closed on the server,
// not just hidden in the UI.
describe('freelance routes on the real app (flag off by default)', () => {
  let server: Server;
  let base = '';

  beforeAll(async () => {
    delete process.env.FREELANCE_ENABLED;
    const { default: app } = await import('../../app');
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server?.close();
  });

  const closed = ['/api/services', '/api/proposals', '/api/agreements', '/api/disputes', '/api/payments/anything', '/api/payouts/banks'];

  for (const path of closed) {
    it(`GET ${path} is blocked, even without a login`, async () => {
      const response = await fetch(base + path);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'FREELANCE_DISABLED' });
    });
  }

  it('also blocks writes to those routes', async () => {
    const response = await fetch(`${base}/api/proposals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(404);
  });

  it('still lets the payment webhook through its guard', async () => {
    const response = await fetch(`${base}/api/payments/webhooks/paystack`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const body = (await response.json().catch(() => ({}))) as { code?: string };
    expect(body.code).not.toBe('FREELANCE_DISABLED');
  });

  it('refuses freelancer sign-ups', async () => {
    const response = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'Passw0rd!Passw0rd', role: 'FREELANCER' }),
    });
    expect(response.status).toBe(403);
  });

  it('tells the website the flag is off', async () => {
    const response = await fetch(`${base}/api/platform/config`);
    expect(await response.json()).toMatchObject({ config: { freelanceEnabled: false } });
  });
});
