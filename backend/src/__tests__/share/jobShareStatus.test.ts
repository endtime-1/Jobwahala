import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({ job: { findFirst: vi.fn(), findUnique: vi.fn() } }));
vi.mock('../../config/prisma', () => ({ default: prismaMock }));

import { getJobSharePage } from '../../controllers/shareController';

const respond = () => {
  const out = { status: 200, body: '' };
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    type() {
      return this;
    },
    set() {
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

describe('job pages for crawlers: what status a missing job gets', () => {
  it('answers 404 for an id that never existed', async () => {
    prismaMock.job.findFirst.mockResolvedValue(null);
    prismaMock.job.findUnique.mockResolvedValue(null);
    const { res, out } = respond();

    await getJobSharePage(request('never-existed'), res);

    expect(out.status).toBe(404);
  });

  it('answers 410 (gone) for a job that existed but is expired, closed or removed', async () => {
    prismaMock.job.findFirst.mockResolvedValue(null);
    prismaMock.job.findUnique.mockResolvedValue({ id: 'old-job' });
    const { res, out } = respond();

    await getJobSharePage(request('old-job'), res);

    expect(out.status).toBe(410);
  });
});
