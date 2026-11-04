import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    application: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    agreement: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    proposal: { updateMany: vi.fn() },
    employerProfile: { findUnique: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
const emailMock = vi.hoisted(() => ({ status: vi.fn(), reminder: vi.fn() }));

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));
vi.mock('../../services/emailService', () => ({
  sendApplicationStatusEmail: emailMock.status,
  sendApplicationReminderEmail: emailMock.reminder,
}));

import { listMyApplications } from '../../controllers/applicationController';
import { updateApplicationStatus } from '../../controllers/jobController';
import { runApplicationReminders } from '../../services/applicationReminderService';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const makeApplication = (overrides: Record<string, unknown> = {}) => ({
  id: 'app-1',
  jobId: 'job-1',
  seekerId: 'seeker-1',
  status: 'SUBMITTED',
  coverLetter: null,
  firstRespondedAt: null,
  createdAt: new Date(Date.now() - 6 * HOUR),
  seeker: { id: 'seeker-1', email: 'ama@example.com' },
  job: {
    employerId: 'emp-1',
    title: 'Hotel Receptionist',
    salary: null,
    employer: { employerProfile: { companyName: 'Achiba Star Hotel' } },
  },
  ...overrides,
});

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
  await handler(req as never, res);
  return { status, body: payload };
};

const move = (status: string, userId = 'emp-1') =>
  call(updateApplicationStatus as never, { params: { applicationId: 'app-1' }, body: { status }, user: { id: userId } });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
  prismaMock.agreement.findUnique.mockResolvedValue(null);
  prismaMock.application.update.mockImplementation(async ({ data }: { data: object }) => ({ ...makeApplication(), ...data }));
  prismaMock.employerProfile.findUnique.mockResolvedValue({ avgResponseHours: null, responseCount: 0 });
  prismaMock.notification.create.mockResolvedValue({ id: 'n-1' });
  emailMock.status.mockResolvedValue(undefined);
  prismaMock.application.findUnique.mockResolvedValue(makeApplication());
});

describe('telling the applicant when their status changes', () => {
  it.each(['SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED'])(
    'notifies in the app and by email when moved to %s',
    async (status) => {
      const result = await move(status);

      expect(result.status).toBe(200);
      expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({
        userId: 'seeker-1',
        type: 'APPLICATION_STATUS',
        actionUrl: '/applications',
      });
      expect(emailMock.status).toHaveBeenCalledTimes(1);
      expect(emailMock.status).toHaveBeenCalledWith(
        'ama@example.com',
        expect.objectContaining({ jobTitle: 'Hotel Receptionist', company: 'Achiba Star Hotel' }),
      );
    },
  );

  it('uses the polite message for a rejection', async () => {
    await move('REJECTED');

    const sent = emailMock.status.mock.calls[0][1];
    expect(sent.message).toMatch(/thank you for applying/i);
    expect(prismaMock.notification.create.mock.calls[0][0].data.message).toMatch(/not the news you hoped for/i);
  });

  it('says nothing when an application is moved back to New', async () => {
    prismaMock.application.findUnique.mockResolvedValue(makeApplication({ status: 'SHORTLISTED' }));

    await move('SUBMITTED');

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(emailMock.status).not.toHaveBeenCalled();
  });

  it('does nothing, and tells nobody, when the status has not changed', async () => {
    prismaMock.application.findUnique.mockResolvedValue(makeApplication({ status: 'SHORTLISTED' }));

    const result = await move('SHORTLISTED');

    expect(result.status).toBe(200);
    expect(prismaMock.application.update).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(emailMock.status).not.toHaveBeenCalled();
  });

  it('still saves the change if the email cannot be sent', async () => {
    emailMock.status.mockRejectedValue(new Error('smtp down'));

    const result = await move('SHORTLISTED');

    expect(result.status).toBe(200);
    expect(prismaMock.application.update).toHaveBeenCalled();
  });

  it('refuses another employer and notifies nobody', async () => {
    const result = await move('SHORTLISTED', 'someone-else');

    expect(result.status).toBe(403);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(emailMock.status).not.toHaveBeenCalled();
  });

  it('records when the status last changed', async () => {
    await move('INTERVIEW');

    const data = prismaMock.application.update.mock.calls[0][0].data;
    expect(data.status).toBe('INTERVIEW');
    expect(data.statusChangedAt).toBeInstanceOf(Date);
  });
});

describe('tracking how fast employers respond', () => {
  it('stores the first response time on the application and on the employer', async () => {
    await move('SHORTLISTED');

    const data = prismaMock.application.update.mock.calls[0][0].data;
    expect(data.firstRespondedAt).toBeInstanceOf(Date);
    expect(prismaMock.employerProfile.update).toHaveBeenCalledTimes(1);
    const stats = prismaMock.employerProfile.update.mock.calls[0][0];
    expect(stats.where).toEqual({ userId: 'emp-1' });
    expect(stats.data.responseCount).toBe(1);
    expect(stats.data.avgResponseHours).toBeCloseTo(6, 0);
  });

  it('folds into the employer running average', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ avgResponseHours: 10, responseCount: 3 });
    prismaMock.application.findUnique.mockResolvedValue(makeApplication({ createdAt: new Date(Date.now() - 2 * HOUR) }));

    await move('REJECTED');

    const data = prismaMock.employerProfile.update.mock.calls[0][0].data;
    expect(data.responseCount).toBe(4);
    expect(data.avgResponseHours).toBeCloseTo(8, 0);
  });

  it('counts a rejection as a response too', async () => {
    await move('REJECTED');

    expect(prismaMock.employerProfile.update).toHaveBeenCalledTimes(1);
  });

  it('does not count later moves', async () => {
    prismaMock.application.findUnique.mockResolvedValue(
      makeApplication({ status: 'SHORTLISTED', firstRespondedAt: new Date(Date.now() - HOUR) }),
    );

    await move('INTERVIEW');

    expect(prismaMock.employerProfile.update).not.toHaveBeenCalled();
    expect(prismaMock.application.update.mock.calls[0][0].data).not.toHaveProperty('firstRespondedAt');
  });

  it('does not count moving something back to New', async () => {
    prismaMock.application.findUnique.mockResolvedValue(makeApplication({ status: 'SHORTLISTED' }));

    await move('SUBMITTED');

    expect(prismaMock.employerProfile.update).not.toHaveBeenCalled();
  });
});

describe('My applications', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'app-1',
    status: 'INTERVIEW',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-02T00:00:00.000Z'),
    statusChangedAt: new Date('2026-10-05T00:00:00.000Z'),
    job: {
      id: 'job-1',
      title: 'Hotel Receptionist',
      location: 'Kumasi',
      type: 'Full-time',
      status: 'ACTIVE',
      closesAt: new Date(Date.now() + 5 * DAY),
      employerId: 'emp-1',
      employer: { employerProfile: { companyName: 'Achiba Star Hotel', logoUrl: '/logo.png' } },
    },
    ...overrides,
  });

  it('lists every application with job, company, date applied, status and last change', async () => {
    prismaMock.application.findMany.mockResolvedValue([row()]);

    const result = await call(listMyApplications as never, { user: { id: 'seeker-1' } });

    expect(prismaMock.application.findMany.mock.calls[0][0].where).toEqual({ seekerId: 'seeker-1' });
    expect(result.body.applications).toHaveLength(1);
    expect(result.body.applications[0]).toMatchObject({
      id: 'app-1',
      status: 'INTERVIEW',
      statusLabel: 'Interview',
      appliedAt: new Date('2026-10-01T00:00:00.000Z'),
      lastChangedAt: new Date('2026-10-05T00:00:00.000Z'),
      job: { id: 'job-1', title: 'Hotel Receptionist', isOpen: true },
      company: { id: 'emp-1', name: 'Achiba Star Hotel', logoUrl: '/logo.png' },
    });
  });

  it('shows New for SUBMITTED, falls back to updatedAt, and still lists jobs that have closed', async () => {
    prismaMock.application.findMany.mockResolvedValue([
      row({
        status: 'SUBMITTED',
        statusChangedAt: null,
        job: { ...row().job, status: 'EXPIRED', closesAt: new Date(Date.now() - DAY) },
      }),
    ]);

    const result = await call(listMyApplications as never, { user: { id: 'seeker-1' } });
    const application = result.body.applications[0];

    expect(application.statusLabel).toBe('New');
    expect(application.lastChangedAt).toEqual(new Date('2026-10-02T00:00:00.000Z'));
    expect(application.job.isOpen).toBe(false);
  });

  it('does not leak other details such as the employer email', async () => {
    prismaMock.application.findMany.mockResolvedValue([row()]);

    const result = await call(listMyApplications as never, { user: { id: 'seeker-1' } });

    expect(JSON.stringify(result.body)).not.toMatch(/email/i);
  });
});

describe('reminding employers about applications left in New', () => {
  const now = new Date('2026-11-20T12:00:00.000Z');
  const stale = (id: string, jobId: string, title: string, employerId = 'emp-1', extra: Record<string, unknown> = {}) => ({
    id,
    job: { id: jobId, title, employerId, employer: { email: `${employerId}@example.com`, status: 'ACTIVE', ...extra } },
  });

  beforeEach(() => {
    emailMock.reminder.mockResolvedValue(undefined);
    prismaMock.application.updateMany.mockImplementation(async ({ where }: any) => ({ count: where.id.in.length }));
  });

  it('looks for applications still New after 14 days that were never reminded', async () => {
    prismaMock.application.findMany.mockResolvedValue([]);

    await runApplicationReminders(now);

    expect(prismaMock.application.findMany.mock.calls[0][0].where).toEqual({
      status: 'SUBMITTED',
      createdAt: { lte: new Date('2026-11-06T12:00:00.000Z') },
      newReminderSentAt: null,
    });
  });

  it('sends one email per employer covering all their waiting applicants', async () => {
    prismaMock.application.findMany.mockResolvedValue([
      stale('a1', 'job-1', 'Receptionist'),
      stale('a2', 'job-1', 'Receptionist'),
      stale('a3', 'job-2', 'Cook'),
      stale('b1', 'job-9', 'Driver', 'emp-2'),
    ]);

    const result = await runApplicationReminders(now);

    expect(result).toEqual({ employers: 2, applications: 4 });
    expect(emailMock.reminder).toHaveBeenCalledTimes(2);
    expect(emailMock.reminder).toHaveBeenCalledWith('emp-1@example.com', {
      waiting: 3,
      days: 14,
      jobs: [
        { title: 'Receptionist', waiting: 2 },
        { title: 'Cook', waiting: 1 },
      ],
    });
  });

  it('marks the applications as reminded so the next run stays quiet', async () => {
    prismaMock.application.findMany.mockResolvedValue([stale('a1', 'job-1', 'Receptionist')]);

    await runApplicationReminders(now);

    expect(prismaMock.application.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a1'] }, newReminderSentAt: null },
      data: { newReminderSentAt: now },
    });
  });

  it('does not send when another run already claimed them', async () => {
    prismaMock.application.findMany.mockResolvedValue([stale('a1', 'job-1', 'Receptionist')]);
    prismaMock.application.updateMany.mockResolvedValue({ count: 0 });

    const result = await runApplicationReminders(now);

    expect(result.employers).toBe(0);
    expect(emailMock.reminder).not.toHaveBeenCalled();
  });

  it('skips suspended employers', async () => {
    prismaMock.application.findMany.mockResolvedValue([stale('a1', 'job-1', 'Receptionist', 'emp-1', { status: 'SUSPENDED' })]);

    await runApplicationReminders(now);

    expect(emailMock.reminder).not.toHaveBeenCalled();
  });

  it('lets tomorrow try again when the email fails', async () => {
    prismaMock.application.findMany.mockResolvedValue([stale('a1', 'job-1', 'Receptionist')]);
    emailMock.reminder.mockRejectedValue(new Error('smtp down'));

    const result = await runApplicationReminders(now);

    expect(result.employers).toBe(0);
    expect(prismaMock.application.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: ['a1'] } },
      data: { newReminderSentAt: null },
    });
  });
});
