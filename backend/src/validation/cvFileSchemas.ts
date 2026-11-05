import { z } from 'zod';

export const setCvFileSchema = z.object({
  body: z
    .object({
      url: z.string().trim().min(1).max(600),
      fileName: z.string().trim().min(1).max(160),
    })
    .strict(),
});
