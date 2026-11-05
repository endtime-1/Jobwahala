import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  job: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  application: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  user: { findMany: vi.fn() },
}));
const alertsMock = vi.hoisted(() => vi.fn());

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/jobAlertService', () => ({ notifyJobAlerts: alertsMock }));

import {
  applyForJob,
  createJob,
  duplicateOwnedJob,
  extendOwnedJob,
  getJobs,
  updateOwnedJob,
  updateOwnedJobStatus,
} from '../../controllers/jobController';
import { getSitemap } from '../../controllers/shareController';

const DAY = 86_400_000;
const future = (days: number) => new Date(Date.now() + days * DAY);
const past = (days: number) => new Date(Date.now() - days * DAY);

const makeJob = (overrides: Record<string, unknown> = {}) => ({
  id: 'job-1',
  employerId: 'emp-1',
  title: 'Receptionist',
  description: 'Front desk',
  location: 'Accra',
  type: 'Full-time',
  salary: 'GHS 3,000',
  currency: 'GHS',
  category: 'Hospitality',
  status: 'ACTIVE',
  closesAt: future(10),
  expiryWarningSentAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const call = async (
  handler: (req: never, res: Response) => unknown,
  { body = {}, params = { id: 'job-1' }, userId = 'emp-1' }: { body?: unknown; params?: Record<string, string>; userId?: string } = {},
) => {
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
  await handler({ body, params, query: {}, user: { id: userId } } as never, res);
  return { status, body: payload };
};

const applicationsUntouched = () => {
  for (const fn of Object.values(prismaMock.application)) expect(fn).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.job.update.mockImplementation(async ({ data }: { data: object }) => ({ ...makeJob(), ...data }));
  prismaMock.job.create.mockImplementation(async ({ data }: { data: object }) => ({ ...makeJob(), id: 'new-job', ...data }));
});

describe('creating a job', () => {
  const body = { title: 'Cook', description: 'Kitchen work', type: 'Full-time' };

  it('publishes with a closing date 30 days out by default, and sends alerts', async () => {
    const result = await call(createJob as never, { body });

    expect(result.status).toBe(201);
    const data = prismaMock.job.create.mock.calls[0][0].data;
    expect(data.status).toBe('ACTIVE');
    expect(Math.abs(data.closesAt.getTime() - future(30).getTime())).toBeLessThan(5000);
    expect(alertsMock).toHaveBeenCalledTimes(1);
  });

  it('saves a draft privately: no alerts', async () => {
    const result = await call(createJob as never, { body: { ...body, status: 'DRAFT' } });

    expect(result.status).toBe(201);
    expect(prismaMock.job.create.mock.calls[0][0].data.status).toBe('DRAFT');
    expect(alertsMock).not.toHaveBeenCalled();
  });

  it('takes a chosen closing date up to 90 days away', async () => {
    const day = future(60).toISOString().slice(0, 10);
    await call(createJob as never, { body: { ...body, closesAt: day } });

    expect(prismaMock.job.create.mock.calls[0][0].data.closesAt.toISOString().slice(0, 10)).toBe(day);
  });

  it('refuses a closing date past 90 days or in the past', async () => {
    const tooFar = await call(createJob as never, { body: { ...body, closesAt: future(120).toISOString().slice(0, 10) } });
    const earlier = await call(createJob as never, { body: { ...body, closesAt: past(2).toISOString().slice(0, 10) } });

    expect(tooFar.status).toBe(400);
    expect(tooFar.body.message).toMatch(/90 days/);
    expect(earlier.status).toBe(400);
    expect(prismaMock.job.create).not.toHaveBeenCalled();
  });
});

describe('pausing, resuming, closing', () => {
  it('pauses an active job and keeps all applicants', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob());

    const result = await call(updateOwnedJobStatus as never, { body: { status: 'PAUSED' } });

    expect(result.status).toBe(200);
    expect(prismaMock.job.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { status: 'PAUSED' } });
    applicationsUntouched();
  });

  it('closes a job and keeps all applicants', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob());

    await call(updateOwnedJobStatus as never, { body: { status: 'CLOSED' } });

    expect(prismaMock.job.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { status: 'CLOSED' } });
    applicationsUntouched();
  });

  it('resumes a paused job without sending alerts again', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ status: 'PAUSED' }));

    const result = await call(updateOwnedJobStatus as never, { body: { status: 'ACTIVE' } });

    expect(result.status).toBe(200);
    expect(alertsMock).not.toHaveBeenCalled();
  });

  it('will not resume a job whose closing date has passed', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ status: 'PAUSED', closesAt: past(1) }));

    const result = await call(updateOwnedJobStatus as never, { body: { status: 'ACTIVE' } });

    expect(result.status).toBe(409);
    expect(result.body.message).toMatch(/closing date/i);
    expect(prismaMock.job.update).not.toHaveBeenCalled();
  });

  it('publishing a draft sends alerts once', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ status: 'DRAFT' }));

    await call(updateOwnedJobStatus as never, { body: { status: 'ACTIVE' } });

    expect(alertsMock).toHaveBeenCalledTimes(1);
  });

  it('will not reopen an expired job by status, only by extending', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ status: 'EXPIRED', closesAt: past(2) }));

    const result = await call(updateOwnedJobStatus as never, { body: { status: 'ACTIVE' } });

    expect(result.status).toBe(409);
    expect(result.body.message).toMatch(/extend/i);
  });

  it('lets an employer neither unflag nor unsuspend their own job', async () => {
    for (const status of ['FLAGGED', 'SUSPENDED']) {
      prismaMock.job.findUnique.mockResolvedValue(makeJob({ status }));
      const result = await call(updateOwnedJobStatus as never, { body: { status: 'ACTIVE' } });
      expect(result.status).toBe(409);
    }
    expect(prismaMock.job.update).not.toHaveBeenCalled();
  });

  it('refuses another employers job', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ employerId: 'someone-else' }));

    const result = await call(updateOwnedJobStatus as never, { body: { status: 'PAUSED' } });

    expect(result.status).toBe(403);
  });
});

describe('editing a job', () => {
  it('changes only the fields sent, and an empty optional field clears it', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ status: 'PAUSED' }));

    const result = await call(updateOwnedJob as never, { body: { title: '  Head Receptionist ', salary: '' } });

    expect(result.status).toBe(200);
    // Clearing the pay text also clears the pay numbers, so they cannot disagree.
    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { title: 'Head Receptionist', salary: null, salaryMin: null, salaryMax: null, salaryParsedAt: expect.any(Date) },
    });
    applicationsUntouched();
  });

  it('validates a new closing date and resets the expiry warning', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ expiryWarningSentAt: new Date() }));
    const day = future(20).toISOString().slice(0, 10);

    await call(updateOwnedJob as never, { body: { closesAt: day } });

    const data = prismaMock.job.update.mock.calls[0][0].data;
    expect(data.closesAt.toISOString().slice(0, 10)).toBe(day);
    expect(data.expiryWarningSentAt).toBeNull();

    const tooFar = await call(updateOwnedJob as never, { body: { closesAt: future(200).toISOString().slice(0, 10) } });
    expect(tooFar.status).toBe(400);
  });

  it('sends expired jobs to Extend instead of letting the date be edited', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ status: 'EXPIRED', closesAt: past(1) }));

    const result = await call(updateOwnedJob as never, { body: { closesAt: future(10).toISOString().slice(0, 10) } });

    expect(result.status).toBe(409);
  });

  it('keeps moderated jobs read-only for the employer', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ status: 'SUSPENDED' }));

    const result = await call(updateOwnedJob as never, { body: { title: 'New title' } });

    expect(result.status).toBe(409);
    expect(prismaMock.job.update).not.toHaveBeenCalled();
  });
});

describe('duplicating a job', () => {
  it('creates a private draft copy with a fresh 30 day closing date', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ status: 'CLOSED', closesAt: past(5) }));

    const result = await call(duplicateOwnedJob as never);

    expect(result.status).toBe(201);
    const data = prismaMock.job.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: 'DRAFT',
      title: 'Receptionist',
      description: 'Front desk',
      location: 'Accra',
      type: 'Full-time',
      salary: 'GHS 3,000',
      category: 'Hospitality',
      employerId: 'emp-1',
    });
    expect(Math.abs(data.closesAt.getTime() - future(30).getTime())).toBeLessThan(5000);
    expect(alertsMock).not.toHaveBeenCalled();
    applicationsUntouched();
  });

  it('refuses to copy a job from another employer or one under moderation', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ employerId: 'other' }));
    expect((await call(duplicateOwnedJob as never)).status).toBe(403);

    prismaMock.job.findUnique.mockResolvedValue(makeJob({ status: 'FLAGGED' }));
    expect((await call(duplicateOwnedJob as never)).status).toBe(409);
    expect(prismaMock.job.create).not.toHaveBeenCalled();
  });
});

describe('extending a job', () => {
  it('opens an expired job again with a later closing date and a fresh warning', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ status: 'EXPIRED', closesAt: past(1), expiryWarningSentAt: past(4) }));

    const result = await call(extendOwnedJob as never, { body: { days: 14 } });

    expect(result.status).toBe(200);
    const data = prismaMock.job.update.mock.calls[0][0].data;
    expect(data.status).toBe('ACTIVE');
    expect(data.expiryWarningSentAt).toBeNull();
    expect(data.closesAt.getTime()).toBeGreaterThan(future(13).getTime());
    applicationsUntouched();
  });

  it('keeps a paused or closed job paused or closed', async () => {
    for (const status of ['PAUSED', 'CLOSED']) {
      prismaMock.job.update.mockClear();
      prismaMock.job.findUnique.mockResolvedValue(makeJob({ status, closesAt: future(1) }));

      await call(extendOwnedJob as never, { body: { days: 30 } });

      expect(prismaMock.job.update.mock.calls[0][0].data).not.toHaveProperty('status');
    }
  });

  it('defaults to 30 days and never allows more than 90', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ closesAt: future(1) }));

    await call(extendOwnedJob as never, { body: {} });
    expect(prismaMock.job.update.mock.calls[0][0].data.closesAt.getTime()).toBeGreaterThan(future(29).getTime());

    const tooMany = await call(extendOwnedJob as never, { body: { days: 120 } });
    expect(tooMany.status).toBe(400);
  });

  it('will not shorten the closing date', async () => {
    prismaMock.job.findUnique.mockResolvedValue(makeJob({ closesAt: future(40) }));

    const result = await call(extendOwnedJob as never, { body: { days: 7 } });

    expect(result.status).toBe(400);
    expect(prismaMock.job.update).not.toHaveBeenCalled();
  });
});

describe('what the public sees', () => {
  const isPublicFilter = (where: any) => {
    expect(where.status).toBe('ACTIVE');
    expect(where.closesAt.gt).toBeInstanceOf(Date);
    expect(Math.abs(where.closesAt.gt.getTime() - Date.now())).toBeLessThan(5000);
  };

  it('search lists only ACTIVE jobs that have not passed their closing date', async () => {
    prismaMock.job.findMany.mockResolvedValue([]);

    await call(getJobs as never);

    isPublicFilter(prismaMock.job.findMany.mock.calls[0][0].where);
  });

  it('applying is only possible on a public job', async () => {
    prismaMock.job.findFirst.mockResolvedValue(null);

    const result = await call(applyForJob as never, { body: {}, userId: 'seeker-1' });

    expect(result.status).toBe(404);
    isPublicFilter(prismaMock.job.findFirst.mock.calls[0][0].where);
  });

  it('the sitemap lists only public jobs', async () => {
    prismaMock.job.findMany.mockResolvedValue([]);
    const req = { get: () => undefined, protocol: 'https' } as unknown as Request;
    const res = { type: () => res, set: () => res, send: () => res, status: () => res } as unknown as Response;

    await getSitemap(req, res);

    isPublicFilter(prismaMock.job.findMany.mock.calls[0][0].where);
  });
});
