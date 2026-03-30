import { z } from 'zod';

export const createReportSchema = z.object({
  body: z.object({
    type: z.enum(['job', 'service', 'user']),
    targetId: z.string().min(1),
    reason: z.string().min(1),
    details: z.string().trim().optional(),
  }),
});
