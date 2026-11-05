/**
 * Pay, as numbers. Everything is Ghana cedis per month, so any two jobs can be compared.
 * The employer's own words (the `salary` text) are kept for display; these numbers are for searching.
 */

export const MAX_SALARY = 10_000_000;

export type PayNumbers = { min: number | null; max: number | null };

const NF = new Intl.NumberFormat('en-GB');

/** "GHS 3,000 - 4,500 a month". A single figure reads "GHS 3,000 a month"; only a ceiling reads "Up to GHS 4,500 a month". */
export const formatSalaryRange = (min: number | null | undefined, max: number | null | undefined): string | null => {
  const low = typeof min === 'number' ? min : null;
  const high = typeof max === 'number' ? max : null;

  if (low !== null && high !== null && high !== low) return `GHS ${NF.format(low)} - ${NF.format(high)} a month`;
  if (low !== null) return `GHS ${NF.format(low)} a month`;
  if (high !== null) return `Up to GHS ${NF.format(high)} a month`;
  return null;
};

/** Words that mean the money is not in cedis. We do not guess exchange rates, so these stay unparsed. */
const OTHER_CURRENCY = /\$|us\$|usd|dollar|€|\beur\b|euro|£|\bgbp\b|pound|₦|\bngn\b|naira|\bkes\b|\bksh\b|\bzar\b|\brand\b|\brwf\b|\bugx\b|\btzs\b/i;
// Hourly and daily pay cannot be turned into a monthly figure without guessing hours worked.
const HOURLY_OR_DAILY = /\b(per\s+)?(hour|hr|hourly|day|daily)\b|\/\s?(h|hr|hour|day)\b/i;
const CEILING = /\b(up\s?to|maximum|max|not\s+more\s+than|capped\s+at)\b/i;
const WEEKLY = /\b(per\s+)?(week|weekly)\b|\/\s?(w|wk|week)\b/i;
const YEARLY = /\b(per\s+)?(year|yearly|annum|annual|annually|yr)\b|\bp\.?\s?a\.?\b|\/\s?(y|yr|year)\b/i;

/**
 * Reads numbers out of free-text pay such as "GHS 3,000 - 4,500 a month", "₵2,500", "3k to 4k",
 * "GH¢ 48,000 per year". Returns null when it cannot be sure: other currencies, hourly or daily pay,
 * "negotiable", or anything without a believable figure. A wrong number is worse than none.
 */
export const parseSalaryText = (text: string | null | undefined): PayNumbers | null => {
  if (!text) return null;
  const raw = text.toLowerCase().trim();
  if (!raw) return null;

  if (OTHER_CURRENCY.test(raw)) return null;
  if (HOURLY_OR_DAILY.test(raw)) return null;

  // 3,000 -> 3000 (only commas that sit between digit groups of three).
  const cleaned = raw.replace(/(\d),(?=\d{3}\b)/g, '$1');

  const figures: number[] = [];
  for (const match of cleaned.matchAll(/(\d+(?:\.\d+)?)\s*(k|m)?\b/g)) {
    const base = Number(match[1]);
    const multiplier = match[2] === 'k' ? 1_000 : match[2] === 'm' ? 1_000_000 : 1;
    const value = base * multiplier;
    // Small stray numbers ("6 months", "2 days off") are not pay.
    if (value >= 100) figures.push(value);
  }

  if (figures.length === 0) return null;

  const factor = YEARLY.test(raw) ? 1 / 12 : WEEKLY.test(raw) ? 52 / 12 : 1;
  const [first, second] = figures.map((figure) => Math.round(figure * factor));
  const low = second !== undefined ? Math.min(first, second) : first;
  const high = second !== undefined ? Math.max(first, second) : null;

  if (low < 1 || low > MAX_SALARY || (high !== null && high > MAX_SALARY)) return null;

  // "Up to GHS 5,000" is a ceiling, not a starting figure.
  if (high === null && CEILING.test(raw)) return { min: null, max: low };

  return { min: low, max: high !== null && high !== low ? high : null };
};

export const salaryRangeProblem = (min: number | null | undefined, max: number | null | undefined): string | null => {
  for (const value of [min, max]) {
    if (value === null || value === undefined) continue;
    if (!Number.isInteger(value) || value < 0 || value > MAX_SALARY) return 'Pay must be a whole number of cedis, between 0 and 10,000,000.';
  }
  if (typeof min === 'number' && typeof max === 'number' && min > max) return 'The lowest pay cannot be higher than the highest pay.';
  return null;
};

type PayInput = { salary?: string | null; salaryMin?: number | null; salaryMax?: number | null };

/**
 * Settles a job's three pay fields. If the employer gave numbers, they win and the text is written from
 * them (unless they also wrote their own). If they gave only text, numbers are read from it when possible.
 */
export const resolvePay = (input: PayInput): { salary: string | null; salaryMin: number | null; salaryMax: number | null } => {
  const text = input.salary?.trim() || null;
  const gaveNumbers = input.salaryMin !== undefined || input.salaryMax !== undefined;

  if (gaveNumbers) {
    const min = input.salaryMin ?? null;
    const max = input.salaryMax ?? null;
    return { salary: text ?? formatSalaryRange(min, max), salaryMin: min, salaryMax: max };
  }

  const parsed = parseSalaryText(text);
  return { salary: text, salaryMin: parsed?.min ?? null, salaryMax: parsed?.max ?? null };
};

/** Does a job's pay reach this level? Pay that was never given as numbers cannot be matched. */
export const salaryOverlaps = (
  job: { salaryMin: number | null; salaryMax: number | null },
  wanted: { min?: number | null; max?: number | null },
): boolean => {
  const jobHigh = job.salaryMax ?? job.salaryMin;
  const jobLow = job.salaryMin ?? job.salaryMax;
  if (jobHigh === null || jobLow === null) return false;
  if (typeof wanted.min === 'number' && jobHigh < wanted.min) return false;
  if (typeof wanted.max === 'number' && jobLow > wanted.max) return false;
  return true;
};
