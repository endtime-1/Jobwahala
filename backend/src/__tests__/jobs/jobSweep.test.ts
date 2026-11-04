import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  job: { updateMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  application: { updateMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
}));
const sendMock = vi.hoisted(() => vi.fn());

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/emailService', () => ({ sendJobExpiryWarningEmail: sendMock }));

import { runJobLifecycleSweep } from '../../services/jobLifecycleService';

const now = new Date('2026-11-04T10:00:00.000Z');
const soonJob = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: 'Receptionist',
  closesAt: new Date('2026-11-07T09:00:00.000Z'),
  employer: { email: 'boss@example.com', status: 'ACTIVE', employerProfile: { companyName: 'Achiba Star Hotel' } },
  ...extra,
});

describe('runJobLifecycleSweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.job.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.job.findMany.mockResolvedValue([]);
    sendMock.mockResolvedValue(undefined);
  });

  it('marks ACTIVE and PAUSED jobs past their closing date as EXPIRED, and nothing else', async () => {
    prismaMock.job.updateMany.mockResolvedValueOnce({ count: 4 });

    const result = await runJobLifecycleSweep(now);

    expect(result.expired).toBe(4);
    expect(prismaMock.job.updateMany).toHaveBeenNthCalledWith(1, {
      where: { status: { in: ['ACTIVE', 'PAUSED'] }, closesAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
  });

  it('keeps every applicant: it never touches applications', async () => {
    prismaMock.job.updateMany.mockResolvedValueOnce({ count: 2 });

    await runJobLifecycleSweep(now);

    for (const fn of Object.values(prismaMock.application)) expect(fn).not.toHaveBeenCalled();
  });

  it('looks for ACTIVE jobs closing within 3 days that have not been warned', async () => {
    await runJobLifecycleSweep(now);

    expect(prismaMock.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          closesAt: { gt: now, lte: new Date('2026-11-07T10:00:00.000Z') },
          expiryWarningSentAt: null,
        },
      }),
    );
  });

  it('emails the employer once, with a link to extend', async () => {
    prismaMock.job.findMany.mockResolvedValue([soonJob('job-1')]);
    prismaMock.job.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    const result = await runJobLifecycleSweep(now);

    expect(result.warned).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      'boss@example.com',
      expect.objectContaining({ title: 'Receptionist', extendUrl: expect.stringContaining('/dashboard?extend=job-1') }),
    );
    expect(prismaMock.job.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'job-1', expiryWarningSentAt: null },
      data: { expiryWarningSentAt: now },
    });
  });

  it('does not send twice when another run already claimed the warning', async () => {
    prismaMock.job.findMany.mockResolvedValue([soonJob('job-1')]);
    prismaMock.job.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });

    const result = await runJobLifecycleSweep(now);

    expect(result.warned).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips suspended employers', async () => {
    prismaMock.job.findMany.mockResolvedValue([
      soonJob('job-1', { employer: { email: 'x@example.com', status: 'SUSPENDED', employerProfile: null } }),
    ]);

    await runJobLifecycleSweep(now);

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('releases the claim when the email fails so tomorrow tries again', async () => {
    prismaMock.job.findMany.mockResolvedValue([soonJob('job-1')]);
    prismaMock.job.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    prismaMock.job.update.mockResolvedValue({});
    sendMock.mockRejectedValue(new Error('smtp down'));

    const result = await runJobLifecycleSweep(now);

    expect(result.warned).toBe(0);
    expect(prismaMock.job.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { expiryWarningSentAt: null } });
  });
});
