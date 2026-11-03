import { z } from 'zod';

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).optional(),
  );

export const createSavedSearchSchema = z.object({
  body: z
    .object({
      query: optionalText(80),
      location: optionalText(80),
      jobType: optionalText(40),
      emailAlerts: z.boolean().optional(),
    })
    .strict()
    .refine((body) => Boolean(body.query || body.location || body.jobType), {
      message: 'Add a keyword, location or job type to save this search',
    }),
});

export const updateSavedSearchSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ emailAlerts: z.boolean() }).strict(),
});

export const savedSearchIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
