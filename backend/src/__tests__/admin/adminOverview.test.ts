import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const m = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  return {
    user: m('count', 'findMany'),
    job: m('count', 'findMany'),
    application: m('count', 'findMany'),
    verificationRequest: m('count'),
    report: m('count'),
    course: m('count'),
    employerProfile: m('count'),
    agreementDispute: m('count'),
    billingPayment: m('aggregate'),
    $queryRaw: vi.fn(),
  };
});
vi.mock('../../config/prisma', () => ({ default: prismaMock }));

import { getAdminOverview, getSystemHealth } from '../../controllers/adminOverviewController';
import { bucketByDay, dayKeys, evaluateHealth, healthSummary, startOfMonthUtc, type HealthInput } from '../../utils/adminOverview';

const NOW = new Date('2026-11-10T10:00:00.000Z');

const respond = () => {
  const out: { status: number; body: any } = { status: 200, body: null };
  const res = { status: (code: number) => ((out.status = code), res), json: (body: unknown) => ((out.body = body), res) } as unknown as Response;
  return { res, out };
};

const healthy: HealthInput = {
  databaseOk: true,
  brevoApiKey: true,
  smtpUser: false,
  smtpHost: 'localhost',
  storageProvider: 'LOCAL',
  storageDir: '/data/uploads',
  turnstileSecret: true,
  paystackMode: 'live',
  frontendBaseUrl: 'https://www.jobwahala.com',
  smsProvider: 'ARKESEL',
  smsConfigured: true,
  googleConfigured: true,
  sentryConfigured: true,
  freelanceEnabled: false,
  isProduction: true,
};
const status = (input: Partial<HealthInput>, key: string) => evaluateHealth({ ...healthy, ...input }).find((item) => item.key === key)!;

describe('days and months', () => {
  it('lists the last days oldest first, ending today, and counts what happened on each', () => {
    expect(dayKeys(NOW, 3)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']);

    const series = bucketByDay([new Date('2026-11-10T01:00:00Z'), new Date('2026-11-10T23:00:00Z'), new Date('2026-11-08T12:00:00Z'), new Date('2026-10-01T00:00:00Z')], NOW, 3);

    expect(series).toEqual([{ day: '2026-11-08', count: 1 }, { day: '2026-11-09', count: 0 }, { day: '2026-11-10', count: 2 }]);
  });

  it('finds the start of this month and last month', () => {
    expect(startOfMonthUtc(NOW).toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(startOfMonthUtc(NOW, 1).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(startOfMonthUtc(new Date('2026-01-15T00:00:00Z'), 1).toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });
});

describe('the system health checks', () => {
  it('a fully set up site has no errors and no warnings', () => {
    const items = evaluateHealth(healthy);

    expect(healthSummary(items)).toEqual({ errors: 0, warnings: 0 });
    expect(items.map((item) => item.key)).toEqual(expect.arrayContaining(['database', 'email', 'storage', 'captcha', 'payments', 'site-address', 'sms']));
  });

  it('email: the web API is fine, SMTP is a warning, nothing is an error that says what to set', () => {
    expect(status({}, 'email').status).toBe('ok');
    expect(status({ brevoApiKey: false, smtpUser: true, smtpHost: 'smtp.example.com' }, 'email')).toMatchObject({ status: 'warn', detail: expect.stringContaining('smtp.example.com') });
    expect(status({ brevoApiKey: false }, 'email')).toMatchObject({ status: 'error', detail: expect.stringContaining('BREVO_API_KEY') });
  });

  it('storage: S3 or an absolute folder is fine; a folder inside the app is an error in production', () => {
    expect(status({ storageProvider: 'S3' }, 'storage').status).toBe('ok');
    expect(status({ storageDir: '/data/uploads' }, 'storage').status).toBe('ok');
    expect(status({ storageDir: 'uploads' }, 'storage')).toMatchObject({ status: 'error', detail: expect.stringContaining('lost on every deploy') });
    expect(status({ storageDir: 'uploads', isProduction: false }, 'storage').status).toBe('warn');
  });

  it('sign-up security check, payments, site address and phone codes', () => {
    expect(status({ turnstileSecret: false }, 'captcha')).toMatchObject({ status: 'error', detail: expect.stringContaining('closed') });
    expect(status({ turnstileSecret: false, isProduction: false }, 'captcha').status).toBe('off');
    expect(status({ paystackMode: 'test' }, 'payments').status).toBe('warn');
    expect(status({ paystackMode: 'off' }, 'payments').status).toBe('warn');
    expect(status({ frontendBaseUrl: 'http://localhost:5173' }, 'site-address')).toMatchObject({ status: 'error', detail: expect.stringContaining('localhost') });
    expect(status({ smsConfigured: false }, 'sms').status).toBe('warn');
  });

  it('a database that does not answer is an error', () => {
    expect(status({ databaseOk: false }, 'database').status).toBe('error');
  });

  it('never contains a key, password or secret', () => {
    const text = JSON.stringify(evaluateHealth({ ...healthy, smtpUser: true, brevoApiKey: false }));

    expect(text).not.toMatch(/xkeysib|sk_live|sk_test|password|secret key:/i);
  });

  it('the controller reports the database as down when the ping fails, and returns a summary', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('down'));
    const { res, out } = respond();

    await getSystemHealth({} as never, res);

    expect(out.body.success).toBe(true);
    expect(out.body.items.find((item: any) => item.key === 'database').status).toBe('error');
    expect(out.body.summary.errors).toBeGreaterThanOrEqual(1);
  });
});

describe('the overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // seekers, employers, freelancers, admins, then the rest in order
    prismaMock.user.count.mockResolvedValueOnce(90).mockResolvedValueOnce(8).mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(12).mockResolvedValueOnce(40).mockResolvedValueOnce(3);
    prismaMock.job.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    prismaMock.application.count.mockResolvedValueOnce(300).mockResolvedValueOnce(25);
    prismaMock.verificationRequest.count.mockResolvedValue(4);
    prismaMock.report.count.mockResolvedValue(6);
    prismaMock.course.count.mockResolvedValue(2);
    prismaMock.employerProfile.count.mockResolvedValue(1);
    prismaMock.agreementDispute.count.mockResolvedValue(0);
    prismaMock.billingPayment.aggregate
      .mockResolvedValueOnce({ _sum: { totalPesewas: 50000, refundedPesewas: 5000 }, _count: 3 })
      .mockResolvedValueOnce({ _sum: { totalPesewas: 20000, refundedPesewas: null } });
    prismaMock.user.findMany.mockResolvedValue([{ createdAt: new Date() }]);
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.job.findMany.mockResolvedValue([]);
  });

  it('gives the totals, what is waiting for a decision, revenue after refunds, and 14 days of activity', async () => {
    const { res, out } = respond();

    await getAdminOverview({} as never, res);

    expect(out.body.success).toBe(true);
    expect(out.body.users).toMatchObject({ total: 101, seekers: 90, employers: 8, new7: 12, new30: 40 });
    expect(out.body.employers).toEqual({ total: 8, verified: 3, unverified: 5 });
    expect(out.body.jobs).toEqual({ active: 5, new7: 2 });
    expect(out.body.applications).toEqual({ total: 300, new7: 25 });
    expect(out.body.queues).toEqual({ verifications: 4, reports: 6, courses: 2, providers: 1, disputes: 0 });
    expect(out.body.revenue).toMatchObject({ thisMonthPesewas: 45000, lastMonthPesewas: 20000, paymentsThisMonth: 3 });
    expect(out.body.series.signups).toHaveLength(14);
    expect(out.body.series.signups.reduce((sum: number, point: { count: number }) => sum + point.count, 0)).toBe(1);
  });

  it('counts only pending verifications, open disputes and live jobs', async () => {
    const { res } = respond();

    await getAdminOverview({} as never, res);

    expect(prismaMock.verificationRequest.count).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
    expect(prismaMock.agreementDispute.count).toHaveBeenCalledWith({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } });
    expect(prismaMock.job.count.mock.calls[0][0].where).toMatchObject({ status: 'ACTIVE' });
  });

  it('contains no personal data (counts and dates only)', async () => {
    const { res, out } = respond();

    await getAdminOverview({} as never, res);

    expect(JSON.stringify(out.body)).not.toMatch(/email|phone|password/i);
  });

  it('answers 500 with a message if the database fails', async () => {
    prismaMock.user.count.mockReset();
    prismaMock.user.count.mockRejectedValue(new Error('db'));
    const { res, out } = respond();

    await getAdminOverview({} as never, res);

    expect(out.status).toBe(500);
    expect(out.body.success).toBe(false);
  });
});
