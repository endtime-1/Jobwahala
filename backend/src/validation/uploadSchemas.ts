import { z } from 'zod';
import { uploadCategoryValues, uploadContentTypeValues } from '../utils/uploads';

export const uploadEvidenceSchema = z.object({
  body: z
    .object({
      category: z.enum(uploadCategoryValues),
      fileName: z.string().trim().min(1).max(160),
      contentType: z.enum(uploadContentTypeValues),
      dataBase64: z.string().trim().min(20).max(10_000_000),
    })
    .strict(),
});
