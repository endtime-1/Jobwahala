import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setupExpressErrorHandler: vi.fn(),
}));

vi.mock('@sentry/node', () => sentry);

import { initSentry, isSentryOn, reportError } from '../../config/sentry';
import { scrubEvent, scrubString, scrubUrl, scrubValue } from '../../utils/errorScrub';
import { getErrorMessage } from '../../utils/errors';

describe('scrubbing text', () => {
  it('removes email addresses', () => {
    expect(scrubString('Could not email ama.mensah+jobs@example.co.uk about the job')).toBe('Could not email [email] about the job');
  });

  it('removes phone numbers however they are written', () => {
    for (const phone of ['+233241234567', '0241234567', '024 123 4567', '+233 24 123 4567', '(024) 123-4567', '233241234567']) {
      expect(scrubString(`failed to text ${phone} now`)).toBe('failed to text [phone] now');
    }
  });

  it('leaves ordinary numbers alone', () => {
    expect(scrubString('retry 3 times after 1500ms, status 500, port 5432')).toBe('retry 3 times after 1500ms, status 500, port 5432');
    expect(scrubString('job 2026-11-05 id 123456')).toBe('job 2026-11-05 id 123456');
  });

  it('removes sign-in tokens and long secrets', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InUxIn0.abc123SIGNATURE';
    expect(scrubString(`bad token ${jwt}`)).toBe('bad token [token]');
    expect(scrubString('Authorization: Bearer abcdef1234567890xyz')).toBe('Authorization: Bearer [token]');
    expect(scrubString('reset 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')).toBe('reset [token]');
  });

  it('removes one-time codes mentioned in text', () => {
    expect(scrubString('Your code is 482913')).toBe('Your code is [code]');
    expect(scrubString('otp: 123456 expired')).toBe('otp: [code] expired');
  });

  it('removes secrets from URLs, and the whole query string when asked for a clean URL', () => {
    expect(scrubString('GET /verify-email?token=abc123def&x=1')).toBe('GET /verify-email?token=[redacted]&x=1');
    expect(scrubUrl('https://jobwahala.com/reset-password?token=abc&email=a@b.com#frag')).toBe('https://jobwahala.com/reset-password');
  });
});

describe('scrubbing objects', () => {
  it('redacts values by field name, at any depth', () => {
    const result = scrubValue({
      user: { email: 'a@b.com', phone: '0241234567', firstName: 'Ama', role: 'SEEKER' },
      password: 'hunter2',
      list: [{ token: 'abc', jobId: 'job-1' }],
      note: 'call ama@example.com',
    }) as any;

    expect(result.user.email).toBe('[redacted]');
    expect(result.user.phone).toBe('[redacted]');
    expect(result.user.firstName).toBe('[redacted]');
    expect(result.user.role).toBe('SEEKER');
    expect(result.password).toBe('[redacted]');
    expect(result.list[0]).toEqual({ token: '[redacted]', jobId: 'job-1' });
    expect(result.note).toBe('call [email]');
  });

  it('survives very deep and circular-looking structures', () => {
    const deep: any = {};
    let cursor = deep;
    for (let i = 0; i < 20; i += 1) cursor = cursor.next = {};
    expect(() => scrubValue(deep)).not.toThrow();
  });
});

describe('scrubbing a whole error report', () => {
  const event = () => ({
    message: 'Sign-in failed for ama@example.com from 0241234567',
    user: { id: 'u1', email: 'ama@example.com', ip_address: '1.2.3.4', username: 'ama' },
    server_name: 'railway-host-7',
    request: {
      method: 'POST',
      url: 'https://jobwahala.com/api/auth/login?token=secret',
      headers: { authorization: 'Bearer abcdef1234567890xyz', cookie: 'a=b' },
      cookies: { session: 'x' },
      data: { email: 'ama@example.com', password: 'hunter2' },
      query_string: 'token=secret',
    },
    exception: {
      values: [
        {
          type: 'Error',
          value: 'No user with email ama@example.com',
          stacktrace: { frames: [{ filename: 'authController.js', lineno: 42, function: 'login', vars: { password: 'hunter2', email: 'ama@example.com' } }] },
        },
      ],
    },
    breadcrumbs: [{ category: 'console', message: 'user ama@example.com clicked' }],
    extra: { body: { coverLetter: 'private words' }, route: '/api/auth/login' },
    tags: { who: 'ama@example.com', area: 'auth' },
    contexts: { os: { name: 'Linux' }, runtime: { name: 'node' }, request: { data: 'x' }, custom: { email: 'ama@example.com' } },
  });

  it('keeps what broke and where', () => {
    const out = scrubEvent(event()) as any;

    expect(out.exception.values[0].type).toBe('Error');
    expect(out.exception.values[0].stacktrace.frames[0]).toMatchObject({ filename: 'authController.js', lineno: 42, function: 'login' });
    expect(out.request).toEqual({ method: 'POST', url: 'https://jobwahala.com/api/auth/login' });
    expect(out.contexts).toEqual({ os: { name: 'Linux' }, runtime: { name: 'node' } });
    expect(out.extra.route).toBe('/api/auth/login');
    expect(out.tags.area).toBe('auth');
  });

  it('removes who it happened to', () => {
    const out = scrubEvent(event()) as any;

    expect(out.user).toEqual({ id: 'u1' });
    expect(out.server_name).toBeUndefined();
    expect(out.message).toBe('Sign-in failed for [email] from [phone]');
    expect(out.exception.values[0].value).toBe('No user with email [email]');
    expect(out.exception.values[0].stacktrace.frames[0]).not.toHaveProperty('vars');
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.request).not.toHaveProperty('headers');
    expect(out.request).not.toHaveProperty('cookies');
    expect(out.request).not.toHaveProperty('data');
    expect(out.request).not.toHaveProperty('query_string');
    expect(out.extra.body).toBe('[redacted]');
    expect(out.tags.who).toBe('[email]');
  });

  it('leaves no trace of any personal value anywhere in the report', () => {
    const text = JSON.stringify(scrubEvent(event()));

    for (const secret of ['ama@example.com', '0241234567', 'hunter2', 'abcdef1234567890xyz', 'private words', '1.2.3.4', 'token=secret']) {
      expect(text).not.toContain(secret);
    }
  });

  it('drops the user entirely when there is no account id, and copes with a minimal event', () => {
    expect((scrubEvent({ user: { email: 'a@b.com' } }) as any).user).toBeUndefined();
    expect(() => scrubEvent({})).not.toThrow();
  });

  it('does not change the event it was given', () => {
    const original = event();
    scrubEvent(original);
    expect(original.user.email).toBe('ama@example.com');
  });
});

describe('Sentry setup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing at all without a DSN', () => {
    expect(initSentry({ dsn: '', environment: 'test' })).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('starts with every kind of personal data collection switched off', () => {
    expect(initSentry({ dsn: 'https://key@o1.ingest.sentry.io/1', environment: 'production', release: 'abc123' })).toBe(true);

    const options = sentry.init.mock.calls[0][0];
    expect(options).toMatchObject({ dsn: 'https://key@o1.ingest.sentry.io/1', environment: 'production', release: 'abc123', tracesSampleRate: 0, maxBreadcrumbs: 0 });
    expect(options.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    });
    expect(isSentryOn()).toBe(true);
  });

  it('runs every event through the scrubber before it is sent, and sends no breadcrumbs', () => {
    initSentry({ dsn: 'https://key@o1.ingest.sentry.io/1', environment: 'production' });
    const options = sentry.init.mock.calls[0][0];

    const sent = options.beforeSend({ message: 'failed for ama@example.com', user: { email: 'ama@example.com', id: 'u1' } });

    expect(sent.message).toBe('failed for [email]');
    expect(sent.user).toEqual({ id: 'u1' });
    expect(options.beforeBreadcrumb({ message: 'anything' })).toBeNull();
  });

  describe('reporting errors the controllers catch', () => {
    beforeEach(() => {
      initSentry({ dsn: 'https://key@o1.ingest.sentry.io/1', environment: 'production' });
      sentry.captureException.mockClear();
    });

    it('reports a real failure', () => {
      reportError(new Error('database exploded'));
      expect(sentry.captureException).toHaveBeenCalledTimes(1);
    });

    it('does not report the caller\'s mistakes', () => {
      reportError(Object.assign(new Error('Origin is not allowed by CORS'), { status: 403 }));
      reportError(Object.assign(new Error('not found'), { statusCode: 404 }));
      reportError(Object.assign(new Error('bad'), { name: 'ZodError' }));
      expect(sentry.captureException).not.toHaveBeenCalled();
    });

    it('reports a 500-class error that carries a status', () => {
      reportError(Object.assign(new Error('upstream down'), { status: 502 }));
      expect(sentry.captureException).toHaveBeenCalledTimes(1);
    });

    it('ignores things that are not errors', () => {
      reportError('just a string');
      reportError(undefined);
      expect(sentry.captureException).not.toHaveBeenCalled();
    });

    it('is called whenever a controller turns an error into a message', () => {
      expect(getErrorMessage(new Error('boom'))).toBe('boom');
      expect(sentry.captureException).toHaveBeenCalledTimes(1);
    });
  });
});
