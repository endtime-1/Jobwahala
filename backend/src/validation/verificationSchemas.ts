import { z } from 'zod';

const verificationStatusValues = ['APPROVED', 'REJECTED', 'NEEDS_INFO'] as const;

const idParamsSchema = z.object({
  id: z.string().min(1),
});

export const createVerificationRequestSchema = z.object({
  body: z
    .object({
      details: z.string().trim().min(20).max(2000),
      documentUrl: z
        .preprocess(
          (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
          z.string().trim().url().max(500).optional(),
        ),
    })
    .strict(),
});

export const updateVerificationRequestStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(verificationStatusValues),
      reviewNote: z
        .preprocess(
          (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
          z.string().trim().max(800).optional(),
        ),
    })
    .strict(),
  params: idParamsSchema,
});
