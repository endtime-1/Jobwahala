import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({ user: { findFirst: vi.fn() } }));
vi.mock('../../config/prisma', () => ({ default: prismaMock }));

import { getCompanySharePage } from '../../controllers/shareController';

const respond = () => {
  const out: { status: number; body: string; headers: Record<string, string> } = { status: 200, body: '', headers: {} };
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    type() {
      return this;
    },
    set(name: string, value: string) {
      out.headers[name] = value;
      return this;
    },
    send(body: string) {
      out.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, out };
};

const request = (id: string) => ({ params: { id }, protocol: 'https', get: (name: string) => (name === 'host' ? 'www.jobwahala.com' : undefined) }) as unknown as Request;

beforeEach(() => vi.clearAllMocks());

describe('the company page for crawlers', () => {
  it('shows the company, whether it is verified, and its open jobs, from public data only', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'emp-1',
      employerProfile: { companyName: 'Akoko Solutions LTD', industry: 'Production', description: 'Poultry feed.', logoUrl: null },
      verificationRequests: [],
      jobsPosted: [{ id: 'job-1', title: 'B2B SALES EXECUTIVE', location: 'Kumasi', type: 'Full-time' }],
    });
    const { res, out } = respond();

    await getCompanySharePage(request('emp-1'), res);

    expect(out.status).toBe(200);
    expect(out.body).toContain('Akoko Solutions LTD Jobs &amp; Company Profile');
    expect(out.body).toContain('Unverified employer');
    expect(out.body).toContain('B2B SALES EXECUTIVE');
    expect(prismaMock.user.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'emp-1', role: 'EMPLOYER', status: 'ACTIVE' });
    // Nothing private is even asked for.
    expect(JSON.stringify(prismaMock.user.findFirst.mock.calls[0][0].select)).not.toMatch(/email|phone|password/i);
  });

  it('answers 404 for a company that does not exist or is not active', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    const { res, out } = respond();

    await getCompanySharePage(request('nope'), res);

    expect(out.status).toBe(404);
  });
});
