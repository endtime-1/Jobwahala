import { parseCsvRecords } from './csv';
import { resolvePay } from './salary';

/** What one CSV row becomes, or why it cannot be imported. */
export type ImportRow = {
  line: number;
  title: string;
  company: string;
  location: string | null;
  category: string | null;
  type: string;
  salary: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  closesAt: Date;
  description: string;
  applyInstructions: string | null;
  problems: string[];
};

const FIELD_NAMES = {
  title: ['job title', 'title', 'position'],
  company: ['company', 'employer', 'company name'],
  location: ['location (as on flyer)', 'location', 'town', 'city'],
  region: ['region'],
  category: ['category'],
  type: ['job type', 'type'],
  salary: ['salary', 'pay'],
  closing: ['closing date', 'closes', 'deadline'],
  description: ['description', 'details'],
  apply: ['how to apply', 'apply', 'application instructions'],
} as const;

const pick = (record: Record<string, string>, names: readonly string[]) => {
  for (const name of names) if (record[name] !== undefined) return record[name].replace(/\r\n?/g, '\n').trim();
  return '';
};

/** "Not specified", "n/a", "-" and an empty cell all mean "nothing was given". */
export const isUnspecified = (value: string) => value.trim() === '' || /^(-+$|n\/?a\b|none\b|not specified|not stated|unspecified)/i.test(value.trim());

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** A date written as 2026-12-09, 9 Dec 2026, 9 December 2026 or 09/12/2026 (day first, as in Ghana). End of that day, UTC. */
export const parseDateText = (text: string): Date | null => {
  const value = text.trim();
  let year = 0;
  let month = 0;
  let day = 0;

  let match = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  if (match) [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/.exec(value))) {
    const index = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase());
    if (index < 0) return null;
    [year, month, day] = [Number(match[3]), index + 1, Number(match[1])];
  } else if ((match = /(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(value))) [year, month, day] = [Number(match[3]), Number(match[2]), Number(match[1])];
  else return null;

  const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
};

/** The place shown on the job: the flyer's location, with the region added when it names one region. */
export const composeLocation = (location: string, region: string) => {
  const place = location.trim();
  const area = isUnspecified(region) ? '' : region.trim();
  if (!place) return area && !/[/]|multiple|various/i.test(area) ? area : null;
  if (!area || /[/]|multiple|various/i.test(area)) return place;
  return place.toLowerCase().includes(area.toLowerCase()) ? place : `${place}, ${area}`;
};

export type ImportDefaults = { type: string; closesAt: Date };

/** Reads the CSV into rows with every default applied, plus a list of problems per row (a row with problems is not imported). */
export const readJobCsv = (csv: string, defaults: ImportDefaults, now = new Date()): ImportRow[] =>
  parseCsvRecords(csv).map((record, index) => {
    const problems: string[] = [];
    const title = pick(record, FIELD_NAMES.title);
    const description = pick(record, FIELD_NAMES.description);
    const typeText = pick(record, FIELD_NAMES.type);
    const closingText = pick(record, FIELD_NAMES.closing);
    const salaryText = pick(record, FIELD_NAMES.salary);
    const apply = pick(record, FIELD_NAMES.apply);

    if (!title) problems.push('The job title is empty');
    if (title.length > 160) problems.push('The job title is longer than 160 characters');
    if (!description) problems.push('The description is empty');
    if (description.length > 5000) problems.push('The description is longer than 5,000 characters');
    if (apply.length > 1500) problems.push('The "How to apply" text is longer than 1,500 characters');

    let closesAt = defaults.closesAt;
    if (!isUnspecified(closingText)) {
      const parsed = parseDateText(closingText);
      if (parsed) closesAt = parsed;
      else problems.push(`Could not read the closing date "${closingText}"`);
    }
    if (closesAt <= now) problems.push('The closing date has already passed');

    const salary = isUnspecified(salaryText) ? null : salaryText;
    const pay = resolvePay({ salary: salary ?? undefined });
    const category = pick(record, FIELD_NAMES.category);

    return {
      line: index + 2,
      title,
      company: pick(record, FIELD_NAMES.company),
      location: composeLocation(pick(record, FIELD_NAMES.location), pick(record, FIELD_NAMES.region)),
      category: category && !isUnspecified(category) ? category.slice(0, 120) : null,
      type: (isUnspecified(typeText) ? defaults.type : typeText).slice(0, 80),
      salary: pay.salary,
      salaryMin: pay.salaryMin,
      salaryMax: pay.salaryMax,
      closesAt,
      description,
      applyInstructions: apply && !isUnspecified(apply) ? apply : null,
      problems,
    };
  });

export const titleKey = (title: string) => title.toLowerCase().replace(/\s+/g, ' ').trim();

export const normaliseWebsite = (value: string | undefined | null) => {
  const text = (value ?? '').trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
};
