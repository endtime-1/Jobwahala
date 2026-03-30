import { z } from 'zod';

export const applicationStatusValues = ['SUBMITTED', 'SHORTLISTED', 'INTERVIEW', 'REJECTED', 'HIRED'] as const;
export const ownerJobStatusValues = ['ACTIVE', 'CLOSED'] as const;

const trimmedOptionalString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).optional(),
  );

const jobIdParams = z.object({
  id: z.string().min(1),
});

export const createJobSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().min(1).max(5000),
      location: trimmedOptionalString(160),
      type: z.string().trim().min(1).max(80),
      salary: trimmedOptionalString(120),
      category: trimmedOptionalString(120),
    })
    .strict(),
});

export const applyForJobSchema = z.object({
  body: z
    .object({
      coverLetter: trimmedOptionalString(3000),
    })
    .strict(),
});

export const updateApplicationStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(applicationStatusValues),
    })
    .strict(),
  params: z.object({
    applicationId: z.string().min(1),
  }),
});

export const jobIdParamSchema = z.object({
  params: jobIdParams,
});

export const updateJobStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(ownerJobStatusValues),
    })
    .strict(),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const generateShortlistSummarySchema = z.object({
  params: jobIdParams,
  body: z
    .object({
      focus: trimmedOptionalString(1000),
    })
    .strict(),
});

export const generateApplicantComparisonSchema = z.object({
  params: jobIdParams,
  body: z
    .object({
      focus: trimmedOptionalString(1000),
    })
    .strict(),
});

export const generateApplicantDecisionBriefSchema = z.object({
  params: z.object({
    applicationId: z.string().min(1),
  }),
  body: z
    .object({
      focus: trimmedOptionalString(1000),
    })
    .strict(),
});

export const compareJobsSchema = z.object({
  body: z
    .object({
      jobIds: z.array(z.string().min(1)).min(2).max(4),
    })
    .strict()
    .refine((value) => new Set(value.jobIds).size === value.jobIds.length, {
      message: 'Job selections must be unique',
      path: ['jobIds'],
    }),
});

export const generateJobDraftSchema = z.object({
  body: z
    .object({
      title: trimmedOptionalString(160),
      description: trimmedOptionalString(5000),
      location: trimmedOptionalString(160),
      type: trimmedOptionalString(80),
      salary: trimmedOptionalString(120),
      category: trimmedOptionalString(120),
      focus: trimmedOptionalString(1000),
    })
    .strict(),
});
