import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    verificationRequest: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    phoneOtp: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    contactVerificationCode: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    adminActionLog: { create: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
    job: { findMany: vi.fn() },
  };
  mock.$transaction = vi.fn(async (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(mock)));
  return mock;
});
const emailMock = vi.hoisted(() => ({ code: vi.fn(), decision: vi.fn() }));

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));
vi.mock('../../services/emailService', () => ({
  sendVerificationCodeEmail: emailMock.code,
  sendVerificationDecisionEmail: emailMock.decision,
}));

import env from '../../config/env';
import { getAdminAuditLog } from '../../controllers/adminAuditController';
import { getJobs } from '../../controllers/jobController';
import {
  createVerificationRequest,
  getVerificationRequests,
  requestContactCode,
  submitContactCode,
  updateVerificationRequestStatus,
} from '../../controllers/verificationController';
import { confirmContactCode, sendContactCode } from '../../services/contactVerificationService';
import { hashOtp } from '../../utils/otp';

const MIN = 60_000;

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
  await handler({ query: {}, params: {}, body: {}, ...req } as never, res);
  return { status, body: payload };
};

const businessRequest = (overrides: Record<string, unknown> = {}) => ({
  id: 'ver-1',
  userId: 'emp-1',
  type: 'BUSINESS',
  status: 'PENDING',
  details: 'Registration number CS123456789.',
  documentUrl: 'https://x/cert.pdf',
  registrationNumber: 'CS123456789',
  contactEmail: 'hr@achiba.example',
  contactPhone: null,
  address: '12 Ring Road, Accra',
  contactVerifiedAt: null,
  createdAt: new Date(),
  user: { id: 'emp-1', email: 'owner@achiba.example', employerProfile: { companyName: 'Achiba Star Hotel' } },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prismaMock),
  );
  prismaMock.contactVerificationCode.findMany.mockResolvedValue([]);
  prismaMock.contactVerificationCode.create.mockResolvedValue({ id: 'code-1' });
  prismaMock.contactVerificationCode.delete.mockResolvedValue({});
  prismaMock.contactVerificationCode.update.mockResolvedValue({ attempts: 1 });
  prismaMock.verificationRequest.findUnique.mockResolvedValue(businessRequest());
  prismaMock.verificationRequest.update.mockImplementation(async ({ data }: { data: object }) => ({ ...businessRequest(), ...data }));
  prismaMock.user.findUnique.mockResolvedValue({ id: 'admin-1', email: 'admin@jobwahala.com' });
  prismaMock.notification.create.mockResolvedValue({ id: 'n1' });
  prismaMock.adminActionLog.create.mockResolvedValue({});
  emailMock.code.mockResolvedValue(undefined);
  emailMock.decision.mockResolvedValue(undefined);
});

describe('submitting a business verification request', () => {
  const body = {
    registrationNumber: 'cs 123456789',
    documentUrl: 'https://x/cert.pdf',
    contactEmail: 'hr@achiba.example',
    contactPhone: '0241234567',
    address: '12 Ring Road, Accra',
  };
  const submit = () => call(createVerificationRequest as never, { user: { id: 'emp-1', role: 'EMPLOYER' }, body });

  beforeEach(() => {
    prismaMock.verificationRequest.findFirst.mockResolvedValue(null);
    prismaMock.verificationRequest.create.mockImplementation(async ({ data }: { data: object }) => ({ ...businessRequest(), ...data }));
  });

  it('stores the number, certificate, contact and address, and emails a code', async () => {
    const result = await submit();

    expect(result.status).toBe(201);
    const data = prismaMock.verificationRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 'emp-1',
      type: 'BUSINESS',
      registrationNumber: 'CS 123456789',
      documentUrl: 'https://x/cert.pdf',
      contactEmail: 'hr@achiba.example',
      contactPhone: '+233241234567',
      address: '12 Ring Road, Accra',
      contactVerifiedAt: null,
    });
    expect(emailMock.code).toHaveBeenCalledWith('hr@achiba.example', expect.stringMatching(/^\d{6}$/), 'Achiba Star Hotel');
    expect(result.body.contact).toEqual({ confirmed: false, codeSent: true });
  });

  it('refuses a registration number that another account already uses', async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'other' });

    const result = await submit();

    expect(result.status).toBe(409);
    expect(result.body.message).toMatch(/already being used/i);
    expect(prismaMock.verificationRequest.create).not.toHaveBeenCalled();
  });

  it('does not ask again for a contact the employer already confirmed', async () => {
    const earlier = new Date('2026-10-01T00:00:00Z');
    prismaMock.verificationRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ contactVerifiedAt: earlier });

    const result = await submit();

    expect(prismaMock.verificationRequest.create.mock.calls[0][0].data.contactVerifiedAt).toBe(earlier);
    expect(emailMock.code).not.toHaveBeenCalled();
    expect(result.body.contact.confirmed).toBe(true);
  });

  it('still saves the request when the email cannot be sent', async () => {
    emailMock.code.mockRejectedValue(new Error('smtp down'));

    const result = await submit();

    expect(result.status).toBe(201);
    expect(result.body.contact).toEqual({ confirmed: false, codeSent: false });
  });
});

describe('confirming the company email with a code', () => {
  const secret = env.jwtSecret;
  const storedCode = (code: string, extra: Record<string, unknown> = {}) => ({
    id: 'code-1',
    codeHash: hashOtp(code, 'ver-1', secret),
    attempts: 0,
    expiresAt: new Date(Date.now() + 5 * MIN),
    createdAt: new Date(),
    ...extra,
  });

  it('stores only a hash of the code that it emails', async () => {
    const result = await sendContactCode('ver-1', 'emp-1');

    expect(result).toEqual({ ok: true, channel: 'EMAIL' });
    const emailed = emailMock.code.mock.calls[0][1] as string;
    const saved = prismaMock.contactVerificationCode.create.mock.calls[0][0].data;
    expect(saved.codeHash).toBe(hashOtp(emailed, 'ver-1', secret));
    expect(JSON.stringify(saved)).not.toContain(emailed);
    expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now() + 9 * MIN);
  });

  it('waits a minute between codes, and caps them at five an hour', async () => {
    prismaMock.contactVerificationCode.findMany.mockResolvedValue([{ createdAt: new Date(Date.now() - 20_000) }]);
    const soon = await sendContactCode('ver-1', 'emp-1');
    expect(soon).toMatchObject({ ok: false, reason: 'COOLDOWN' });

    prismaMock.contactVerificationCode.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ createdAt: new Date(Date.now() - (2 + i) * MIN) })),
    );
    expect(await sendContactCode('ver-1', 'emp-1')).toEqual({ ok: false, reason: 'TOO_MANY' });
    expect(emailMock.code).not.toHaveBeenCalled();
  });

  it('only the request owner can ask for or confirm a code', async () => {
    expect(await sendContactCode('ver-1', 'someone-else')).toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect(await confirmContactCode('ver-1', 'someone-else', '123456')).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('does not keep a code the employer never received', async () => {
    emailMock.code.mockRejectedValue(new Error('smtp down'));

    expect(await sendContactCode('ver-1', 'emp-1')).toEqual({ ok: false, reason: 'EMAIL_FAILED' });
    expect(prismaMock.contactVerificationCode.delete).toHaveBeenCalledWith({ where: { id: 'code-1' } });
  });

  it('confirms the contact when the code is right', async () => {
    prismaMock.contactVerificationCode.findFirst.mockResolvedValue(storedCode('482913'));

    expect(await confirmContactCode('ver-1', 'emp-1', '482913')).toEqual({ ok: true, channel: 'EMAIL' });
    expect(prismaMock.verificationRequest.update).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
      data: { contactVerifiedAt: expect.any(Date), contactVerifiedVia: 'EMAIL' },
    });
    expect(prismaMock.contactVerificationCode.update).toHaveBeenCalledWith({
      where: { id: 'code-1' },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it('counts wrong tries and tells the employer how many are left', async () => {
    prismaMock.contactVerificationCode.findFirst.mockResolvedValue(storedCode('482913'));
    prismaMock.contactVerificationCode.update.mockResolvedValue({ attempts: 3 });

    expect(await confirmContactCode('ver-1', 'emp-1', '000000')).toEqual({ ok: false, reason: 'WRONG', attemptsLeft: 2 });
    expect(prismaMock.verificationRequest.update).not.toHaveBeenCalled();
  });

  it('locks the code after five wrong tries, even for the right code', async () => {
    prismaMock.contactVerificationCode.findFirst.mockResolvedValue(storedCode('482913', { attempts: 4 }));
    prismaMock.contactVerificationCode.update.mockResolvedValue({ attempts: 5 });
    expect(await confirmContactCode('ver-1', 'emp-1', '000000')).toEqual({ ok: false, reason: 'LOCKED' });

    prismaMock.contactVerificationCode.findFirst.mockResolvedValue(storedCode('482913', { attempts: 5 }));
    expect(await confirmContactCode('ver-1', 'emp-1', '482913')).toEqual({ ok: false, reason: 'LOCKED' });
    expect(prismaMock.verificationRequest.update).not.toHaveBeenCalled();
  });

  it('rejects an expired code and a missing one', async () => {
    prismaMock.contactVerificationCode.findFirst.mockResolvedValue(storedCode('482913', { expiresAt: new Date(Date.now() - MIN) }));
    expect(await confirmContactCode('ver-1', 'emp-1', '482913')).toEqual({ ok: false, reason: 'EXPIRED' });

    prismaMock.contactVerificationCode.findFirst.mockResolvedValue(null);
    expect(await confirmContactCode('ver-1', 'emp-1', '482913')).toEqual({ ok: false, reason: 'NO_CODE' });
  });

  it('maps the outcomes to clear messages over HTTP', async () => {
    prismaMock.contactVerificationCode.findMany.mockResolvedValue([{ createdAt: new Date(Date.now() - 10_000) }]);
    const cooldown = await call(requestContactCode as never, { user: { id: 'emp-1' }, params: { id: 'ver-1' } });
    expect(cooldown.status).toBe(429);
    expect(cooldown.body.retryAfterSeconds).toBeGreaterThan(0);

    prismaMock.contactVerificationCode.findFirst.mockResolvedValue(storedCode('482913'));
    prismaMock.contactVerificationCode.update.mockResolvedValue({ attempts: 1 });
    const wrong = await call(submitContactCode as never, { user: { id: 'emp-1' }, params: { id: 'ver-1' }, body: { code: '000000' } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toMatch(/4 tries left/);
  });
});

describe('admin decisions on a business request', () => {
  const decide = (status: string, reviewNote?: string, verificationOverrides: Record<string, unknown> = {}) => {
    prismaMock.verificationRequest.findUnique.mockResolvedValue(businessRequest({ contactVerifiedAt: new Date(), ...verificationOverrides }));
    return call(updateVerificationRequestStatus as never, {
      user: { id: 'admin-1', role: 'ADMIN' },
      params: { id: 'ver-1' },
      body: { status, reviewNote },
    });
  };

  it('approves, logs who did it, tells the employer in the app and by email', async () => {
    const result = await decide('APPROVED');

    expect(result.status).toBe(200);
    expect(prismaMock.adminActionLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({
      adminId: 'admin-1',
      adminEmail: 'admin@jobwahala.com',
      action: 'VERIFICATION_APPROVED',
      targetType: 'VerificationRequest',
      targetId: 'ver-1',
    });
    expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'emp-1', type: 'VERIFICATION_APPROVED' });
    expect(emailMock.decision).toHaveBeenCalledWith('owner@achiba.example', expect.objectContaining({ title: expect.stringMatching(/verified/i) }));
  });

  it('records the reason for a rejection, and sends it to the employer', async () => {
    const result = await decide('REJECTED', 'The certificate does not match the company name');

    expect(result.status).toBe(200);
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'VERIFICATION_REJECTED',
      reason: 'The certificate does not match the company name',
    });
    expect(prismaMock.notification.create.mock.calls[0][0].data.message).toContain('The certificate does not match the company name');
    expect(emailMock.decision.mock.calls[0][1].message).toContain('The certificate does not match the company name');
  });

  it('records a request for more information with its reason', async () => {
    await decide('NEEDS_INFO', 'Please upload a clearer scan');

    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'VERIFICATION_NEEDS_INFO',
      reason: 'Please upload a clearer scan',
    });
    expect(prismaMock.notification.create.mock.calls[0][0].data.type).toBe('VERIFICATION_NEEDS_INFO');
  });

  it('will not reject or ask for more without a reason, and logs nothing', async () => {
    for (const status of ['REJECTED', 'NEEDS_INFO']) {
      const result = await decide(status, '');
      expect(result.status).toBe(400);
    }
    expect(prismaMock.adminActionLog.create).not.toHaveBeenCalled();
    expect(prismaMock.verificationRequest.update).not.toHaveBeenCalled();
    expect(emailMock.decision).not.toHaveBeenCalled();
  });

  it('will not approve a company whose contact is unconfirmed or whose details are missing', async () => {
    const unconfirmed = await decide('APPROVED', undefined, { contactVerifiedAt: null });
    expect(unconfirmed.status).toBe(400);
    expect(unconfirmed.body.message).toMatch(/one-time code/);

    const legacy = await decide('APPROVED', undefined, { registrationNumber: null, documentUrl: null, address: null });
    expect(legacy.status).toBe(400);
    expect(legacy.body.message).toMatch(/registration number/);

    expect(prismaMock.adminActionLog.create).not.toHaveBeenCalled();
  });

  it('only decides requests that are still pending', async () => {
    const result = await decide('APPROVED', undefined, { status: 'APPROVED' });
    expect(result.status).toBe(400);
  });

  it('still records the decision if the email fails', async () => {
    emailMock.decision.mockRejectedValue(new Error('smtp down'));

    const result = await decide('APPROVED');

    expect(result.status).toBe(200);
    expect(prismaMock.adminActionLog.create).toHaveBeenCalled();
  });

  it('the review queue includes each request\'s decision log', async () => {
    prismaMock.verificationRequest.findMany.mockResolvedValue([
      { ...businessRequest(), reviewer: null, internalNote: null, user: { id: 'emp-1' } },
    ]);
    const entry = { targetId: 'ver-1', action: 'VERIFICATION_NEEDS_INFO', adminEmail: 'admin@jobwahala.com', reason: 'Clearer scan', createdAt: new Date() };
    prismaMock.adminActionLog.findMany.mockResolvedValue([entry]);

    const result = await call(getVerificationRequests as never, { user: { id: 'admin-1' } });

    expect(result.body.verifications[0].auditTrail).toEqual([entry]);
    expect(prismaMock.adminActionLog.findMany.mock.calls[0][0].where).toEqual({
      targetType: 'VerificationRequest',
      targetId: { in: ['ver-1'] },
    });
  });
});

describe('the admin audit log', () => {
  it('lists entries newest first, filtered by target', async () => {
    prismaMock.adminActionLog.findMany.mockResolvedValue([]);

    await call(getAdminAuditLog as never, { query: { targetType: 'VerificationRequest', targetId: 'ver-1', limit: '500' } });

    const args = prismaMock.adminActionLog.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ targetType: 'VerificationRequest', targetId: 'ver-1' });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.take).toBe(100);
  });

  it('rejects a bad paging date', async () => {
    const result = await call(getAdminAuditLog as never, { query: { before: 'yesterday-ish' } });
    expect(result.status).toBe(400);
  });
});

describe('job search with verification', () => {
  const row = (id: string, createdAt: string, verified: boolean) => ({
    id,
    title: id,
    createdAt: new Date(createdAt),
    employerId: `emp-${id}`,
    employer: {
      id: `emp-${id}`,
      email: `${id}@example.com`,
      employerProfile: { companyName: id },
      verificationRequests: verified ? [{ id: 'v', status: 'APPROVED', type: 'BUSINESS' }] : [],
    },
  });

  it('lists verified employers first, then the newest', async () => {
    prismaMock.job.findMany.mockResolvedValue([
      row('newest-unverified', '2026-11-04', false),
      row('older-verified', '2026-10-01', true),
      row('newer-verified', '2026-10-20', true),
    ]);

    const result = await call(getJobs as never, {});

    expect(result.body.jobs.map((job: { id: string }) => job.id)).toEqual(['newer-verified', 'older-verified', 'newest-unverified']);
    expect(result.body.jobs.map((job: { employer: { isVerified: boolean } }) => job.employer.isVerified)).toEqual([true, true, false]);
  });

  it('"verified only" asks the database for approved business verifications only', async () => {
    prismaMock.job.findMany.mockResolvedValue([]);

    await call(getJobs as never, { query: { verified: '1' } });

    expect(prismaMock.job.findMany.mock.calls[0][0].where.employer).toEqual({
      verificationRequests: { some: { status: 'APPROVED', type: 'BUSINESS' } },
    });
  });

  it('shows everything when the filter is off', async () => {
    prismaMock.job.findMany.mockResolvedValue([]);

    await call(getJobs as never, {});

    expect(prismaMock.job.findMany.mock.calls[0][0].where).not.toHaveProperty('employer');
  });
});
