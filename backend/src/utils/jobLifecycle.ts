/**
 * Job lifecycle rules in one place.
 *
 * Owner statuses: DRAFT, ACTIVE, PAUSED, CLOSED, EXPIRED.
 * Moderation statuses (set by admins only): FLAGGED, SUSPENDED.
 * Only an ACTIVE job whose closing date is still ahead is public: search, alerts, sitemap, structured data.
 */

export const JOB_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const DEFAULT_JOB_DAYS = 30;
export const MAX_JOB_DAYS = 90;
export const EXPIRY_WARNING_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export const addDays = (from: Date, days: number) => new Date(from.getTime() + days * DAY_MS);

/** A date-only value means "the whole of that day", counted in UTC (Ghana is on UTC). */
const endOfDayUtc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

export class ClosingDateError extends Error {}

/**
 * Turns what the employer sent (nothing, "2026-12-01" or a full date-time) into the closing date.
 * Nothing means 30 days from now. The date must be in the future and at most 90 days from today.
 */
export const resolveClosesAt = (input: string | null | undefined, now: Date = new Date()): Date => {
  if (input === undefined || input === null || input === '') {
    return addDays(now, DEFAULT_JOB_DAYS);
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  const parsed = dateOnly
    ? endOfDayUtc(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(input);

  if (Number.isNaN(parsed.getTime())) {
    throw new ClosingDateError('Enter a valid closing date');
  }

  if (parsed.getTime() <= now.getTime()) {
    throw new ClosingDateError('The closing date must be in the future');
  }

  const latest = endOfDayUtc(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + MAX_JOB_DAYS,
  );
  if (parsed.getTime() > latest.getTime()) {
    throw new ClosingDateError(`A job can stay open for at most ${MAX_JOB_DAYS} days`);
  }

  return parsed;
};

/** "Extend by N days" counts from today, not from the old closing date. */
export const closesAtFromDays = (days: number | undefined, now: Date = new Date()) => {
  const count = days ?? DEFAULT_JOB_DAYS;
  if (!Number.isInteger(count) || count < 1 || count > MAX_JOB_DAYS) {
    throw new ClosingDateError(`Choose between 1 and ${MAX_JOB_DAYS} days`);
  }
  return endOfDayUtc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + count);
};

/** The one filter for anything the public can see. */
export const publicJobWhere = (now: Date = new Date()) => ({
  status: 'ACTIVE',
  closesAt: { gt: now },
});

const TRANSITIONS: Record<string, readonly JobStatus[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['PAUSED', 'CLOSED'],
  PAUSED: ['ACTIVE', 'CLOSED'],
  CLOSED: ['ACTIVE'],
  // An expired job comes back only by extending its closing date.
  EXPIRED: [],
};

export const canChangeStatus = (from: string, to: string) =>
  (TRANSITIONS[from] ?? []).includes(to as JobStatus);

/** Statuses an employer may edit or duplicate from. FLAGGED and SUSPENDED belong to the moderators. */
export const isOwnerManaged = (status: string) => (JOB_STATUSES as readonly string[]).includes(status);

export const isPastClosingDate = (closesAt: Date, now: Date = new Date()) => closesAt.getTime() <= now.getTime();

/** Whole days left, rounded up: 3 days 2 hours left reads as 4. Never negative. */
export const daysLeft = (closesAt: Date, now: Date = new Date()) =>
  Math.max(0, Math.ceil((closesAt.getTime() - now.getTime()) / DAY_MS));
