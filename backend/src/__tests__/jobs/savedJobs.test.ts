import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  job: { findFirst: vi.fn() },
  savedJob: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock('../../config/prisma', () => ({ default: prismaMock }));

import {
  MAX_SAVED_JOBS,
  listSavedJobIds,
  listSavedJobs,
  saveJob,
  unsaveJob,
} from '../../controllers/savedJobController';
import { savedJobParamsSchema } from '../../validation/savedJobSchemas';

const call = async (handler: (req: never, res: Response) => unknown, req: Record<string, unknown>) => {
  let status = 200;
  let payload: any;
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
  await handler({ body: {}, params: {}, query: {}, user: { id: 'seeker-1', role: 'SEEKER' }, ...req } as never, res);
  return { status, body: payload };
};

const DAY = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.job.findFirst.mockResolvedValue({ id: 'job-1' });
  prismaMock.savedJob.findUnique.mockResolvedValue(null);
  prismaMock.savedJob.count.mockResolvedValue(0);
  prismaMock.savedJob.create.mockResolvedValue({});
  prismaMock.savedJob.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.savedJob.findMany.mockResolvedValue([]);
});

describe('saving a job', () => {
  const save = () => call(saveJob as never, { params: { jobId: 'job-1' } });

  it('saves a job that is open right now', async () => {
    const result = await save();

    expect(result.status).toBe(201);
    expect(prismaMock.savedJob.create).toHaveBeenCalledWith({ data: { userId: 'seeker-1', jobId: 'job-1' } });
  });

  it('only jobs the public can see can be saved: active and not past their closing date', async () => {
    await save();

    const where = prismaMock.job.findFirst.mock.calls[0][0].where;
    expect(where.id).toBe('job-1');
    expect(where.status).toBe('ACTIVE');
    expect(where.closesAt.gt).toBeInstanceOf(Date);
  });

  it('says so when the job is gone, paused or expired, and saves nothing', async () => {
    prismaMock.job.findFirst.mockResolvedValue(null);

    const result = await save();

    expect(result.status).toBe(404);
    expect(prismaMock.savedJob.create).not.toHaveBeenCalled();
  });

  it('saving the same job twice is fine and creates no duplicate', async () => {
    prismaMock.savedJob.findUnique.mockResolvedValue({ id: 'x' });

    const result = await save();

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ saved: true });
    expect(prismaMock.savedJob.create).not.toHaveBeenCalled();
  });

  it('stops at the limit, with a message that says what to do', async () => {
    prismaMock.savedJob.count.mockResolvedValue(MAX_SAVED_JOBS);

    const result = await save();

    expect(result.status).toBe(409);
    expect(result.body.message).toMatch(/remove one/i);
    expect(prismaMock.savedJob.create).not.toHaveBeenCalled();
  });

  it('is always the signed-in member\'s own list', async () => {
    await call(saveJob as never, { params: { jobId: 'job-1' }, user: { id: 'seeker-9', role: 'SEEKER' } });

    expect(prismaMock.savedJob.findUnique.mock.calls[0][0].where).toEqual({ userId_jobId: { userId: 'seeker-9', jobId: 'job-1' } });
    expect(prismaMock.savedJob.create.mock.calls[0][0].data.userId).toBe('seeker-9');
  });
});

describe('unsaving a job', () => {
  it('removes it from the member\'s own list only', async () => {
    const result = await call(unsaveJob as never, { params: { jobId: 'job-1' } });

    expect(result.body).toMatchObject({ success: true, saved: false });
    expect(prismaMock.savedJob.deleteMany).toHaveBeenCalledWith({ where: { userId: 'seeker-1', jobId: 'job-1' } });
  });

  it('unsaving something that was never saved is fine', async () => {
    prismaMock.savedJob.deleteMany.mockResolvedValue({ count: 0 });

    expect((await call(unsaveJob as never, { params: { jobId: 'nope' } })).status).toBe(200);
  });
});

describe('the saved jobs list', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    createdAt: new Date('2026-11-01T00:00:00Z'),
    job: {
      id: 'job-1',
      title: 'Cook',
      location: 'Accra',
      type: 'Full-time',
      salary: 'GHS 3,000 a month',
      salaryMin: 3000,
      salaryMax: null,
      status: 'ACTIVE',
      closesAt: new Date(Date.now() + 5 * DAY),
      employerId: 'emp-1',
      employer: {
        employerProfile: { companyName: 'Achiba Star Hotel', logoUrl: '/logo.png' },
        verificationRequests: [{ id: 'v', status: 'APPROVED', type: 'BUSINESS' }],
      },
    },
    ...overrides,
  });

  it('lists the member\'s saved jobs, newest first, with company and verification', async () => {
    prismaMock.savedJob.findMany.mockResolvedValue([row()]);

    const result = await call(listSavedJobs as never, {});

    const query = prismaMock.savedJob.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ userId: 'seeker-1' });
    expect(query.orderBy).toEqual({ createdAt: 'desc' });
    expect(result.body.savedJobs[0]).toMatchObject({
      job: { id: 'job-1', title: 'Cook', salaryMin: 3000, isOpen: true },
      company: { id: 'emp-1', name: 'Achiba Star Hotel', logoUrl: '/logo.png', isVerified: true },
    });
  });

  it('keeps a job that has since closed or expired, marked as no longer open', async () => {
    prismaMock.savedJob.findMany.mockResolvedValue([
      row({ job: { ...row().job, status: 'PAUSED' } }),
      row({ job: { ...row().job, id: 'job-2', status: 'ACTIVE', closesAt: new Date(Date.now() - DAY) } }),
    ]);

    const result = await call(listSavedJobs as never, {});

    expect(result.body.savedJobs.map((entry: { job: { isOpen: boolean } }) => entry.job.isOpen)).toEqual([false, false]);
  });

  it('shows a company as unverified unless it has an approved verification, and never exposes request details', async () => {
    const unverified = row({ job: { ...row().job, employer: { employerProfile: null, verificationRequests: [] } } });
    prismaMock.savedJob.findMany.mockResolvedValue([unverified]);

    const result = await call(listSavedJobs as never, {});

    expect(result.body.savedJobs[0].company).toMatchObject({ name: 'An employer', isVerified: false, verificationStatus: 'UNVERIFIED' });
    expect(JSON.stringify(result.body)).not.toMatch(/documentUrl|reviewNote/);
  });

  it('the ids list is just the saved job ids', async () => {
    prismaMock.savedJob.findMany.mockResolvedValue([{ jobId: 'a' }, { jobId: 'b' }]);

    const result = await call(listSavedJobIds as never, {});

    expect(result.body.ids).toEqual(['a', 'b']);
    expect(prismaMock.savedJob.findMany.mock.calls[0][0].where).toEqual({ userId: 'seeker-1' });
  });
});

describe('validation', () => {
  it('needs a job id', () => {
    expect(savedJobParamsSchema.safeParse({ params: { jobId: 'job-1' } }).success).toBe(true);
    expect(savedJobParamsSchema.safeParse({ params: { jobId: '  ' } }).success).toBe(false);
    expect(savedJobParamsSchema.safeParse({ params: {} }).success).toBe(false);
  });
});

describe('saved job routes on the real app', () => {
  let server: Server;
  let base = '';

  beforeAll(async () => {
    const { default: app } = await import('../../app');
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server?.close();
  });

  it('are for signed-in members only', async () => {
    expect((await fetch(`${base}/api/saved-jobs`)).status).toBe(401);
    expect((await fetch(`${base}/api/saved-jobs/ids`)).status).toBe(401);
    expect((await fetch(`${base}/api/saved-jobs/job-1`, { method: 'POST' })).status).toBe(401);
    expect((await fetch(`${base}/api/saved-jobs/job-1`, { method: 'DELETE' })).status).toBe(401);
  });
});
