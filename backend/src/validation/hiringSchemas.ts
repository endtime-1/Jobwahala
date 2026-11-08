import { z } from 'zod';

const id = z.string().min(1).max(80);
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional();
const dateText = z.string().trim().min(8).max(40);

export const REQUEST_STATUS_VALUES = ['NEW', 'AGREED', 'SOURCING', 'SHORTLIST_SENT', 'INTERVIEWING', 'FILLED', 'CANCELLED'] as const;

export const createRequestSchema = z.object({
  body: z
    .object({
      roleTitle: text(2, 120),
      headcount: z.number().int().min(1).max(50).default(1),
      salaryMin: z.number().int().min(0).max(10_000_000).nullable().optional(),
      salaryMax: z.number().int().min(0).max(10_000_000).nullable().optional(),
      location: text(2, 120),
      startDate: z.union([dateText, z.null()]).optional(),
      deadline: z.union([dateText, z.null()]).optional(),
      requirements: text(20, 5000),
      contactName: text(2, 120),
      contactPhone: text(7, 30),
      mustHaves: z.array(text(1, 120)).max(8).optional(),
    })
    .strict(),
});

export const requestIdSchema = z.object({ params: z.object({ id }) });
export const candidateParamsSchema = z.object({ params: z.object({ id, candidateId: id }) });

export const decisionSchema = z.object({
  params: z.object({ id, candidateId: id }),
  body: z.object({ decision: z.enum(['INTERVIEW', 'NOT_SUITABLE', 'HIRED']), note: optionalText(500), startDate: z.union([dateText, z.null()]).optional() }).strict(),
});
export const replacementSchema = z.object({ params: z.object({ id }), body: z.object({ reason: text(5, 300) }).strict() });
export const respondSchema = z.object({ params: z.object({ candidateId: id }), body: z.object({ accept: z.boolean(), reason: optionalText(300) }).strict() });

export const addCandidateSchema = z.object({
  params: z.object({ id }),
  body: z
    .object({ profileId: id.optional(), email: z.string().trim().toLowerCase().email().max(160).optional() })
    .strict()
    .refine((body) => Boolean(body.profileId) !== Boolean(body.email), { message: 'Give either a profile or an email, not both' }),
});

export const updateCandidateSchema = z.object({
  params: z.object({ id, candidateId: id }),
  body: z
    .object({
      ratings: z.record(z.string().max(120), z.number().int().min(1).max(5)).optional(),
      note: optionalText(2000),
      staffNotes: optionalText(3000),
    })
    .strict(),
});

export const dropSchema = z.object({ params: z.object({ id, candidateId: id }), body: z.object({ reason: text(3, 300) }).strict() });
export const noteSchema = z.object({ params: z.object({ id }), body: z.object({ body: text(1, 2000), visibility: z.enum(['STAFF', 'CLIENT']).default('STAFF') }).strict() });
export const statusSchema = z.object({ params: z.object({ id }), body: z.object({ status: z.enum(REQUEST_STATUS_VALUES), reason: optionalText(300) }).strict() });
export const createJobSchema = z.object({ params: z.object({ id }), body: z.object({ publish: z.boolean().default(false) }).strict() });
export const hireStartSchema = z.object({ params: z.object({ id, candidateId: id }), body: z.object({ startDate: dateText }).strict() });

export const assignSchema = z.object({ params: z.object({ id }), body: z.object({ recruiterId: id }).strict() });
export const termsSchema = z.object({
  params: z.object({ id }),
  body: z
    .object({
      feeGhs: z.number().min(0).max(10_000_000).nullable().optional(),
      depositGhs: z.number().min(0).max(10_000_000).nullable().optional(),
      guaranteeDays: z.number().int().min(0).max(730).optional(),
    })
    .strict(),
});
export const paymentSchema = z.object({
  params: z.object({ id }),
  body: z.object({ kind: z.enum(['DEPOSIT', 'BALANCE', 'OTHER']), amountGhs: z.number().positive().max(10_000_000), paidAt: dateText, method: optionalText(60), reference: optionalText(80), note: optionalText(300) }).strict(),
});
export const removePaymentSchema = z.object({ params: z.object({ id, paymentId: id }), body: z.object({ reason: text(3, 300) }).strict() });
export const hiringSettingsSchema = z.object({ body: z.object({ fromPriceGhs: z.number().int().min(0).max(10_000_000).nullable(), guaranteeDays: z.number().int().min(0).max(730) }).strict() });

export const createRecruiterSchema = z.object({
  body: z.object({ email: z.string().trim().toLowerCase().email().max(160), displayName: text(2, 80), title: optionalText(80), phone: optionalText(30) }).strict(),
});
export const staffActiveSchema = z.object({ params: z.object({ userId: id }), body: z.object({ active: z.boolean() }).strict() });
