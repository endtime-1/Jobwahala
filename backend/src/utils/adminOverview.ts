/** Numbers and checks for the admin overview. Pure functions, so they are easy to test. */

const DAY_MS = 86_400_000;

/** The last `days` days as YYYY-MM-DD, oldest first, ending today (UTC). */
export const dayKeys = (now: Date, days: number) =>
  Array.from({ length: days }, (_, index) => new Date(now.getTime() - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10));

/** How many of these dates fall on each of the last `days` days. */
export const bucketByDay = (dates: Date[], now: Date, days = 14) => {
  const counts = new Map(dayKeys(now, days).map((day) => [day, 0]));
  for (const date of dates) {
    const key = date.toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([day, count]) => ({ day, count }));
};

export const startOfMonthUtc = (now: Date, monthsBack = 0) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));

export type HealthStatus = 'ok' | 'warn' | 'error' | 'off';
export type HealthItem = { key: string; label: string; status: HealthStatus; detail: string };

export type HealthInput = {
  databaseOk: boolean;
  brevoApiKey: boolean;
  smtpUser: boolean;
  smtpHost: string;
  storageProvider: 'LOCAL' | 'S3';
  storageDir: string;
  turnstileSecret: boolean;
  paystackMode: 'test' | 'live' | 'off';
  frontendBaseUrl: string;
  smsProvider: string;
  smsConfigured: boolean;
  googleConfigured: boolean;
  sentryConfigured: boolean;
  freelanceEnabled: boolean;
  isProduction: boolean;
};

const isLocalAddress = (url: string) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0)/i.test(url);

/** What is working, what is half set up, and what is missing. Never includes a key, password or secret. */
export const evaluateHealth = (input: HealthInput): HealthItem[] => {
  const items: HealthItem[] = [];
  const add = (key: string, label: string, status: HealthStatus, detail: string) => items.push({ key, label, status, detail });

  add('database', 'Database', input.databaseOk ? 'ok' : 'error', input.databaseOk ? 'Connected.' : 'The database did not answer. Nothing will work until it does.');

  if (input.brevoApiKey) add('email', 'Email', 'ok', 'Sending through Brevo (web API).');
  else if (input.smtpUser) add('email', 'Email', 'warn', `Sending through SMTP (${input.smtpHost}). Some hosts block SMTP; if emails never arrive, switch to BREVO_API_KEY.`);
  else add('email', 'Email', 'error', 'No email service is set up, so verification, password reset, receipts and alerts all fail. Set BREVO_API_KEY.');

  if (input.storageProvider === 'S3') add('storage', 'File storage', 'ok', 'Files are kept in S3-style object storage.');
  else if (input.storageDir.startsWith('/')) add('storage', 'File storage', 'ok', `Files are kept on disk at ${input.storageDir}. Make sure that folder is a mounted volume.`);
  else add('storage', 'File storage', input.isProduction ? 'error' : 'warn', 'Uploads are kept inside the app and are lost on every deploy. Attach a volume and set EVIDENCE_STORAGE_LOCAL_DIR to its path.');

  add(
    'captcha',
    'Sign-up security check',
    input.turnstileSecret ? 'ok' : input.isProduction ? 'error' : 'off',
    input.turnstileSecret ? 'Turnstile is on.' : 'TURNSTILE_SECRET_KEY is not set, so sign-up and phone codes are closed in production.',
  );

  if (input.paystackMode === 'live') add('payments', 'Payments', 'ok', 'Paystack is in live mode: real money moves.');
  else if (input.paystackMode === 'test') add('payments', 'Payments', 'warn', 'Paystack is in test mode: practice payments only. Swap in the live key when you are approved.');
  else add('payments', 'Payments', 'warn', 'Payments are off (no PAYSTACK_SECRET_KEY). Nobody can buy plans or boosts.');

  add(
    'site-address',
    'Site address in emails',
    isLocalAddress(input.frontendBaseUrl) ? (input.isProduction ? 'error' : 'warn') : 'ok',
    isLocalAddress(input.frontendBaseUrl) ? 'FRONTEND_BASE_URL points to localhost, so links in emails and the payment return page are broken.' : `Links in emails use ${input.frontendBaseUrl}.`,
  );

  add('sms', 'Phone codes (SMS)', input.smsConfigured ? 'ok' : 'warn', input.smsConfigured ? `Sending through ${input.smsProvider}.` : 'No SMS service is set up, so phone sign-up and phone confirmation cannot send codes.');
  add('google', 'Google sign-in', input.googleConfigured ? 'ok' : 'off', input.googleConfigured ? 'Turned on.' : 'Not set up (optional).');
  add('errors', 'Error reporting', input.sentryConfigured ? 'ok' : 'off', input.sentryConfigured ? 'Errors are reported to Sentry.' : 'Not set up (optional).');
  add('freelance', 'Freelance gigs', input.freelanceEnabled ? 'ok' : 'off', input.freelanceEnabled ? 'Open.' : 'Switched off (visitors see the waitlist).');

  return items;
};

export const healthSummary = (items: HealthItem[]) => ({
  errors: items.filter((item) => item.status === 'error').length,
  warnings: items.filter((item) => item.status === 'warn').length,
});
