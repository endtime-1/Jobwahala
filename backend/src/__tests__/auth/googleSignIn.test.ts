import crypto from 'crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  jobSeekerProfile: { create: vi.fn() },
  employerProfile: { create: vi.fn() },
  freelancerProfile: { create: vi.fn() },
}));

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/emailService', () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }));

import env from '../../config/env';
import { continueWithGoogle } from '../../controllers/authController';
import { GoogleAuthError, setGoogleKeyFetcherForTests, verifyGoogleIdToken } from '../../services/googleAuth';
import { googleAuthSchema } from '../../validation/authSchemas';

const CLIENT_ID = 'jobwahala-test.apps.googleusercontent.com';

const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'key-1', alg: 'RS256', use: 'sig' };

const sign = (claims: Record<string, unknown> = {}, options: jwt.SignOptions & { key?: crypto.KeyObject; kid?: string } = {}) =>
  jwt.sign(
    { sub: 'google-sub-1', email: 'Ama@Example.com', email_verified: true, given_name: 'Ama', family_name: 'Mensah', ...claims },
    (options.key ?? pair.privateKey) as crypto.KeyObject,
    {
      algorithm: 'RS256',
      keyid: options.kid ?? 'key-1',
      issuer: 'https://accounts.google.com',
      audience: CLIENT_ID,
      expiresIn: '1h',
      ...(({ key: _key, kid: _kid, ...rest }) => rest)(options),
    },
  );

beforeEach(() => {
  vi.clearAllMocks();
  setGoogleKeyFetcherForTests(async () => ({ keys: [publicJwk as never], maxAgeMs: 60_000 }));
  (env as { googleClientId: string }).googleClientId = CLIENT_ID;
  prismaMock.user.findUnique.mockResolvedValue(null);
});

afterEach(() => {
  setGoogleKeyFetcherForTests();
  (env as { googleClientId: string }).googleClientId = '';
});

describe('checking the Google token', () => {
  it('accepts a token Google signed for our client id and reads who it is', async () => {
    const identity = await verifyGoogleIdToken(sign(), CLIENT_ID);

    expect(identity).toEqual({ subject: 'google-sub-1', email: 'ama@example.com', emailVerified: true, givenName: 'Ama', familyName: 'Mensah' });
  });

  it('accepts the older issuer spelling', async () => {
    await expect(verifyGoogleIdToken(sign({}, { issuer: 'accounts.google.com' }), CLIENT_ID)).resolves.toMatchObject({ subject: 'google-sub-1' });
  });

  it('refuses a token made for a different app', async () => {
    await expect(verifyGoogleIdToken(sign({}, { audience: 'someone-else.apps.googleusercontent.com' }), CLIENT_ID)).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('refuses a token from anyone but Google', async () => {
    await expect(verifyGoogleIdToken(sign({}, { issuer: 'https://evil.example.com' }), CLIENT_ID)).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('refuses an expired token', async () => {
    await expect(verifyGoogleIdToken(sign({}, { expiresIn: -60 }), CLIENT_ID)).rejects.toThrow(/expired|not valid/i);
  });

  it('refuses a token signed with some other key, even with Google key id', async () => {
    await expect(verifyGoogleIdToken(sign({}, { key: otherPair.privateKey }), CLIENT_ID)).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('refuses a key id Google does not publish', async () => {
    await expect(verifyGoogleIdToken(sign({}, { kid: 'unknown' }), CLIENT_ID)).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('refuses tokens that are not signed with RS256, including "none" and shared-secret ones', async () => {
    const unsigned = jwt.sign({ sub: 'x', email: 'a@b.com' }, '', { algorithm: 'none' as never, audience: CLIENT_ID, issuer: 'https://accounts.google.com', keyid: 'key-1' });
    const shared = jwt.sign({ sub: 'x', email: 'a@b.com' }, 'secret', { algorithm: 'HS256', audience: CLIENT_ID, issuer: 'https://accounts.google.com', keyid: 'key-1' });

    await expect(verifyGoogleIdToken(unsigned, CLIENT_ID)).rejects.toBeInstanceOf(GoogleAuthError);
    await expect(verifyGoogleIdToken(shared, CLIENT_ID)).rejects.toBeInstanceOf(GoogleAuthError);
    await expect(verifyGoogleIdToken('not-a-token', CLIENT_ID)).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('refuses a tampered token', async () => {
    const [header, payload, signature] = sign().split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), email: 'boss@example.com' })).toString('base64url');

    await expect(verifyGoogleIdToken(`${header}.${forged}.${signature}`, CLIENT_ID)).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('needs the app to be set up', async () => {
    await expect(verifyGoogleIdToken(sign(), '')).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('reads an email_verified sent as text, and a missing one as not verified', async () => {
    expect((await verifyGoogleIdToken(sign({ email_verified: 'true' }), CLIENT_ID)).emailVerified).toBe(true);
    expect((await verifyGoogleIdToken(sign({ email_verified: undefined }), CLIENT_ID)).emailVerified).toBe(false);
  });

  it('looks for new keys once when it meets a key id it has not seen', async () => {
    const fetcher = vi.fn(async () => ({ keys: [publicJwk as never], maxAgeMs: 60_000 }));
    setGoogleKeyFetcherForTests(fetcher);

    await verifyGoogleIdToken(sign(), CLIENT_ID);
    await verifyGoogleIdToken(sign(), CLIENT_ID);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('the sign-in request', () => {
  const parse = (body: unknown) => googleAuthSchema.safeParse({ body }).success;

  it('needs a token; the role is only for new accounts and can only be job seeker or employer', () => {
    expect(parse({ credential: 'x'.repeat(30) })).toBe(true);
    expect(parse({ credential: 'x'.repeat(30), role: 'employer' })).toBe(true);
    expect(parse({ credential: 'x'.repeat(30), role: 'ADMIN' })).toBe(false);
    expect(parse({ credential: 'x'.repeat(30), role: 'FREELANCER' })).toBe(false);
    expect(parse({})).toBe(false);
    expect(parse({ credential: 'x'.repeat(30), extra: 1 })).toBe(false);
  });
});

describe('continuing with Google', () => {
  const respond = () => {
    const state: { status: number; body: any } = { status: 200, body: undefined };
    const res = {
      status(code: number) {
        state.status = code;
        return this;
      },
      json(value: unknown) {
        state.body = value;
        return this;
      },
    } as unknown as Response;
    return { res, state };
  };
  const go = async (body: Record<string, unknown>) => {
    const { res, state } = respond();
    await continueWithGoogle({ body } as Request, res);
    return state;
  };

  const member = (overrides: Record<string, unknown> = {}) => ({
    id: 'u1',
    email: 'ama@example.com',
    phone: null,
    role: 'SEEKER',
    status: 'ACTIVE',
    emailVerified: true,
    googleId: null,
    tokenVersion: 3,
    password: 'hash',
    ...overrides,
  });

  const tokenOf = (state: { body: any }) => jwt.decode(state.body.token) as { id: string; role: string; tokenVersion: number };

  it('is off, with a plain message, until a Google client id is set', async () => {
    (env as { googleClientId: string }).googleClientId = '';

    const state = await go({ credential: sign() });

    expect(state.status).toBe(503);
    expect(state.body.code).toBe('GOOGLE_NOT_CONFIGURED');
  });

  it('logs in someone who used Google before', async () => {
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { googleId?: string } }) => (where.googleId ? member({ googleId: 'google-sub-1' }) : null));

    const state = await go({ credential: sign() });

    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({ success: true, isNew: false, user: { id: 'u1', role: 'SEEKER', emailVerified: true } });
    expect(tokenOf(state)).toMatchObject({ id: 'u1', role: 'SEEKER', tokenVersion: 3 });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('links Google to an existing account with the same verified email, keeping its password and sessions', async () => {
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { email?: string } }) => (where.email === 'ama@example.com' ? member() : null));
    prismaMock.user.update.mockImplementation(async ({ data }: { data: object }) => ({ ...member(), ...data }));

    const state = await go({ credential: sign() });

    expect(state.status).toBe(200);
    expect(state.body.isNew).toBe(false);
    const data = prismaMock.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ googleId: 'google-sub-1', emailVerified: true });
    expect(data).not.toHaveProperty('password');
    expect(data).not.toHaveProperty('tokenVersion');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('works for employers too', async () => {
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { email?: string } }) => (where.email ? member({ role: 'EMPLOYER' }) : null));
    prismaMock.user.update.mockImplementation(async ({ data }: { data: object }) => ({ ...member({ role: 'EMPLOYER' }), ...data }));

    const state = await go({ credential: sign() });

    expect(state.body.user.role).toBe('EMPLOYER');
    expect(tokenOf(state).role).toBe('EMPLOYER');
  });

  it('if the old account never confirmed its email, its password and sessions are cancelled when Google is linked', async () => {
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { email?: string } }) => (where.email ? member({ emailVerified: false }) : null));
    prismaMock.user.update.mockImplementation(async ({ data }: { data: any }) => ({ ...member({ emailVerified: false }), ...data, tokenVersion: 4 }));

    await go({ credential: sign() });

    const data = prismaMock.user.update.mock.calls[0][0].data;
    expect(data.password).toEqual(expect.any(String));
    expect(data.password).not.toBe('hash');
    expect(data.tokenVersion).toEqual({ increment: 1 });
  });

  it('creates a seeker account, with a verified email, their name, and a password nobody knows', async () => {
    prismaMock.user.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'new-1', phone: null, tokenVersion: 0, status: 'ACTIVE', ...data }));

    const state = await go({ credential: sign(), role: 'SEEKER' });

    expect(state.status).toBe(201);
    expect(state.body).toMatchObject({ isNew: true, user: { email: 'ama@example.com', role: 'SEEKER', emailVerified: true } });
    expect(prismaMock.user.create.mock.calls[0][0].data).toMatchObject({ email: 'ama@example.com', googleId: 'google-sub-1', emailVerified: true, role: 'SEEKER' });
    expect(prismaMock.user.create.mock.calls[0][0].data.password).toHaveLength(60);
    expect(prismaMock.jobSeekerProfile.create).toHaveBeenCalledWith({ data: { userId: 'new-1', firstName: 'Ama', lastName: 'Mensah' } });
  });

  it('creates an employer account that goes on to company set-up', async () => {
    prismaMock.user.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'new-2', phone: null, tokenVersion: 0, ...data }));

    const state = await go({ credential: sign(), role: 'EMPLOYER' });

    expect(state.status).toBe(201);
    expect(prismaMock.employerProfile.create).toHaveBeenCalledWith({ data: { userId: 'new-2', companyName: 'New Company' } });
  });

  it('asks which one when a new person has not said whether they want a job or are hiring', async () => {
    const state = await go({ credential: sign() });

    expect(state.status).toBe(404);
    expect(state.body.code).toBe('ROLE_REQUIRED');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('refuses a Google email that Google has not verified, and touches nothing', async () => {
    const state = await go({ credential: sign({ email_verified: false }), role: 'SEEKER' });

    expect(state.status).toBe(400);
    expect(state.body.message).toMatch(/not verified/i);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('refuses a forged or expired token', async () => {
    const state = await go({ credential: sign({}, { key: otherPair.privateKey }) });

    expect(state.status).toBe(401);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not log in a suspended account', async () => {
    prismaMock.user.findUnique.mockResolvedValue(member({ status: 'SUSPENDED', googleId: 'google-sub-1' }));

    const state = await go({ credential: sign() });

    expect(state.status).toBe(403);
    expect(state.body).not.toHaveProperty('token');
  });

  it('refuses when the email belongs to an account tied to a different Google account', async () => {
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { email?: string } }) => (where.email ? member({ googleId: 'someone-else' }) : null));

    const state = await go({ credential: sign() });

    expect(state.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
