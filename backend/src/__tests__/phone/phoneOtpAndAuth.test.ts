import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePhoneOtpTable } from './fakePhoneOtpTable';

const otps = vi.hoisted(() => ({ ref: null as null | ReturnType<typeof import('./fakePhoneOtpTable').makePhoneOtpTable> }));

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    jobSeekerProfile: { create: vi.fn() },
    employerProfile: { create: vi.fn() },
    freelancerProfile: { create: vi.fn() },
    verificationRequest: { findUnique: vi.fn(), update: vi.fn() },
    contactVerificationCode: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
  // The PhoneOtp table is the in-memory one, filled in below.
  mock.phoneOtp = new Proxy({}, { get: (_t, method: string) => (otps.ref!.table as Record<string, unknown>)[method] });
  mock.$transaction = vi.fn(async (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(mock)));
  return mock;
});

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/emailService', () => ({ sendVerificationCodeEmail: vi.fn(), sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }));

import env from '../../config/env';
import {
  confirmAddPhone,
  loginWithPhone,
  sendAddPhoneCode,
  sendPhoneCode,
  signupWithPhone,
} from '../../controllers/authController';
import { confirmContactCode, sendContactCode } from '../../services/contactVerificationService';
import {
  IP_MAX_SENDS_PER_HOUR,
  PHONE_MAX_SENDS_PER_HOUR,
  PHONE_OTP_TTL_MS,
  issuePhoneOtp,
  verifyPhoneOtp,
} from '../../services/phoneOtpService';
import { setSmsProviderForTests } from '../../services/sms';
import { hashOtp } from '../../utils/otp';

const PHONE = '+233241234567';
const MIN = 60_000;

const sent: { to: string; message: string }[] = [];
const sendMock = vi.fn(async (to: string, message: string) => {
  sent.push({ to, message });
});
const lastCode = () => /(\d{6})/.exec(sent[sent.length - 1].message)![1];

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
  await handler({ body: {}, params: {}, ip: '10.0.0.1', ...req } as unknown as Request as never, res);
  return { status, body: payload };
};

const store = makePhoneOtpTable();
otps.ref = store;

beforeEach(() => {
  vi.clearAllMocks();
  store.reset();
  sent.length = 0;
  sendMock.mockImplementation(async (to: string, message: string) => {
    sent.push({ to, message });
  });
  setSmsProviderForTests({ name: 'FAKE', send: sendMock });
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'user-new',
    email: null,
    status: 'ACTIVE',
    tokenVersion: 0,
    emailVerified: false,
    ...data,
  }));
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prismaMock),
  );
});

describe('texting one-time codes', () => {
  it('sends a 6-digit code to the number, and stores only a hash that expires in 5 minutes', async () => {
    const now = new Date();
    const result = await issuePhoneOtp({ phone: PHONE, purpose: 'LOGIN', ip: '1.2.3.4' }, now);

    expect(result).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(PHONE);
    expect(sent[0].message).toMatch(/Your JobWahala code is \d{6}\. It expires in 5 minutes/);

    const [row] = store.all();
    const code = lastCode();
    expect(row.codeHash).toBe(hashOtp(code, `${PHONE}|LOGIN|`, env.jwtSecret));
    expect(JSON.stringify(row)).not.toContain(code);
    expect(row.expiresAt.getTime() - now.getTime()).toBe(PHONE_OTP_TTL_MS);
    expect(PHONE_OTP_TTL_MS).toBe(5 * MIN);
    expect(row.requestIp).toBe('1.2.3.4');
  });

  it('waits a minute between codes to the same number', async () => {
    await issuePhoneOtp({ phone: PHONE, purpose: 'LOGIN' });

    const again = await issuePhoneOtp({ phone: PHONE, purpose: 'LOGIN' });

    expect(again).toMatchObject({ ok: false, reason: 'COOLDOWN' });
    expect(sent).toHaveLength(1);

    store.age(61_000);
    expect((await issuePhoneOtp({ phone: PHONE, purpose: 'LOGIN' })).ok).toBe(true);
  });

  it('caps a phone number at five codes an hour, whatever they were for', async () => {
    for (let i = 0; i < PHONE_MAX_SENDS_PER_HOUR; i += 1) {
      store.age(61_000);
      expect((await issuePhoneOtp({ phone: PHONE, purpose: i % 2 ? 'LOGIN' : 'SIGNUP' })).ok).toBe(true);
    }
    store.age(61_000);

    expect(await issuePhoneOtp({ phone: PHONE, purpose: 'LOGIN' })).toEqual({ ok: false, reason: 'PHONE_LIMIT' });
    expect(sent).toHaveLength(PHONE_MAX_SENDS_PER_HOUR);
  });

  it('caps an IP address at ten codes an hour across different numbers', async () => {
    for (let i = 0; i < IP_MAX_SENDS_PER_HOUR; i += 1) {
      const phone = `+23324${String(1000000 + i)}`;
      expect((await issuePhoneOtp({ phone, purpose: 'SIGNUP', ip: '9.9.9.9' })).ok).toBe(true);
    }

    expect(await issuePhoneOtp({ phone: '+233551111111', purpose: 'SIGNUP', ip: '9.9.9.9' })).toEqual({ ok: false, reason: 'IP_LIMIT' });
    // A different address is unaffected.
    expect((await issuePhoneOtp({ phone: '+233551111111', purpose: 'SIGNUP', ip: '8.8.8.8' })).ok).toBe(true);
  });

  it('forgets a code the provider could not send, so it counts against nobody', async () => {
    sendMock.mockRejectedValueOnce(new Error('provider down'));

    expect(await issuePhoneOtp({ phone: PHONE, purpose: 'LOGIN' })).toEqual({ ok: false, reason: 'SMS_FAILED' });
    expect(store.all()).toHaveLength(0);
    expect((await issuePhoneOtp({ phone: PHONE, purpose: 'LOGIN' })).ok).toBe(true);
  });
});

describe('checking a code', () => {
  const subject = { phone: PHONE, purpose: 'LOGIN' as const };

  beforeEach(async () => {
    await issuePhoneOtp(subject);
  });

  it('accepts the right code, once', async () => {
    const code = lastCode();

    expect(await verifyPhoneOtp({ ...subject, code })).toEqual({ ok: true });
    expect(await verifyPhoneOtp({ ...subject, code })).toEqual({ ok: false, reason: 'NO_CODE' });
  });

  it('counts wrong tries and locks after five, even for the right code', async () => {
    const code = lastCode();

    for (let left = 4; left >= 1; left -= 1) {
      expect(await verifyPhoneOtp({ ...subject, code: '000000' })).toEqual({ ok: false, reason: 'WRONG', attemptsLeft: left });
    }
    expect(await verifyPhoneOtp({ ...subject, code: '000000' })).toEqual({ ok: false, reason: 'LOCKED' });
    expect(await verifyPhoneOtp({ ...subject, code })).toEqual({ ok: false, reason: 'LOCKED' });
  });

  it('rejects an expired code', async () => {
    const code = lastCode();
    store.age(PHONE_OTP_TTL_MS + 1000);

    expect(await verifyPhoneOtp({ ...subject, code })).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('a code for log-in cannot be used to sign up, or for another number', async () => {
    const code = lastCode();

    expect(await verifyPhoneOtp({ phone: PHONE, purpose: 'SIGNUP', code })).toEqual({ ok: false, reason: 'NO_CODE' });
    expect(await verifyPhoneOtp({ phone: '+233551234567', purpose: 'LOGIN', code })).toEqual({ ok: false, reason: 'NO_CODE' });
  });

  it('only one of two simultaneous right answers wins', async () => {
    const code = lastCode();

    const [first, second] = await Promise.all([verifyPhoneOtp({ ...subject, code }), verifyPhoneOtp({ ...subject, code })]);

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
  });
});

describe('phone sign-up', () => {
  const askForCode = (purpose: 'LOGIN' | 'SIGNUP') =>
    call(sendPhoneCode as never, { body: { phone: PHONE, purpose } });

  it('texts a code, then creates the account without an email, and logs the person in', async () => {
    expect((await askForCode('SIGNUP')).status).toBe(200);

    const result = await call(signupWithPhone as never, { body: { phone: PHONE, code: lastCode(), role: 'EMPLOYER' } });

    expect(result.status).toBe(201);
    const data = prismaMock.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ phone: PHONE, role: 'EMPLOYER' });
    expect(data.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty('email');
    expect(data.password).toMatch(/^\$2[aby]\$/);
    expect(prismaMock.employerProfile.create).toHaveBeenCalledWith({ data: { userId: 'user-new', companyName: 'New Company' } });
    expect(result.body).toMatchObject({ success: true, user: { phone: PHONE, email: null, role: 'EMPLOYER' } });
    expect(typeof result.body.token).toBe('string');
  });

  it('gives each phone account its own unusable password', async () => {
    await askForCode('SIGNUP');
    await call(signupWithPhone as never, { body: { phone: PHONE, code: lastCode(), role: 'SEEKER' } });
    const first = prismaMock.user.create.mock.calls[0][0].data.password;

    store.reset();
    await call(sendPhoneCode as never, { body: { phone: '+233551234567', purpose: 'SIGNUP' } });
    await call(signupWithPhone as never, { body: { phone: '+233551234567', code: lastCode(), role: 'SEEKER' } });

    expect(prismaMock.user.create.mock.calls[1][0].data.password).not.toBe(first);
  });

  it('does not create an account for a wrong code', async () => {
    await askForCode('SIGNUP');

    const result = await call(signupWithPhone as never, { body: { phone: PHONE, code: '000000', role: 'SEEKER' } });

    expect(result.status).toBe(400);
    expect(result.body.attemptsLeft).toBe(4);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('tells someone with an account to log in instead, and sends no text', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', status: 'ACTIVE' });

    const result = await askForCode('SIGNUP');

    expect(result.status).toBe(409);
    expect(sent).toHaveLength(0);
  });

  it('keeps freelancer sign-up closed while freelance is off', async () => {
    await askForCode('SIGNUP');

    const result = await call(signupWithPhone as never, { body: { phone: PHONE, code: lastCode(), role: 'FREELANCER' } });

    expect(result.status).toBe(403);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('handles two sign-ups racing for the same number', async () => {
    await askForCode('SIGNUP');
    prismaMock.user.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    const result = await call(signupWithPhone as never, { body: { phone: PHONE, code: lastCode(), role: 'SEEKER' } });

    expect(result.status).toBe(409);
  });
});

describe('phone log-in', () => {
  const member = { id: 'u1', role: 'SEEKER', status: 'ACTIVE', tokenVersion: 3, email: 'ama@example.com', phone: PHONE, emailVerified: true };

  it('texts a code to a known member, who then logs in with it', async () => {
    prismaMock.user.findUnique.mockResolvedValue(member);
    await call(sendPhoneCode as never, { body: { phone: PHONE, purpose: 'LOGIN' } });
    expect(sent).toHaveLength(1);

    const result = await call(loginWithPhone as never, { body: { phone: PHONE, code: lastCode() } });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, user: { id: 'u1', role: 'SEEKER', phone: PHONE } });
    expect(typeof result.body.token).toBe('string');
  });

  it('sends nothing, and says the same thing, for a number with no account', async () => {
    const known = await (async () => {
      prismaMock.user.findUnique.mockResolvedValue(member);
      return call(sendPhoneCode as never, { body: { phone: PHONE, purpose: 'LOGIN' } });
    })();
    sent.length = 0;
    store.reset();
    prismaMock.user.findUnique.mockResolvedValue(null);

    const unknown = await call(sendPhoneCode as never, { body: { phone: '+233551234567', purpose: 'LOGIN' } });

    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toMatch(/if this number has an account/i);
    expect(known.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it('refuses a wrong code and gives no token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(member);
    await call(sendPhoneCode as never, { body: { phone: PHONE, purpose: 'LOGIN' } });

    const result = await call(loginWithPhone as never, { body: { phone: PHONE, code: '000000' } });

    expect(result.status).toBe(400);
    expect(result.body.token).toBeUndefined();
  });

  it('gives an unknown number and a suspended member the same refusal as a bad code', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const unknown = await call(loginWithPhone as never, { body: { phone: PHONE, code: '123456' } });

    prismaMock.user.findUnique.mockResolvedValue({ ...member, status: 'SUSPENDED' });
    const suspended = await call(loginWithPhone as never, { body: { phone: PHONE, code: '123456' } });

    expect(unknown.status).toBe(400);
    expect(suspended.status).toBe(400);
    expect(unknown.body.message).toBe(suspended.body.message);
  });
});

describe('adding a phone to an existing account', () => {
  const asMember = { user: { id: 'u1', role: 'SEEKER' } };

  it('texts a code, then saves the number once confirmed', async () => {
    const asked = await call(sendAddPhoneCode as never, { ...asMember, body: { phone: PHONE } });
    expect(asked.status).toBe(200);

    const result = await call(confirmAddPhone as never, { ...asMember, body: { phone: PHONE, code: lastCode() } });

    expect(result.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { phone: PHONE, phoneVerifiedAt: expect.any(Date) },
    });
  });

  it('does not save the number before it is confirmed, or after a wrong code', async () => {
    await call(sendAddPhoneCode as never, { ...asMember, body: { phone: PHONE } });

    const result = await call(confirmAddPhone as never, { ...asMember, body: { phone: PHONE, code: '000000' } });

    expect(result.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('refuses a number that belongs to another account, without texting it', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'someone-else' });

    const result = await call(sendAddPhoneCode as never, { ...asMember, body: { phone: PHONE } });

    expect(result.status).toBe(409);
    expect(result.body.message).toMatch(/another account/);
    expect(sent).toHaveLength(0);
  });

  it('says so when the number is already on your own account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

    const result = await call(sendAddPhoneCode as never, { ...asMember, body: { phone: PHONE } });

    expect(result.status).toBe(409);
    expect(result.body.message).toMatch(/already on your account/);
  });

  it('a code asked for by one member cannot be used by another', async () => {
    await call(sendAddPhoneCode as never, { ...asMember, body: { phone: PHONE } });

    const result = await call(confirmAddPhone as never, { user: { id: 'u2', role: 'SEEKER' }, body: { phone: PHONE, code: lastCode() } });

    expect(result.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('copes with someone else confirming the same number first', async () => {
    await call(sendAddPhoneCode as never, { ...asMember, body: { phone: PHONE } });
    prismaMock.user.update.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    const result = await call(confirmAddPhone as never, { ...asMember, body: { phone: PHONE, code: lastCode() } });

    expect(result.status).toBe(409);
  });
});

describe('employer verification by phone, through the same SMS service', () => {
  const request = (overrides: Record<string, unknown> = {}) => ({
    id: 'ver-1',
    userId: 'emp-1',
    type: 'BUSINESS',
    status: 'PENDING',
    contactEmail: null,
    contactPhone: PHONE,
    contactVerifiedAt: null,
    user: { employerProfile: { companyName: 'Achiba Star Hotel' } },
    ...overrides,
  });

  beforeEach(() => {
    prismaMock.verificationRequest.findUnique.mockResolvedValue(request());
    prismaMock.verificationRequest.update.mockResolvedValue({});
    prismaMock.contactVerificationCode.findFirst.mockResolvedValue(null);
  });

  it('texts the company phone when there is no email', async () => {
    const result = await sendContactCode('ver-1', 'emp-1', new Date(), { ip: '1.1.1.1' });

    expect(result).toEqual({ ok: true, channel: 'PHONE' });
    expect(sent[0].to).toBe(PHONE);
    expect(store.all()[0]).toMatchObject({ purpose: 'EMPLOYER_VERIFICATION', subjectId: 'ver-1', requestIp: '1.1.1.1' });
  });

  it('can be asked for the phone even when there is also an email', async () => {
    prismaMock.verificationRequest.findUnique.mockResolvedValue(request({ contactEmail: 'hr@achiba.example' }));

    expect(await sendContactCode('ver-1', 'emp-1', new Date(), { channel: 'PHONE' })).toEqual({ ok: true, channel: 'PHONE' });
  });

  it('confirms the company contact with the texted code and records that it was the phone', async () => {
    await sendContactCode('ver-1', 'emp-1');

    const result = await confirmContactCode('ver-1', 'emp-1', lastCode());

    expect(result).toEqual({ ok: true, channel: 'PHONE' });
    expect(prismaMock.verificationRequest.update).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
      data: { contactVerifiedAt: expect.any(Date), contactVerifiedVia: 'PHONE' },
    });
  });

  it('shares the phone limits: no more than five texts an hour to one number', async () => {
    for (let i = 0; i < PHONE_MAX_SENDS_PER_HOUR; i += 1) {
      store.age(61_000);
      expect((await sendContactCode('ver-1', 'emp-1')).ok).toBe(true);
    }
    store.age(61_000);

    expect(await sendContactCode('ver-1', 'emp-1')).toEqual({ ok: false, reason: 'TOO_MANY' });
  });

  it('asks the employer to add a phone before sending one', async () => {
    prismaMock.verificationRequest.findUnique.mockResolvedValue(request({ contactPhone: null, contactEmail: 'hr@achiba.example' }));

    expect(await sendContactCode('ver-1', 'emp-1', new Date(), { channel: 'PHONE' })).toEqual({ ok: false, reason: 'NO_PHONE' });
    expect(sent).toHaveLength(0);
  });

  it('only the owner can ask for or confirm a texted code', async () => {
    expect(await sendContactCode('ver-1', 'someone-else')).toEqual({ ok: false, reason: 'NOT_FOUND' });
    await sendContactCode('ver-1', 'emp-1');
    expect(await confirmContactCode('ver-1', 'someone-else', lastCode())).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('a wrong texted code does not confirm anything', async () => {
    await sendContactCode('ver-1', 'emp-1');

    expect(await confirmContactCode('ver-1', 'emp-1', '000000')).toEqual({ ok: false, reason: 'WRONG', attemptsLeft: 4 });
    expect(prismaMock.verificationRequest.update).not.toHaveBeenCalled();
  });
});
