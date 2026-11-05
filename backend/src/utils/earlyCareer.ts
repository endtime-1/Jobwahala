/**
 * Early-career opportunities: internships, National Service (NSS), industrial attachments and
 * graduate / entry-level jobs. They are ordinary jobs with a special `type` and a few extra details.
 * The frontend keeps a matching list in src/lib/earlyCareer.ts.
 */
export const EARLY_CAREER_TYPES = [
  'Internship',
  'National Service (NSS)',
  'Industrial Attachment',
  'Graduate / Entry-level Job',
] as const;

export type EarlyCareerType = (typeof EARLY_CAREER_TYPES)[number];

export const SCHEDULES = ['FULL_TIME', 'PART_TIME'] as const;
export const CAREER_STAGES = ['STUDENT', 'NSS', 'GRADUATE'] as const;

const norm = (value?: string | null) => (value ?? '').trim().toLowerCase();

export const isEarlyCareerType = (type?: string | null) => EARLY_CAREER_TYPES.some((known) => norm(known) === norm(type));

/** The exact spelling we store, whatever case it arrived in. */
export const canonicalEarlyCareerType = (type?: string | null) => EARLY_CAREER_TYPES.find((known) => norm(known) === norm(type));

export type EarlyCareerInput = {
  unpaid?: boolean;
  durationMonths?: number | null;
  startsImmediately?: boolean;
  /** A day, written 2026-12-01. */
  startDate?: string | null;
  schedule?: string | null;
  possibleJobOffer?: boolean;
};

export type EarlyCareerData = {
  unpaid?: boolean;
  durationMonths?: number | null;
  startsImmediately?: boolean;
  startDate?: Date | null;
  schedule?: string | null;
  possibleJobOffer?: boolean;
};

/** What a job that is not early-career carries: nothing. */
export const NO_EARLY_CAREER_DETAILS: Required<EarlyCareerData> = {
  unpaid: false,
  durationMonths: null,
  startsImmediately: false,
  startDate: null,
  schedule: null,
  possibleJobOffer: false,
};

const DAY = 86_400_000;

export class EarlyCareerError extends Error {}

/** 2026-12-01 -> that day at midnight UTC. Anything else throws. */
export const parseDay = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) throw new EarlyCareerError('Start date must be a day, like 2026-12-01');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime()) || date.getUTCMonth() !== Number(match[2]) - 1) {
    throw new EarlyCareerError('Start date must be a real day, like 2026-12-01');
  }
  return date;
};

/** A start date an employer can choose: a real day, from about today to two years away. */
export const parseStartDate = (value: string, now = new Date()) => {
  const date = parseDay(value);
  if (date.getTime() < now.getTime() - 2 * DAY) throw new EarlyCareerError('Start date cannot be in the past');
  if (date.getTime() > now.getTime() + 730 * DAY) throw new EarlyCareerError('Start date is too far away');
  return date;
};

/**
 * Turns what the employer sent into the columns to save, for a job of the given type.
 * Only things that were sent are returned (so an edit changes only what was edited), except that a job
 * that is not early-career has all of them cleared. "Immediately" and a date exclude each other.
 */
export const earlyCareerData = (input: EarlyCareerInput, type: string, now = new Date()): EarlyCareerData => {
  if (!isEarlyCareerType(type)) return { ...NO_EARLY_CAREER_DETAILS };

  const data: EarlyCareerData = {};
  if (input.unpaid !== undefined) data.unpaid = input.unpaid;
  if (input.durationMonths !== undefined) data.durationMonths = input.durationMonths;
  if (input.schedule !== undefined) data.schedule = input.schedule;
  if (input.possibleJobOffer !== undefined) data.possibleJobOffer = input.possibleJobOffer;

  if (input.startsImmediately && input.startDate) {
    throw new EarlyCareerError('Choose either "start immediately" or a start date, not both');
  }
  if (input.startsImmediately) {
    data.startsImmediately = true;
    data.startDate = null;
  } else if (input.startDate) {
    data.startsImmediately = false;
    data.startDate = parseStartDate(input.startDate, now);
  } else if (input.startsImmediately === false || input.startDate === null) {
    data.startsImmediately = false;
    data.startDate = null;
  }
  return data;
};

/** Google's employmentType for a job: internships and attachments are INTERN, plus full or part time when known. */
export const employmentTypeFor = (type: string, schedule?: string | null): string | string[] => {
  const kind = canonicalEarlyCareerType(type);
  const time = schedule === 'PART_TIME' ? 'PART_TIME' : schedule === 'FULL_TIME' ? 'FULL_TIME' : null;

  switch (kind) {
    case 'Internship':
    case 'Industrial Attachment':
      return time ? ['INTERN', time] : 'INTERN';
    case 'National Service (NSS)':
      // A fixed-term national service posting.
      return time ? ['TEMPORARY', time] : 'TEMPORARY';
    case 'Graduate / Entry-level Job':
      return time ?? 'FULL_TIME';
    default:
      return 'OTHER';
  }
};

/** An unpaid role says so plainly and has no stipend numbers. */
export const UNPAID_PAY = { salary: 'Unpaid', salaryMin: null, salaryMax: null } as const;

/** A saved alert with this job type matches any internship, NSS, attachment or graduate job. */
export const EARLY_CAREER_ALERT_TYPE = 'Internships & NSS';
