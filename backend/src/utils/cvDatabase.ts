import { z } from 'zod';

/** CV database: what a job seeker chooses, what an employer can filter by, and how much of a profile search results may show. */

export const CV_VISIBILITY = ['HIDDEN', 'VERIFIED_EMPLOYERS'] as const;
export type CvVisibility = (typeof CV_VISIBILITY)[number];

// Lowest to highest. "At least" filters use the position in this list.
export const EDUCATION_LEVELS = ['SECONDARY', 'CERTIFICATE', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'DOCTORATE'] as const;
export const AVAILABILITY = ['IMMEDIATELY', 'NSS', 'INTERNSHIP', 'FULL_TIME'] as const;

export const EDUCATION_LABEL: Record<string, string> = {
  SECONDARY: 'Secondary school',
  CERTIFICATE: 'Certificate',
  DIPLOMA: 'Diploma',
  BACHELORS: "Bachelor's degree",
  MASTERS: "Master's degree",
  DOCTORATE: 'Doctorate',
};

export const AVAILABILITY_LABEL: Record<string, string> = {
  IMMEDIATELY: 'Available immediately',
  NSS: 'National Service (NSS)',
  INTERNSHIP: 'Internship',
  FULL_TIME: 'Full-time',
};

/** Searches are capped so the database cannot be copied out page by page. */
export const PAGE_SIZE = 20;
export const MAX_PAGES = 10;
export const MAX_SAVED_SEARCHES = 20;
export const ACTIVE_WITHIN_DAYS = [7, 30, 90, 365] as const;

const text = (max: number) => z.string().trim().max(max);

/** The filters of a search, as they come in a query string or are kept in a saved search. */
export const candidateFiltersSchema = z
  .object({
    skills: text(200).optional(),
    category: text(80).optional(),
    location: text(80).optional(),
    minYears: z.coerce.number().int().min(0).max(60).optional(),
    education: z.enum(EDUCATION_LEVELS).optional(),
    availability: z.enum(AVAILABILITY).optional(),
    activeWithinDays: z.coerce.number().int().refine((value) => (ACTIVE_WITHIN_DAYS as readonly number[]).includes(value), 'Choose 7, 30, 90 or 365 days').optional(),
    certificate: z.preprocess((value) => value === true || value === 'true' || value === '1', z.boolean()).optional(),
  })
  .strict();

export type CandidateFilters = z.infer<typeof candidateFiltersSchema>;

/** Drops empty values so two searches that mean the same thing are stored the same way. */
export const cleanFilters = (filters: Record<string, unknown>): CandidateFilters => {
  const parsed = candidateFiltersSchema.parse(Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined && value !== null && value !== false)));
  return parsed;
};

/** Education levels that count as "at least" this one. */
export const levelsFrom = (level: (typeof EDUCATION_LEVELS)[number]) => EDUCATION_LEVELS.slice(EDUCATION_LEVELS.indexOf(level));

export const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
export const nextMonthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
export const dayKey = (now: Date) => now.toISOString().slice(0, 10);

/**
 * People sometimes type their email or phone into free text. A limited profile must not carry contact details, so anything that
 * looks like one is removed before the text is shown to an employer who has not unlocked the profile.
 */
export const scrubContact = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[hidden]')
    .replace(/(https?:\/\/|www\.)\S+/gi, '[hidden]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[hidden]')
    .replace(/\s+/g, ' ')
    .trim();

export const summarise = (value: string | null | undefined, max: number) => {
  const clean = scrubContact(value);
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};
