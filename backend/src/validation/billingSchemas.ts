import { z } from 'zod';
import { PRODUCT_KINDS, ghsToPesewas } from '../utils/billing';
import { PLAN_TIERS } from '../utils/plans';

const id = z.string().min(1).max(80);

export const checkoutSchema = z.object({
  body: z.object({ productId: id, targetId: id.optional() }).strict(),
});

export const promoteSchema = z.object({
  params: z.object({ id }),
  body: z.object({ type: z.enum(['FEATURE', 'BOOST']) }).strict(),
});

export const referenceSchema = z.object({ params: z.object({ reference: z.string().min(5).max(80) }) });
export const idSchema = z.object({ params: z.object({ id }) });

// ---- admin

const includesLine = z.string().trim().min(1).max(120);

export const productBodySchema = z
  .object({
    kind: z.enum(PRODUCT_KINDS),
    name: z.string().trim().min(3).max(80),
    description: z.string().trim().max(300).default(''),
    audience: z.enum(['EMPLOYER', 'PROVIDER', 'SEEKER']),
    // In cedis, as an admin types it (45 or 45.50).
    priceGhs: z.number().min(0).max(1_000_000).refine((value) => ghsToPesewas(value) !== null, 'Not a valid price'),
    durationDays: z.number().int().min(1).max(730).nullable().optional(),
    featuredCredits: z.number().int().min(0).max(1000).default(0),
    boostCredits: z.number().int().min(0).max(1000).default(0),
    interval: z.enum(['MONTHLY', 'YEARLY']).nullable().optional(),
    includes: z.array(includesLine).max(10).default([]),
    // Employer plans: the tier and what it includes. Credits above are per month.
    planTier: z.enum(PLAN_TIERS).nullable().optional(),
    teamLimit: z.number().int().min(1).max(100).default(1),
    cvDatabase: z.boolean().default(false),
    monthlyUnlocks: z.number().int().min(0).max(100000).default(0),
    brandedPage: z.boolean().default(false),
    hiringReports: z.boolean().default(false),
    topEmployers: z.boolean().default(false),
    active: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(1000).default(0),
  })
  .strict()
  .superRefine((body, ctx) => {
    const needsDays = ['FEATURED_JOB', 'JOB_BOOST', 'FEATURED_COURSE', 'PROFILE_BOOST'].includes(body.kind);
    if (needsDays && !body.durationDays) ctx.addIssue({ code: 'custom', path: ['durationDays'], message: 'Say how many days it lasts' });
    if (body.kind === 'JOB_PACK' && body.featuredCredits + body.boostCredits < 1) ctx.addIssue({ code: 'custom', path: ['featuredCredits'], message: 'A pack needs at least one credit' });
    const free = body.planTier === 'FREE';
    if (body.priceGhs < 1 && !free) ctx.addIssue({ code: 'custom', path: ['priceGhs'], message: 'Only the Free plan can cost nothing' });
    if (free && body.priceGhs !== 0) ctx.addIssue({ code: 'custom', path: ['priceGhs'], message: 'The Free plan costs nothing' });
    if (body.planTier && body.kind !== 'SUBSCRIPTION') ctx.addIssue({ code: 'custom', path: ['planTier'], message: 'Only plans have a tier' });
    if (body.kind === 'SUBSCRIPTION' && !body.interval && !free) ctx.addIssue({ code: 'custom', path: ['interval'], message: 'Choose monthly or yearly' });
    if ((body.kind !== 'SUBSCRIPTION' || free) && body.interval) ctx.addIssue({ code: 'custom', path: ['interval'], message: 'Only plans repeat' });
    if ((body.kind === 'PROFILE_BOOST') !== (body.audience === 'SEEKER')) ctx.addIssue({ code: 'custom', path: ['audience'], message: 'Profile boosts are for job seekers, and only they are' });
    if (body.kind === 'FEATURED_COURSE' && body.audience !== 'PROVIDER') ctx.addIssue({ code: 'custom', path: ['audience'], message: 'Featured courses are for training providers' });
  });

export const createProductSchema = z.object({ body: productBodySchema });
export const updateProductSchema = z.object({ params: z.object({ id }), body: productBodySchema });

export const settingsSchema = z.object({
  body: z
    .object({
      vatRatePercent: z.number().min(0).max(50),
      pricesIncludeVat: z.boolean(),
      companyName: z.string().trim().min(2).max(120),
      companyAddress: z.string().trim().max(300).default(''),
      companyTin: z.string().trim().max(40).default(''),
      companyEmail: z.string().trim().max(120).default(''),
      companyPhone: z.string().trim().max(40).default(''),
      receiptFooter: z.string().trim().max(300).default(''),
    })
    .strict(),
});

export const refundSchema = z.object({
  params: z.object({ id }),
  body: z
    .object({
      // Leave out to refund everything that is left.
      amountGhs: z.number().positive().max(1_000_000).optional(),
      reason: z.string().trim().min(5, 'Say why, in a few words').max(300),
      reverseBenefits: z.boolean().default(true),
    })
    .strict(),
});

export const creditAdjustmentSchema = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email().optional(),
      userId: id.optional(),
      type: z.enum(['FEATURE', 'BOOST']),
      delta: z.number().int().min(-1000).max(1000).refine((value) => value !== 0, 'Not zero'),
      reason: z.string().trim().min(5, 'Say why, in a few words').max(300),
    })
    .strict()
    .refine((body) => body.email || body.userId, { message: 'Give the account email', path: ['email'] }),
});

export const paymentsQuerySchema = z.object({
  query: z.object({ status: z.string().max(30).optional(), q: z.string().trim().max(80).optional(), page: z.string().max(5).optional() }).passthrough(),
});

export const changePlanSchema = z.object({ body: z.object({ productId: id }).strict() });
