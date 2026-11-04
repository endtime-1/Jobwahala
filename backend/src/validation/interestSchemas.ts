import { z } from 'zod';

/** Where a signup came from. Add a value here when a new form is added. */
export const INTEREST_SOURCES = ['landing_freelance_gigs'] as const;

/** Turns "024 123 4567" or "0241234567" into "+233241234567". Returns null when it is not a usable number. */
export const normalizePhone = (raw: string): string | null => {
  const compact = raw.replace(/[\s\-().]/g, '');
  if (!/^\+?\d{9,15}$/.test(compact)) return null;
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  if (/^0\d{9}$/.test(compact)) return `+233${compact.slice(1)}`;
  return null;
};

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export const createInterestSignupSchema = z.object({
  body: z
    .object({
      email: z.preprocess(blankToUndefined, z.string().max(254).email().optional()),
      phone: z.preprocess(blankToUndefined, z.string().max(30).optional()),
      source: z.enum(INTEREST_SOURCES),
      // Hidden field real people never fill in; bots do.
      website: z.string().max(200).optional(),
    })
    .strict()
    .refine((body) => Boolean(body.email || body.phone), { message: 'Add an email or a phone number' })
    .refine((body) => !body.phone || normalizePhone(body.phone) !== null, {
      message: 'Enter a valid phone number',
      path: ['phone'],
    }),
});
