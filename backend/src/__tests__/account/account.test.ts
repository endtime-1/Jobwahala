import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Mocks = Record<string, ReturnType<typeof vi.fn>>;

// A database stand-in that answers "nothing found" for everything until a test says otherwise,
// and remembers every call so tests can check exactly what was (and was not) touched.
const db = vi.hoisted(() => {
  const models = new Map<string, Mocks>();
  const defaultFor = (method: string) => {
    if (method === 'findMany') return async () => [];
    if (method === 'count') return async () => 0;
    if (method === 'deleteMany' || method === 'updateMany') return async () => ({ count: 0 });
    if (method === 'findUnique' || method === 'findFirst') return async () => null;
    return async () => ({});
  };
  const model = (name: string): Mocks =>
    new Proxy({} as Mocks, {
      get(target, method: string) {
        if (!(method in target)) target[method] = vi.fn(defaultFor(method));
        return target[method];
      },
    });
  const prisma: any = new Proxy(
    {},
    {
      get(_t, name: string) {
        if (name === '$transaction') return async (fn: (tx: unknown) => unknown) => fn(prisma);
        if (!models.has(name)) models.set(name, model(name));
        return models.get(name);
      },
    },
  );
  return { prisma, reset: () => models.clear(), models };
});

const smsMock = vi.hoisted(() => ({ sent: [] as { to: string; message: string }[] }));

vi.mock('../../config/prisma', () => ({ default: db.prisma }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));

import {
  deleteMyAccount,
  exportMyData,
  getMyDeletionPreview,
  sendDeletionCode,
} from '../../controllers/accountController';
import { buildUserDataExport, deleteAccount, getDeletionPreview } from '../../services/accountService';
import { setSmsProviderForTests } from '../../services/sms';
import { PHONE_OTP_PURPOSES } from '../../services/phoneOtpService';
import { deleteAccountSchema } from '../../validation/authSchemas';
import { makePhoneOtpTable } from '../phone/fakePhoneOtpTable';

const prisma = db.prisma;
const otps = makePhoneOtpTable();

const call = async (handler: (req: never, res: Response) => unknown, req: Record<string, unknown>) => {
  let status = 200;
  let payload: any;
  const headers: Record<string, string> = {};
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    send(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;
  await handler({ body: {}, params: {}, ip: '10.0.0.1', ...req } as never, res);
  return { status, body: payload, headers };
};

const seeker = { id: 'u1', role: 'SEEKER', email: 'ama@example.com', phone: '+233241234567', password: '' };
let seekerHash = '';

beforeEach(async () => {
  db.reset();
  otps.reset();
  smsMock.sent.length = 0;
  seekerHash = await bcrypt.hash('Correct-Horse-9', 4);
  setSmsProviderForTests({
    name: 'FAKE',
    send: async (to, message) => {
      smsMock.sent.push({ to, message });
    },
  });
  // The OTP table is the in-memory one.
  for (const method of Object.keys(otps.table) as (keyof typeof otps.table)[]) {
    prisma.phoneOtp[method].mockImplementation((otps.table[method] as unknown) as (...args: unknown[]) => unknown);
  }
});

const asUser = (overrides: Record<string, unknown> = {}) => {
  const user = { ...seeker, password: seekerHash, ...overrides };
  prisma.user.findUnique.mockImplementation(async () => user);
  return user;
};

describe('downloading my data', () => {
  it('collects only this member\'s own records, and never the password or internal notes', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'ama@example.com', phone: '+233241234567', role: 'SEEKER' });
    prisma.application.findMany.mockResolvedValue([
      {
        id: 'a1',
        status: 'INTERVIEW',
        coverLetter: 'I would love this job',
        createdAt: new Date('2026-10-01'),
        statusChangedAt: null,
        job: { id: 'j1', title: 'Hotel Receptionist', location: 'Kumasi', employer: { employerProfile: { companyName: 'Achiba Star Hotel' } } },
      },
    ]);
    prisma.payoutAccount.findUnique.mockResolvedValue({ bankName: 'GCB', accountName: 'Ama Mensah', accountNumber: '1234567890', currency: 'GHS' });

    const data = await buildUserDataExport('u1');

    // Scoped to the member.
    expect(prisma.application.findMany.mock.calls[0][0].where).toEqual({ seekerId: 'u1' });
    expect(prisma.savedSearch.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
    expect(prisma.message.findMany.mock.calls[0][0].where).toEqual({ senderId: 'u1' });

    // Never asks for the password hash, the session counter or internal admin notes.
    const userSelect = prisma.user.findUnique.mock.calls[0][0].select;
    expect(userSelect).not.toHaveProperty('password');
    expect(userSelect).not.toHaveProperty('tokenVersion');
    expect(prisma.verificationRequest.findMany.mock.calls[0][0].select).not.toHaveProperty('internalNote');

    // Readable content.
    expect(data!.applications[0]).toMatchObject({ jobTitle: 'Hotel Receptionist', company: 'Achiba Star Hotel', coverLetter: 'I would love this job', status: 'INTERVIEW' });
    expect(data!.account).toMatchObject({ id: 'u1', email: 'ama@example.com' });
    expect(JSON.stringify(data)).not.toMatch(/"(password|tokenVersion|internalNote)"\s*:/);
  });

  it('includes the jobs the member saved', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: null, phone: null });
    prisma.savedJob.findMany.mockResolvedValue([
      { createdAt: new Date('2026-11-01'), job: { id: 'j9', title: 'Cook', employer: { employerProfile: { companyName: 'Achiba' } } } },
    ]);

    const data = await buildUserDataExport('u1');

    expect(prisma.savedJob.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
    expect(data!.savedJobs).toEqual([{ jobId: 'j9', jobTitle: 'Cook', company: 'Achiba', savedAt: new Date('2026-11-01') }]);
  });

  it('shortens the bank account number to its last four digits', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: null, phone: null });
    prisma.payoutAccount.findUnique.mockResolvedValue({ bankName: 'GCB', accountName: 'Ama Mensah', accountNumber: '1234567890', currency: 'GHS' });

    const data = await buildUserDataExport('u1');

    expect(data!.payoutAccount).toMatchObject({ bankName: 'GCB', accountNumber: '****7890' });
    expect(JSON.stringify(data)).not.toContain('1234567890');
  });

  it('includes waitlist sign-ups found by the member\'s contact details', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'Ama@Example.com', phone: '+233241234567' });

    await buildUserDataExport('u1');

    expect(prisma.interestSignup.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ email: 'ama@example.com' }, { phone: '+233241234567' }],
    });
  });

  it('does not include the people who applied to an employer\'s jobs', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'emp', email: 'hr@x.example', phone: null });
    prisma.job.findMany.mockResolvedValue([{ id: 'j1', title: 'Cook', _count: { applications: 12 } }]);

    const data = await buildUserDataExport('emp');

    expect(data!.jobsPosted).toEqual([{ id: 'j1', title: 'Cook', applicants: 12 }]);
    // Only counts: nothing asked of the application table about other people.
    expect(prisma.application.findMany.mock.calls[0][0].where).toEqual({ seekerId: 'emp' });
  });

  it('returns nothing for an unknown member', async () => {
    expect(await buildUserDataExport('ghost')).toBeNull();
  });

  it('is served as a download that is never cached', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'ama@example.com', phone: null });

    const result = await call(exportMyData as never, { user: { id: 'u1', role: 'SEEKER' } });

    expect(result.status).toBe(200);
    expect(result.headers['content-disposition']).toMatch(/^attachment; filename="jobwahala-my-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.headers['content-type']).toMatch(/application\/json/);
    expect(JSON.parse(result.body).account.id).toBe('u1');
  });
});

describe('what deleting would do', () => {
  it('says how the member confirms: a password for email accounts, a texted code for phone-only', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'SEEKER', email: 'ama@example.com', phone: null });
    expect((await getDeletionPreview('u1'))!.confirmWith).toBe('PASSWORD');

    prisma.user.findUnique.mockResolvedValue({ role: 'SEEKER', email: null, phone: '+233241234567' });
    expect((await getDeletionPreview('u1'))!.confirmWith).toBe('SMS_CODE');
  });

  it('counts the open jobs an employer would close and the applicants waiting on them', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'EMPLOYER', email: 'hr@x.example', phone: null });
    prisma.job.count.mockResolvedValue(3);
    prisma.application.count.mockImplementation(async ({ where }: any) => (where.job ? 17 : 4));

    expect(await getDeletionPreview('emp')).toMatchObject({ openJobs: 3, applicantsOnOpenJobs: 17, applicationsMade: 4, blockers: [] });
  });

  it('blocks on active agreements, unpaid payouts, open disputes and admin accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', email: 'a@x.example', phone: null });
    prisma.agreement.count.mockResolvedValue(1);
    prisma.payment.count.mockResolvedValue(2);
    prisma.agreementDispute.count.mockResolvedValue(1);

    const { blockers } = (await getDeletionPreview('u1'))!;

    expect(blockers).toHaveLength(4);
    expect(blockers.join(' ')).toMatch(/Administrator/);
    expect(blockers.join(' ')).toMatch(/agreements/);
    expect(blockers.join(' ')).toMatch(/payout/);
    expect(blockers.join(' ')).toMatch(/dispute/);
  });
});

describe('deleting an account', () => {
  const memberRow = { role: 'SEEKER', email: 'ama@example.com', phone: '+233241234567' };

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue(memberRow);
  });

  it('removes the member\'s personal content and cancels their alerts', async () => {
    expect(await deleteAccount('u1')).toEqual({ ok: true });

    for (const [model, method] of [
      ['savedSearch', 'deleteMany'], // job alerts stop
      ['savedJob', 'deleteMany'], // bookmarked jobs
      ['seekerCv', 'deleteMany'], // saved CV files
      ['applicationReview', 'deleteMany'], // private employer notes by or about the member
      ['notification', 'deleteMany'],
      ['emailVerificationToken', 'deleteMany'],
      ['passwordResetToken', 'deleteMany'],
      ['jobSeekerProfile', 'deleteMany'],
      ['freelancerProfile', 'deleteMany'],
      ['cVGeneration', 'deleteMany'],
      ['payoutAccount', 'deleteMany'],
      ['verificationRequest', 'deleteMany'],
      ['phoneOtp', 'deleteMany'],
      ['interestSignup', 'deleteMany'],
    ] as const) {
      expect(prisma[model][method], `${model}.${method}`).toHaveBeenCalledTimes(1);
    }
    expect(prisma.savedSearch.deleteMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
  });

  it('empties the account so nothing identifies the member, and ends every session', async () => {
    await deleteAccount('u1');

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(prisma.user.update.mock.calls[0][0].where).toEqual({ id: 'u1' });
    expect(data).toMatchObject({
      email: null,
      phone: null,
      phoneVerifiedAt: null,
      googleId: null,
      status: 'DELETED',
      emailVerified: false,
      identityVerified: false,
      tokenVersion: { increment: 1 },
    });
    expect(data.password).toMatch(/^\$2[aby]\$/);
  });

  it('does not delete the account row, because other people\'s records point at it', async () => {
    await deleteAccount('u1');

    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it('withdraws applications, but keeps (and blanks) any that a work agreement hangs off', async () => {
    await deleteAccount('u1');

    expect(prisma.application.deleteMany.mock.calls[0][0].where).toEqual({ seekerId: 'u1', agreement: { is: null } });
    expect(prisma.application.updateMany.mock.calls[0][0]).toEqual({
      where: { seekerId: 'u1' },
      data: { coverLetter: null, cvSource: null, cvFileUrl: null, cvFileName: null },
    });
  });

  it('removes what the member wrote in messages and any files they attached', async () => {
    await deleteAccount('u1');

    expect(prisma.message.updateMany.mock.calls[0][0]).toEqual({
      where: { senderId: 'u1' },
      data: { content: null, attachmentUrl: null, attachmentName: null, attachmentContentType: null, attachmentSizeBytes: null },
    });
    expect(prisma.message.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps financial and legal records: payments, agreements, disputes and reviews are not deleted', async () => {
    await deleteAccount('u1');

    for (const model of ['payment', 'agreement', 'agreementDispute', 'review', 'proposal', 'report']) {
      expect(prisma[model].deleteMany, model).not.toHaveBeenCalled();
      expect(prisma[model].delete, model).not.toHaveBeenCalled();
    }
  });

  it('deletes waitlist entries and codes tied to the member\'s email and phone', async () => {
    await deleteAccount('u1');

    expect(prisma.interestSignup.deleteMany.mock.calls[0][0].where).toEqual({
      OR: [{ email: 'ama@example.com' }, { phone: '+233241234567' }],
    });
    expect(prisma.phoneOtp.deleteMany.mock.calls[0][0].where).toEqual({
      OR: [{ subjectId: 'u1' }, { phone: '+233241234567' }],
    });
  });

  it('writes the id, and no personal details, to the log', async () => {
    const logger = (await import('../../config/logger')).default;
    const spy = vi.spyOn(logger, 'info');

    await deleteAccount('u1');

    expect(spy).toHaveBeenCalledWith('account_deleted', { userId: 'u1' });
    spy.mockRestore();
  });

  it('refuses, and changes nothing, while there is an active agreement', async () => {
    prisma.agreement.count.mockResolvedValue(1);

    const result = await deleteAccount('u1');

    expect(result).toMatchObject({ ok: false, reason: 'BLOCKED' });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.savedSearch.deleteMany).not.toHaveBeenCalled();
  });

  describe('for an employer', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ role: 'EMPLOYER', email: 'hr@x.example', phone: null });
      prisma.job.count.mockResolvedValue(2);
      prisma.application.count.mockResolvedValue(9);
    });

    it('must first confirm that their open jobs will close and the company page will go', async () => {
      const result = await deleteAccount('emp');

      expect(result).toEqual({ ok: false, reason: 'ACKNOWLEDGE_COMPANY', openJobs: 2, applicantsOnOpenJobs: 9 });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('closes the open jobs and empties the company, keeping the jobs and the applicants\' records', async () => {
      const result = await deleteAccount('emp', { acknowledgeCompany: true });

      expect(result).toEqual({ ok: true });
      expect(prisma.job.updateMany.mock.calls[0][0]).toEqual({
        where: { employerId: 'emp', status: { in: ['ACTIVE', 'PAUSED', 'DRAFT'] } },
        data: { status: 'CLOSED' },
      });
      expect(prisma.employerProfile.updateMany.mock.calls[0][0].data).toMatchObject({
        companyName: 'Former employer',
        industry: null,
        logoUrl: null,
        website: null,
        description: null,
      });
      // The jobs and the applications to them belong to other people's histories too.
      expect(prisma.job.deleteMany).not.toHaveBeenCalled();
      expect(prisma.job.delete).not.toHaveBeenCalled();
      expect(prisma.application.deleteMany.mock.calls[0][0].where.seekerId).toBe('emp');
    });

    it('needs no confirmation when there is nothing open', async () => {
      prisma.job.count.mockResolvedValue(0);
      prisma.application.count.mockResolvedValue(0);

      expect(await deleteAccount('emp')).toEqual({ ok: true });
    });

    it('leaves a seeker\'s data alone: no company changes for someone who is not an employer', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'SEEKER', email: 'ama@example.com', phone: null });
      prisma.job.count.mockResolvedValue(0);
      prisma.application.count.mockResolvedValue(0);

      await deleteAccount('u1');

      expect(prisma.job.updateMany).not.toHaveBeenCalled();
      expect(prisma.employerProfile.updateMany).not.toHaveBeenCalled();
    });
  });
});

describe('the delete endpoint re-checks who is asking', () => {
  const ask = (body: Record<string, unknown>, role = 'SEEKER') =>
    call(deleteMyAccount as never, { user: { id: 'u1', role }, body: { confirm: 'DELETE', ...body } });

  it('needs the right password for an email account', async () => {
    asUser();

    const wrong = await ask({ password: 'not-it' });
    const missing = await ask({});

    expect(wrong.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('deletes with the right password', async () => {
    asUser();

    const result = await ask({ password: 'Correct-Horse-9' });

    expect(result.status).toBe(200);
    expect(prisma.user.update.mock.calls[0][0].data.status).toBe('DELETED');
  });

  it('needs a texted code for a phone-only account, and a wrong code deletes nothing', async () => {
    asUser({ email: null });
    const sent = await call(sendDeletionCode as never, { user: { id: 'u1', role: 'SEEKER' } });
    expect(sent.status).toBe(200);
    expect(smsMock.sent[0].to).toBe('+233241234567');
    expect(otps.all()[0]).toMatchObject({ purpose: 'DELETE_ACCOUNT', subjectId: 'u1' });

    const wrong = await ask({ code: '000000' });
    expect(wrong.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();

    const code = /(\d{6})/.exec(smsMock.sent[0].message)![1];
    const right = await ask({ code });
    expect(right.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('a code cannot be reused for a second deletion', async () => {
    asUser({ email: null });
    await call(sendDeletionCode as never, { user: { id: 'u1', role: 'SEEKER' } });
    const code = /(\d{6})/.exec(smsMock.sent[0].message)![1];

    await ask({ code });
    prisma.user.update.mockClear();
    const again = await ask({ code });

    expect(again.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not send a deletion code to an account that has a password', async () => {
    asUser();

    const result = await call(sendDeletionCode as never, { user: { id: 'u1', role: 'SEEKER' } });

    expect(result.status).toBe(400);
    expect(smsMock.sent).toHaveLength(0);
  });

  it('never lets an administrator delete their own account here', async () => {
    asUser({ role: 'ADMIN' });

    const result = await ask({ password: 'Correct-Horse-9' }, 'ADMIN');

    expect(result.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('explains what is in the way when deletion is blocked', async () => {
    asUser();
    prisma.agreement.count.mockResolvedValue(1);

    const result = await ask({ password: 'Correct-Horse-9' });

    expect(result.status).toBe(409);
    expect(result.body.blockers[0]).toMatch(/active work agreements/);
  });

  it('asks an employer to acknowledge the company closing before going ahead', async () => {
    asUser({ role: 'EMPLOYER' });
    prisma.job.count.mockResolvedValue(2);
    prisma.application.count.mockResolvedValue(5);

    const first = await ask({ password: 'Correct-Horse-9' }, 'EMPLOYER');
    expect(first.status).toBe(400);
    expect(first.body).toMatchObject({ code: 'ACKNOWLEDGE_COMPANY', openJobs: 2, applicantsOnOpenJobs: 5 });
    expect(prisma.user.update).not.toHaveBeenCalled();

    const second = await ask({ password: 'Correct-Horse-9', acknowledgeCompany: true }, 'EMPLOYER');
    expect(second.status).toBe(200);
  });

  it('shows the preview to the signed-in member only', async () => {
    asUser();

    const result = await call(getMyDeletionPreview as never, { user: { id: 'u1', role: 'SEEKER' } });

    expect(result.body.preview).toMatchObject({ confirmWith: 'PASSWORD', blockers: [] });
  });
});

describe('delete request validation', () => {
  const parse = (body: unknown) => deleteAccountSchema.safeParse({ body });

  it('needs the word DELETE typed exactly', () => {
    expect(parse({ confirm: 'DELETE', password: 'x' }).success).toBe(true);
    for (const typed of ['delete', 'Delete', 'yes', '', undefined]) expect(parse({ confirm: typed, password: 'x' }).success).toBe(false);
  });

  it('only takes a six-digit code and known fields', () => {
    expect(parse({ confirm: 'DELETE', code: '123456' }).success).toBe(true);
    expect(parse({ confirm: 'DELETE', code: '12345' }).success).toBe(false);
    expect(parse({ confirm: 'DELETE', password: 'x', userId: 'someone-else' }).success).toBe(false);
  });

  it('has a deletion purpose among the text-code purposes', () => {
    expect(PHONE_OTP_PURPOSES).toContain('DELETE_ACCOUNT');
  });
});
