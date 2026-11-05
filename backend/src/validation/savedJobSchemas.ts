import { z } from 'zod';

export const savedJobParamsSchema = z.object({
  params: z.object({ jobId: z.string().trim().min(1).max(80) }),
});
