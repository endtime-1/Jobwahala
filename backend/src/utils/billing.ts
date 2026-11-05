/** Billing helpers: money in whole pesewas, VAT, receipt numbers, plan periods and paid promotion. */

export const PRODUCT_KINDS = ['FEATURED_JOB', 'JOB_BOOST', 'JOB_PACK', 'FEATURED_COURSE', 'SUBSCRIPTION'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const DAY_MS = 86_400_000;
export const DEFAULT_FEATURED_DAYS = 30;
export const DEFAULT_BOOST_DAYS = 7;

/** GHS typed by a person (450 or 450.5) to pesewas. null when it is not a sensible amount. */
export const ghsToPesewas = (value: unknown): number | null => {
  const number = typeof value === 'string' ? Number(value.replace(/[,\s]/g, '')) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100);
};

export const formatGhs = (pesewas: number) => `GHS ${(pesewas / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type VatSettings = { vatRatePercent: number; pricesIncludeVat: boolean };

/**
 * Splits a price into what is before VAT, the VAT, and what the customer pays. With VAT-inclusive prices the listed price
 * is the total; otherwise VAT is added on top. Always whole pesewas that add up exactly.
 */
export const priceWithVat = (pricePesewas: number, { vatRatePercent, pricesIncludeVat }: VatSettings) => {
  const rate = Math.max(0, vatRatePercent);
  const vatRateBps = Math.round(rate * 100);

  if (pricesIncludeVat) {
    const vat = Math.round((pricePesewas * rate) / (100 + rate));
    return { subtotalPesewas: pricePesewas - vat, vatPesewas: vat, totalPesewas: pricePesewas, vatRateBps };
  }
  const vat = Math.round((pricePesewas * rate) / 100);
  return { subtotalPesewas: pricePesewas, vatPesewas: vat, totalPesewas: pricePesewas + vat, vatRateBps };
};

/** JW-2026-000123 */
export const receiptNumber = (year: number, sequence: number) => `JW-${year}-${String(sequence).padStart(6, '0')}`;

export const newReference = (random: string) => `JWB-${Date.now().toString(36).toUpperCase()}-${random}`;

/** The end of a plan period that starts at `start`. Months are calendar months, clipped to the month's length. */
export const addInterval = (start: Date, interval: 'MONTHLY' | 'YEARLY') => {
  const next = new Date(start);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + (interval === 'YEARLY' ? 12 : 1));
  const daysInMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, daysInMonth));
  return next;
};

/** A promotion bought while one is still running is added on to it. */
export const extendPromotion = (current: Date | null | undefined, days: number, now = new Date()) => {
  const base = current && current.getTime() > now.getTime() ? current.getTime() : now.getTime();
  return new Date(base + days * DAY_MS);
};

export type Promotion = 'URGENT' | 'FEATURED' | null;

/** The label a job shows: "Urgently hiring" outranks "Featured". Both end by themselves. */
export const promotionOf = (job: { featuredUntil?: Date | string | null; boostedUntil?: Date | string | null }, now = new Date()): Promotion => {
  const live = (value?: Date | string | null) => Boolean(value && new Date(value).getTime() > now.getTime());
  if (live(job.boostedUntil)) return 'URGENT';
  if (live(job.featuredUntil)) return 'FEATURED';
  return null;
};

export const PROMOTION_LABEL: Record<Exclude<Promotion, null>, string> = { URGENT: 'Urgently hiring', FEATURED: 'Featured' };

/** Plain list of what a plan includes, for the card: the admin's own lines first, then the credits. */
export const includesList = (product: { includesJson?: string | null; featuredCredits?: number; boostCredits?: number; durationDays?: number | null; interval?: string | null }) => {
  let lines: string[] = [];
  try {
    const parsed = JSON.parse(product.includesJson || '[]');
    if (Array.isArray(parsed)) lines = parsed.filter((line): line is string => typeof line === 'string' && line.trim() !== '');
  } catch {
    lines = [];
  }
  const period = product.interval === 'YEARLY' ? ' every year' : product.interval === 'MONTHLY' ? ' every month' : '';
  const credits = [
    product.featuredCredits ? `${product.featuredCredits} featured job ${product.featuredCredits === 1 ? 'credit' : 'credits'}${period}` : '',
    product.boostCredits ? `${product.boostCredits} "Urgently hiring" boost ${product.boostCredits === 1 ? 'credit' : 'credits'}${period}` : '',
  ].filter(Boolean);
  return [...lines, ...credits];
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Prices an admin gets to start from. They are placeholders: change them in the admin Billing tab. */
export const DEFAULT_PRODUCTS = [
  { kind: 'FEATURED_JOB', slug: 'featured-job', name: 'Featured job (30 days)', description: 'Show one job above others from equally verified employers for 30 days, with a "Featured" label.', audience: 'EMPLOYER', pricePesewas: 5000, durationDays: 30, featuredCredits: 0, boostCredits: 0, interval: null, includes: ['Labelled "Featured"', 'Ranked first among jobs from equally verified employers'], sortOrder: 10 },
  { kind: 'JOB_BOOST', slug: 'job-boost', name: 'Job boost (7 days)', description: 'Mark one job "Urgently hiring" and tell people with a matching job alert.', audience: 'EMPLOYER', pricePesewas: 2500, durationDays: 7, featuredCredits: 0, boostCredits: 0, interval: null, includes: ['Labelled "Urgently hiring"', 'Sent to people with a matching job alert'], sortOrder: 20 },
  { kind: 'JOB_PACK', slug: 'job-pack-5', name: 'Job pack: 5 featured jobs', description: 'Five featured-job credits to use whenever you like. They do not expire.', audience: 'EMPLOYER', pricePesewas: 20000, durationDays: null, featuredCredits: 5, boostCredits: 0, interval: null, includes: ['Use a credit on any job, any time'], sortOrder: 30 },
  { kind: 'FEATURED_COURSE', slug: 'featured-course', name: 'Featured course listing (30 days)', description: 'Show one course at the top of the course list for 30 days.', audience: 'PROVIDER', pricePesewas: 10000, durationDays: 30, featuredCredits: 0, boostCredits: 0, interval: null, includes: ['Shown first in course search'], sortOrder: 40 },
] as const;
