import { z } from 'zod';
import { matchesStoredUploadUrl } from '../services/evidenceStorage';
import {
  maxEvidenceFileBytes,
  uploadContentTypeValues,
} from '../utils/uploads';

export const sendMessageSchema = z.object({
  body: z
    .object({
      receiverId: z.string().trim().min(1).max(80),
      content: z.string().max(5000).optional(),
      attachmentUrl: z.string().trim().min(1).max(2048).optional(),
      attachmentName: z.string().trim().min(1).max(160).optional(),
      attachmentContentType: z.enum(uploadContentTypeValues).optional(),
      attachmentSizeBytes: z.number().int().positive().max(maxEvidenceFileBytes).optional(),
    })
    .strict()
    .superRefine((value, context) => {
      const hasContent = Boolean(value.content?.trim());
      const hasAttachment = Boolean(value.attachmentUrl);

      if (!hasContent && !hasAttachment) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Message content or an attachment is required',
          path: ['content'],
        });
      }

      if (hasAttachment) {
        if (!value.attachmentName || !value.attachmentContentType || !value.attachmentSizeBytes) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Complete attachment metadata is required',
            path: ['attachmentUrl'],
          });
        }

        if (
          value.attachmentUrl &&
          !matchesStoredUploadUrl('message', value.attachmentUrl)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Attachment URL must reference an uploaded message file',
            path: ['attachmentUrl'],
          });
        }
      }
    }),
});
