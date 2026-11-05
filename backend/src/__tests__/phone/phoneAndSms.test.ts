import { describe, expect, it, vi } from 'vitest';
import { ArkeselSmsProvider } from '../../services/sms/arkeselProvider';
import { buildSmsProvider } from '../../services/sms';
import { SmsSendError } from '../../services/sms/types';
import { isGhanaMobile, maskPhone, normalizeGhanaPhone } from '../../utils/phone';
import {
  addPhoneSchema,
  phoneLoginSchema,
  phoneSignupSchema,
  sendPhoneCodeSchema,
} from '../../validation/authSchemas';
import { createBusinessVerificationRequestSchema } from '../../validation/verificationSchemas';

describe('Ghanaian phone numbers', () => {
  it('turns every usual way of typing a number into +233 form', () => {
    for (const typed of [
      '024 123 4567',
      '0241234567',
      '024-123-4567',
      '233241234567',
      '+233241234567',
      '+233 24 123 4567',
      '00233241234567',
      '(024) 123 4567',
    ]) {
      expect(normalizeGhanaPhone(typed)).toBe('+233241234567');
    }
  });

  it('accepts the real mobile prefixes', () => {
    for (const prefix of ['20', '23', '24', '25', '26', '27', '28', '29', '50', '53', '54', '55', '56', '57', '59']) {
      expect(normalizeGhanaPhone(`0${prefix}1234567`)).toBe(`+233${prefix}1234567`);
    }
  });

  it('turns away landlines, other countries, wrong lengths and junk', () => {
    for (const bad of [
      '0301234567', // Accra landline
      '+2348031234567', // Nigeria
      '+14155552671', // US
      '02412345', // too short
      '024123456789', // too long
      '0211234567', // unused prefix
      '0581234567', // unused prefix
      'abc',
      '',
      '24 123 4567', // no leading 0 or country code
    ]) {
      expect(normalizeGhanaPhone(bad)).toBeNull();
    }
  });

  it('recognises a stored number and hides most of it when showing it back', () => {
    expect(isGhanaMobile('+233241234567')).toBe(true);
    expect(isGhanaMobile('0241234567')).toBe(false);
    expect(maskPhone('+233241234567')).toBe('+233 24 *** **67');
  });
});

describe('phone request validation', () => {
  it('accepts a typed number and stores it in +233 form', () => {
    const parsed = sendPhoneCodeSchema.safeParse({ body: { phone: '024 123 4567', purpose: 'LOGIN' } });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.body.phone).toBe('+233241234567');
  });

  it('rejects numbers that are not Ghanaian mobiles, with a plain message', () => {
    const parsed = sendPhoneCodeSchema.safeParse({ body: { phone: '0301234567', purpose: 'LOGIN' } });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toMatch(/Ghanaian mobile number/);
  });

  it('only allows LOGIN or SIGNUP when asking for a code', () => {
    expect(sendPhoneCodeSchema.safeParse({ body: { phone: '0241234567', purpose: 'ADD_PHONE' } }).success).toBe(false);
  });

  it('needs a six-digit code to log in or sign up', () => {
    expect(phoneLoginSchema.safeParse({ body: { phone: '0241234567', code: '123456' } }).success).toBe(true);
    expect(phoneLoginSchema.safeParse({ body: { phone: '0241234567', code: '12345' } }).success).toBe(false);
    expect(phoneLoginSchema.safeParse({ body: { phone: '0241234567', code: 'abcdef' } }).success).toBe(false);
  });

  it('signs up as a seeker unless told otherwise, and rejects unknown roles and fields', () => {
    const base = { phone: '0241234567', code: '123456' };
    const parsed = phoneSignupSchema.safeParse({ body: base });
    expect(parsed.success && parsed.data.body.role).toBe('SEEKER');
    expect(phoneSignupSchema.safeParse({ body: { ...base, role: 'employer' } }).success).toBe(true);
    expect(phoneSignupSchema.safeParse({ body: { ...base, role: 'ADMIN' } }).success).toBe(false);
    expect(phoneSignupSchema.safeParse({ body: { ...base, extra: 1 } }).success).toBe(false);
  });

  it('checks the phone when adding one to an account', () => {
    expect(addPhoneSchema.safeParse({ body: { phone: '024 123 4567' } }).success).toBe(true);
    expect(addPhoneSchema.safeParse({ body: { phone: '12345' } }).success).toBe(false);
  });

  it('employer verification takes an email, a phone or both, but not neither', () => {
    const base = {
      registrationNumber: 'CS123456789',
      documentUrl: 'https://x/cert.pdf',
      address: '12 Ring Road, Accra, Ghana',
    };
    const parse = (extra: object) => createBusinessVerificationRequestSchema.safeParse({ body: { ...base, ...extra } });

    expect(parse({ contactEmail: 'hr@achiba.example' }).success).toBe(true);
    expect(parse({ contactPhone: '024 123 4567' }).success).toBe(true);
    expect(parse({ contactEmail: 'hr@achiba.example', contactPhone: '0241234567' }).success).toBe(true);
    expect(parse({}).success).toBe(false);
    expect(parse({ contactPhone: '0301234567' }).success).toBe(false);
  });
});

describe('Arkesel provider', () => {
  const okResponse = () => new Response(JSON.stringify({ status: 'success', data: [{ recipient: '233241234567', id: 'x' }] }), { status: 200 });
  const make = (fetchImpl: typeof fetch, apiKey = 'secret-key') =>
    new ArkeselSmsProvider({ apiKey, senderId: 'JobWahala', fetchImpl });

  it('sends one authenticated POST with the number in international form, no plus', async () => {
    const fetchMock = vi.fn(async () => okResponse());

    await make(fetchMock as unknown as typeof fetch).send('+233241234567', 'Your code is 123456');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://sms.arkesel.com/api/v2/sms/send');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['api-key']).toBe('secret-key');
    expect(JSON.parse(init.body as string)).toEqual({
      sender: 'JobWahala',
      message: 'Your code is 123456',
      recipients: ['233241234567'],
    });
  });

  it('fails when Arkesel says no, without leaking the key', async () => {
    const refused = vi.fn(async () => new Response(JSON.stringify({ status: 'error', message: 'Invalid sender' }), { status: 200 }));
    const failure = await make(refused as unknown as typeof fetch).send('+233241234567', 'x').catch((error) => error);

    expect(failure).toBeInstanceOf(SmsSendError);
    expect(failure.message).toMatch(/Invalid sender/);
    expect(failure.message).not.toContain('secret-key');
  });

  it('fails on an HTTP error', async () => {
    const down = vi.fn(async () => new Response('Bad gateway', { status: 502 }));
    await expect(make(down as unknown as typeof fetch).send('+233241234567', 'x')).rejects.toThrow(/HTTP 502/);
  });

  it('fails clearly when it cannot be reached or times out', async () => {
    const unreachable = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(make(unreachable as unknown as typeof fetch).send('+233241234567', 'x')).rejects.toThrow(/could not be reached/);

    const timedOut = vi.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    await expect(make(timedOut as unknown as typeof fetch).send('+233241234567', 'x')).rejects.toThrow(/timed out/);
  });

  it('will not even try without an API key', async () => {
    const fetchMock = vi.fn();
    await expect(make(fetchMock as unknown as typeof fetch, '').send('+233241234567', 'x')).rejects.toThrow(/ARKESEL_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('choosing the SMS provider', () => {
  const settings = { arkeselApiKey: 'k', arkeselSenderId: 'JobWahala' };

  it('builds Arkesel from settings', () => {
    expect(buildSmsProvider({ ...settings, provider: 'arkesel', isProduction: true }).name).toBe('ARKESEL');
  });

  it('allows the log-only provider in development but never in production', () => {
    expect(buildSmsProvider({ ...settings, provider: 'CONSOLE', isProduction: false }).name).toBe('CONSOLE');
    expect(() => buildSmsProvider({ ...settings, provider: 'CONSOLE', isProduction: true })).toThrow(/production/);
  });

  it('refuses a provider it does not know', () => {
    expect(() => buildSmsProvider({ ...settings, provider: 'CARRIER-PIGEON', isProduction: false })).toThrow(/Unknown SMS_PROVIDER/);
  });
});
