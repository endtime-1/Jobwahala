import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    job: { findUnique: vi.fn() },
    application: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    applicationReview: { upsert: vi.fn() },
    agreement: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    proposal: { updateMany: vi.fn() },
    employerProfile: { findUnique: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
const emailMock = vi.hoisted(() => ({ status: vi.fn() }));

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));
vi.mock('../../services/emailService', () => ({ sendApplicationStatusEmail: emailMock.status }));

import { bulkRejectApplicants, getJobApplicants, reviewApplication } from '../../controllers/jobController';
import { applicationReviewSchema, bulkRejectSchema } from '../../validation/jobSchemas';

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
  await handler({ body: {}, params: {}, query: {}, user: { id: 'emp-1', role: 'EMPLOYER' }, ...req } as never, res);
  return { status, body: payload };
};

const applicationRow = (id: string, status = 'SUBMITTED', employerId = 'emp-1') => ({
  id,
  jobId: 'job-1',
  seekerId: `seeker-${id}`,
  status,
  coverLetter: null,
  firstRespondedAt: null,
  createdAt: new Date(Date.now() - 3_600_000),
  seeker: { id: `seeker-${id}`, email: `${id}@example.com` },
  job: { employerId, title: 'Hotel Receptionist', salary: null, employer: { employerProfile: { companyName: 'Achiba Star Hotel' } } },
});

const rows: Record<string, ReturnType<typeof applicationRow>> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(rows)) delete rows[key];
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
  prismaMock.agreement.findUnique.mockResolvedValue(null);
  prismaMock.employerProfile.findUnique.mockResolvedValue({ avgResponseHours: null, responseCount: 0 });
  prismaMock.notification.create.mockResolvedValue({ id: 'n' });
  emailMock.status.mockResolvedValue(undefined);
  prismaMock.job.findUnique.mockResolvedValue({ employerId: 'emp-1' });
  prismaMock.application.findMany.mockImplementation(async ({ where }: { where: { id?: { in: string[] } } }) =>
    (where.id?.in ?? []).filter((id) => rows[id]).map((id) => ({ id, status: rows[id].status })),
  );
  prismaMock.application.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => rows[where.id] ?? null);
  prismaMock.application.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: object }) => ({ ...rows[where.id], ...data }));
});

describe('private notes and rating', () => {
  const review = (body: Record<string, unknown>, userId = 'emp-1') =>
    call(reviewApplication as never, { params: { applicationId: 'a1' }, body, user: { id: userId } });

  beforeEach(() => {
    rows.a1 = applicationRow('a1');
    prismaMock.applicationReview.upsert.mockImplementation(async ({ create }: { create: object }) => ({ ...create, updatedAt: new Date() }));
  });

  it('saves a rating and a note for the employer who owns the job', async () => {
    const result = await review({ rating: 4, note: 'Strong on the phone. Ask about weekends.' });

    expect(result.status).toBe(200);
    expect(prismaMock.applicationReview.upsert.mock.calls[0][0]).toMatchObject({
      where: { applicationId: 'a1' },
      create: { applicationId: 'a1', employerId: 'emp-1', rating: 4, note: 'Strong on the phone. Ask about weekends.' },
      update: { rating: 4, note: 'Strong on the phone. Ask about weekends.' },
    });
  });

  it('changes only what was sent: a rating alone leaves the note alone', async () => {
    await review({ rating: 5 });

    expect(prismaMock.applicationReview.upsert.mock.calls[0][0].update).toEqual({ rating: 5 });
  });

  it('an empty note clears the note, and null clears the rating', async () => {
    await review({ note: '', rating: null });

    expect(prismaMock.applicationReview.upsert.mock.calls[0][0].update).toEqual({ note: null, rating: null });
  });

  it('refuses an employer who does not own the job, and saves nothing', async () => {
    const result = await review({ rating: 1 }, 'someone-else');

    expect(result.status).toBe(403);
    expect(prismaMock.applicationReview.upsert).not.toHaveBeenCalled();
  });

  it('refuses an application that does not exist', async () => {
    delete rows.a1;

    expect((await review({ rating: 3 })).status).toBe(403);
  });

  it('only accepts whole stars from 1 to 5 and notes up to 2000 characters', () => {
    const parse = (body: unknown) => applicationReviewSchema.safeParse({ body, params: { applicationId: 'a1' } }).success;

    expect(parse({ rating: 1 })).toBe(true);
    expect(parse({ rating: 5 })).toBe(true);
    expect(parse({ rating: null })).toBe(true);
    expect(parse({ rating: 0 })).toBe(false);
    expect(parse({ rating: 6 })).toBe(false);
    expect(parse({ rating: 3.5 })).toBe(false);
    expect(parse({ note: 'x'.repeat(2000) })).toBe(true);
    expect(parse({ note: 'x'.repeat(2001) })).toBe(false);
    expect(parse({})).toBe(false);
    expect(parse({ rating: 3, somethingElse: true })).toBe(false);
  });
});

describe('the notes never reach the applicant', () => {
  it('only the job owner\'s applicant list asks for them', async () => {
    prismaMock.application.findMany.mockResolvedValue([]);

    await call(getJobApplicants as never, { params: { id: 'job-1' } });

    expect(prismaMock.application.findMany.mock.calls[0][0].include.review).toBeDefined();
  });

  it('the applicant\'s own application list does not select them', async () => {
    const { listMyApplications } = await import('../../controllers/applicationController');
    prismaMock.application.findMany.mockResolvedValue([]);

    await call(listMyApplications as never, { user: { id: 'seeker-1', role: 'SEEKER' } });

    const args = JSON.stringify(prismaMock.application.findMany.mock.calls[0][0]);
    expect(args).not.toMatch(/review|note|rating/i);
  });
});

describe('rejecting several applicants at once', () => {
  const bulk = (ids: string[], userId = 'emp-1') =>
    call(bulkRejectApplicants as never, { params: { id: 'job-1' }, body: { applicationIds: ids }, user: { id: userId } });

  it('turns each one down with the same polite notification and email as a single rejection', async () => {
    rows.a1 = applicationRow('a1');
    rows.a2 = applicationRow('a2', 'SHORTLISTED');

    const result = await bulk(['a1', 'a2']);

    expect(result.body).toMatchObject({ success: true, rejected: ['a1', 'a2'], skipped: [] });
    expect(prismaMock.application.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.application.update.mock.calls[0][0].data.status).toBe('REJECTED');
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.notification.create.mock.calls.map((c: any[]) => c[0].data.userId)).toEqual(['seeker-a1', 'seeker-a2']);
    for (const call of prismaMock.notification.create.mock.calls) {
      expect(call[0].data.message).toMatch(/thank you for applying/i);
      expect(call[0].data.message).toMatch(/not the news you hoped for/i);
    }
    expect(emailMock.status).toHaveBeenCalledTimes(2);
    expect(emailMock.status.mock.calls[0][0]).toBe('a1@example.com');
    expect(emailMock.status.mock.calls[0][1].message).toMatch(/thank you for applying/i);
  });

  it('leaves hired people and already-turned-down people alone, and says so', async () => {
    rows.a1 = applicationRow('a1', 'HIRED');
    rows.a2 = applicationRow('a2', 'REJECTED');
    rows.a3 = applicationRow('a3');

    const result = await bulk(['a1', 'a2', 'a3']);

    expect(result.body.rejected).toEqual(['a3']);
    expect(result.body.skipped).toEqual([
      { id: 'a1', reason: 'Already hired' },
      { id: 'a2', reason: 'Already turned down' },
    ]);
    expect(prismaMock.application.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
  });

  it('skips ids that are not applicants of this job, and counts a repeated id once', async () => {
    rows.a1 = applicationRow('a1');

    const result = await bulk(['a1', 'a1', 'nope']);

    expect(result.body.rejected).toEqual(['a1']);
    expect(result.body.skipped).toEqual([{ id: 'nope', reason: 'Not an applicant for this job' }]);
    expect(emailMock.status).toHaveBeenCalledTimes(1);
  });

  it('only looks inside this job', async () => {
    rows.a1 = applicationRow('a1');

    await bulk(['a1']);

    expect(prismaMock.application.findMany.mock.calls[0][0].where).toMatchObject({ jobId: 'job-1' });
  });

  it('refuses an employer who does not own the job, and changes nothing', async () => {
    rows.a1 = applicationRow('a1');

    const result = await bulk(['a1'], 'someone-else');

    expect(result.status).toBe(403);
    expect(prismaMock.application.update).not.toHaveBeenCalled();
    expect(emailMock.status).not.toHaveBeenCalled();
  });

  it('keeps going and reports the one it could not change when a single application is blocked', async () => {
    rows.a1 = applicationRow('a1');
    rows.a2 = applicationRow('a2');
    prismaMock.agreement.findUnique.mockImplementation(async ({ where }: { where: { applicationId: string } }) =>
      where.applicationId === 'a1' ? { id: 'ag', status: 'COMPLETED' } : null,
    );

    const result = await bulk(['a1', 'a2']);

    expect(result.body.rejected).toEqual(['a2']);
    expect(result.body.skipped).toHaveLength(1);
    expect(result.body.skipped[0].id).toBe('a1');
  });

  it('is limited to 100 at a time and needs at least one', () => {
    const parse = (ids: string[]) => bulkRejectSchema.safeParse({ body: { applicationIds: ids }, params: { id: 'job-1' } }).success;

    expect(parse(['a'])).toBe(true);
    expect(parse(Array.from({ length: 100 }, (_, i) => `a${i}`))).toBe(true);
    expect(parse(Array.from({ length: 101 }, (_, i) => `a${i}`))).toBe(false);
    expect(parse([])).toBe(false);
  });
});
