import { z } from 'zod';

export const proposalStatusActionValues = ['ACCEPTED', 'REJECTED', 'CANCELLED'] as const;

const trimmedOptionalString = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(max).optional(),
  );

const isoDateString = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().datetime().optional(),
);

const proposalTermsSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1).max(5000),
    amount: trimmedOptionalString(120),
    timeline: trimmedOptionalString(160),
    expiresAt: isoDateString,
    message: trimmedOptionalString(2000),
  })
  .strict();

const proposalCounterTermsSchema = z
  .object({
    summary: z.string().trim().min(1).max(5000),
    amount: trimmedOptionalString(120),
    timeline: trimmedOptionalString(160),
    expiresAt: isoDateString,
    message: trimmedOptionalString(2000),
  })
  .strict();

const proposalDraftHintsSchema = z
  .object({
    title: trimmedOptionalString(160),
    amount: trimmedOptionalString(120),
    timeline: trimmedOptionalString(160),
    focus: trimmedOptionalString(1000),
  })
  .strict();

export const createJobProposalSchema = z.object({
  params: z.object({
    applicationId: z.string().min(1),
  }),
  body: proposalTermsSchema,
});

export const createServiceProposalSchema = z.object({
  params: z.object({
    requestId: z.string().min(1),
  }),
  body: proposalTermsSchema,
});

export const generateJobProposalDraftSchema = z.object({
  params: z.object({
    applicationId: z.string().min(1),
  }),
  body: proposalDraftHintsSchema,
});

export const generateServiceProposalDraftSchema = z.object({
  params: z.object({
    requestId: z.string().min(1),
  }),
  body: proposalDraftHintsSchema,
});

export const proposalIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const proposalDecisionBriefSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      focus: trimmedOptionalString(1000),
    })
    .strict(),
});

export const counterProposalSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: proposalCounterTermsSchema,
});

export const updateProposalStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      status: z.enum(proposalStatusActionValues),
    })
    .strict(),
});

export const compareProposalsSchema = z.object({
  body: z
    .object({
      proposalIds: z.array(z.string().min(1)).min(2).max(4),
    })
    .strict()
    .refine((value) => new Set(value.proposalIds).size === value.proposalIds.length, {
      message: 'Proposal selections must be unique',
      path: ['proposalIds'],
    }),
});
