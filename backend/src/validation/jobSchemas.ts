import { z } from 'zod';
import { MAX_SALARY, salaryRangeProblem } from '../utils/salary';
import { SCHEDULES } from '../utils/earlyCareer';

export const applicationStatusValues = ['SUBMITTED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED', 'HIRED'] as const;
export const ownerJobStatusValues = ['ACTIVE', 'PAUSED', 'CLOSED'] as const;

const trimmedOptionalString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).optional(),
  );

/** Pay in Ghana cedis per month, as a whole number. null clears it. */
const salaryNumber = z.number().int().min(0).max(MAX_SALARY).nullable().optional();

const rejectBackwardsPay = (body: { salaryMin?: number | null; salaryMax?: number | null }, ctx: z.RefinementCtx) => {
  const problem = salaryRangeProblem(body.salaryMin, body.salaryMax);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: ['salaryMax'] });
};

/** Extra details for internships, National Service, attachments and graduate jobs. */
const earlyCareerFields = {
  unpaid: z.boolean().optional(),
  durationMonths: z.number().int().min(1).max(36).nullable().optional(),
  startsImmediately: z.boolean().optional(),
  // A day, like 2026-12-01. null clears it.
  startDate: z.string().trim().max(40).nullable().optional(),
  schedule: z.enum(SCHEDULES).nullable().optional(),
  possibleJobOffer: z.boolean().optional(),
};

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
      // A date (2026-12-01) or date-time. Left out means 30 days from now; the most is 90 days.
      closesAt: trimmedOptionalString(40),
      // Save without publishing.
      status: z.enum(['DRAFT', 'ACTIVE']).optional(),
      salaryMin: salaryNumber,
      salaryMax: salaryNumber,
      ...earlyCareerFields,
    })
    .strict()
    .superRefine(rejectBackwardsPay),
});

export const updateJobSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      title: z.string().trim().min(1).max(160).optional(),
      description: z.string().trim().min(1).max(5000).optional(),
      location: trimmedOptionalString(160),
      type: z.string().trim().min(1).max(80).optional(),
      salary: trimmedOptionalString(120),
      category: trimmedOptionalString(120),
      closesAt: trimmedOptionalString(40),
      salaryMin: salaryNumber,
      salaryMax: salaryNumber,
      ...earlyCareerFields,
    })
    .strict()
    .superRefine(rejectBackwardsPay)
    .refine((body) => Object.values(body).some((value) => value !== undefined), { message: 'Nothing to change' }),
});

export const extendJobSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ days: z.number().int().min(1).max(90).optional() }).strict(),
});

export const applyForJobSchema = z.object({
  body: z
    .object({
      coverLetter: trimmedOptionalString(3000),
      // Which CV to send: the one they uploaded, the one from the CV builder, or none.
      cv: z.enum(['UPLOADED', 'BUILDER', 'NONE']).optional(),
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

export const applicationReviewSchema = z.object({
  body: z
    .object({
      // 1 to 5 stars, or null to clear it.
      rating: z.number().int().min(1).max(5).nullable().optional(),
      // Private note; an empty string clears it.
      note: z.string().trim().max(2000).optional(),
    })
    .strict()
    .refine((value) => value.rating !== undefined || value.note !== undefined, { message: 'Send a rating or a note' }),
  params: z.object({
    applicationId: z.string().min(1),
  }),
});

export const bulkRejectSchema = z.object({
  body: z
    .object({
      applicationIds: z.array(z.string().min(1)).min(1).max(100),
    })
    .strict(),
  params: jobIdParams,
});
