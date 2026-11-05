/**
 * Removes personal data from an error report before it leaves our servers (Sentry or any other).
 *
 * The rule: a crash report should say WHAT broke and WHERE, never WHO it happened to. So emails, phone
 * numbers, tokens, passwords, one-time codes, message text and request bodies are stripped; the stack,
 * the error type, the route and the status stay.
 *
 * This file is deliberately self-contained and has a twin in the backend (backend/src/utils/errorScrub.ts).
 * Keep the two in step.
 */

type Json = Record<string, any>;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 9 or more digits, allowing spaces, dots, dashes and brackets between them: a phone number.
const PHONE = /(?<![\w.])\(?\+?\d(?:[\s().-]{0,2}\d){8,}(?![\w])/g;
const JWT = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const LONG_HEX = /\b[A-Fa-f0-9]{32,}\b/g;
const CODE_IN_TEXT = /\b(code|otp|pin)\b([^0-9\n]{0,15})\d{4,8}\b/gi;
const SECRET_IN_URL = /([?&](?:token|code|key|secret|password|otp|session)=)[^&#\s]+/gi;

/** Field names whose values are never sent, whatever they contain. */
const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|authorization|cookie|api[-_]?key|otp|^code$|captcha|email|phone|mobile|address|account(number|name)|bank|card|cvv|^message$|^content$|^body$|^data$|cover(letter)?|^details$|^reason$|first_?name|last_?name|^name$|company_?name/i;

const MAX_DEPTH = 6;

export const scrubString = (value: string): string =>
  value
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(SECRET_IN_URL, '$1[redacted]')
    .replace(EMAIL, '[email]')
    .replace(PHONE, '[phone]')
    .replace(LONG_HEX, '[token]')
    .replace(CODE_IN_TEXT, '$1$2[code]');

/** A URL with no query string or fragment, and nothing personal in what is left. */
export const scrubUrl = (url: string): string => scrubString(url.split(/[?#]/)[0]);

export const scrubValue = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));

  const result: Json = {};
  for (const [key, entry] of Object.entries(value as Json)) {
    result[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : scrubValue(entry, depth + 1);
  }
  return result;
};

/** Contexts that describe the machine, not the person. Everything else is dropped. */
const SAFE_CONTEXTS = new Set(['os', 'runtime', 'browser', 'device', 'trace', 'app']);

export const scrubEvent = <T extends Json>(event: T): T => {
  const out: Json = { ...event };

  // Who: keep only the opaque account id, if it was set.
  out.user = event.user?.id ? { id: String(event.user.id) } : undefined;
  delete out.server_name;

  // What the request was: method and path only. No headers, cookies, body or query string.
  if (event.request) {
    out.request = {
      ...(event.request.method ? { method: event.request.method } : {}),
      ...(event.request.url ? { url: scrubUrl(String(event.request.url)) } : {}),
    };
  }

  if (typeof event.message === 'string') out.message = scrubString(event.message);
  if (event.logentry?.message) out.logentry = { ...event.logentry, message: scrubString(String(event.logentry.message)), params: undefined };
  if (typeof event.transaction === 'string') out.transaction = scrubUrl(event.transaction);

  if (event.exception?.values) {
    out.exception = {
      ...event.exception,
      values: event.exception.values.map((entry: Json) => ({
        ...entry,
        value: typeof entry.value === 'string' ? scrubString(entry.value) : entry.value,
        stacktrace: entry.stacktrace
          ? {
              ...entry.stacktrace,
              // Local variable values are where passwords and names hide, so they never go.
              frames: (entry.stacktrace.frames ?? []).map((frame: Json) => {
                const { vars: _vars, ...rest } = frame;
                return rest;
              }),
            }
          : entry.stacktrace,
      })),
    };
  }

  // Breadcrumbs record clicks, console output and requests: too much personal text to trust. None are sent.
  out.breadcrumbs = undefined;

  if (event.extra) out.extra = scrubValue(event.extra);
  if (event.tags) out.tags = scrubValue(event.tags);
  if (event.contexts) {
    out.contexts = Object.fromEntries(Object.entries(event.contexts).filter(([key]) => SAFE_CONTEXTS.has(key)));
  }

  return out as T;
};
