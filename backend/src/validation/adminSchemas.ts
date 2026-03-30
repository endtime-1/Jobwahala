import { z } from 'zod';

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const trimmedOptionalString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).optional(),
  );

const userStatusValues = ['ACTIVE', 'FLAGGED', 'SUSPENDED'] as const;
const reportStatusValues = ['PENDING', 'RESOLVED', 'DISMISSED'] as const;
const adminJobStatusValues = ['ACTIVE', 'CLOSED', 'FLAGGED', 'SUSPENDED'] as const;
const adminServiceStatusValues = ['ACTIVE', 'PAUSED', 'FLAGGED', 'SUSPENDED'] as const;
const verificationStatusValues = ['APPROVED', 'REJECTED', 'NEEDS_INFO'] as const;
const disputeStatusValues = ['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;

export const updateAdminUserStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(userStatusValues),
    })
    .strict(),
  params: idParamsSchema,
});

export const updateAdminBulkUserStatusSchema = z.object({
  body: z
    .object({
      userIds: z.array(z.string().min(1)).min(1).max(100),
      status: z.enum(userStatusValues),
    })
    .strict()
    .refine((value) => new Set(value.userIds).size === value.userIds.length, {
      message: 'User selections must be unique',
      path: ['userIds'],
    }),
});

export const updateAdminReportStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(reportStatusValues),
    })
    .strict(),
  params: idParamsSchema,
});

export const updateAdminBulkReportStatusSchema = z.object({
  body: z
    .object({
      reportIds: z.array(z.string().min(1)).min(1).max(100),
      status: z.enum(reportStatusValues),
    })
    .strict()
    .refine((value) => new Set(value.reportIds).size === value.reportIds.length, {
      message: 'Report selections must be unique',
      path: ['reportIds'],
    }),
});

export const updateAdminJobStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(adminJobStatusValues),
    })
    .strict(),
  params: idParamsSchema,
});

export const updateAdminBulkJobStatusSchema = z.object({
  body: z
    .object({
      jobIds: z.array(z.string().min(1)).min(1).max(100),
      status: z.enum(adminJobStatusValues),
    })
    .strict()
    .refine((value) => new Set(value.jobIds).size === value.jobIds.length, {
      message: 'Job selections must be unique',
      path: ['jobIds'],
    }),
});

export const createAdminJobSchema = z.object({
  body: z
    .object({
      employerId: z.string().trim().min(1),
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().min(1).max(5000),
      location: trimmedOptionalString(160),
      type: z.string().trim().min(1).max(80),
      salary: trimmedOptionalString(120),
      category: trimmedOptionalString(120),
    })
    .strict(),
});

export const updateAdminServiceStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(adminServiceStatusValues),
    })
    .strict(),
  params: idParamsSchema,
});

export const updateAdminBulkServiceStatusSchema = z.object({
  body: z
    .object({
      serviceIds: z.array(z.string().min(1)).min(1).max(100),
      status: z.enum(adminServiceStatusValues),
    })
    .strict()
    .refine((value) => new Set(value.serviceIds).size === value.serviceIds.length, {
      message: 'Service selections must be unique',
      path: ['serviceIds'],
    }),
});

export const deleteAdminUserSchema = z.object({
  params: idParamsSchema,
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
      internalNote: z
        .preprocess(
          (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
          z.string().trim().max(1200).optional(),
        ),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.status === 'NEEDS_INFO' && !value.reviewNote) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A review note is required when requesting more verification information',
          path: ['reviewNote'],
        });
      }
    }),
  params: idParamsSchema,
});

export const updateAgreementDisputeStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(disputeStatusValues),
      resolutionNote: z
        .preprocess(
          (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
          z.string().trim().max(1200).optional(),
        ),
    })
    .strict(),
  params: idParamsSchema,
});
