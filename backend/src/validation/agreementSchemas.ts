import { z } from 'zod';

export const agreementStatusValues = ['COMPLETED', 'CANCELLED'] as const;
export const agreementMilestoneStatusValues = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export const agreementMilestonePaymentStatusValues = ['REQUESTED', 'PAID'] as const;
export const agreementPaymentStatusValues = ['SUCCEEDED', 'FAILED', 'CANCELLED'] as const;
export const agreementDisputeTypeValues = ['PAYMENT', 'DELIVERY', 'QUALITY', 'COMMUNICATION', 'OTHER'] as const;

const trimmedOptionalString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).optional(),
  );

const optionalIsoDate = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
}, z.string().datetime().optional());

export const updateAgreementStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(agreementStatusValues),
    })
    .strict(),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createAgreementMilestoneSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(160),
      description: trimmedOptionalString(2000),
      amount: trimmedOptionalString(120),
      dueDate: optionalIsoDate,
    })
    .strict(),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const updateAgreementMilestoneStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(agreementMilestoneStatusValues),
    })
    .strict(),
  params: z.object({
    id: z.string().min(1),
    milestoneId: z.string().min(1),
  }),
});

export const updateAgreementMilestonePaymentStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(agreementMilestonePaymentStatusValues),
    })
    .strict(),
  params: z.object({
    id: z.string().min(1),
    milestoneId: z.string().min(1),
  }),
});

export const createAgreementMilestonePaymentSessionSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    milestoneId: z.string().min(1),
  }),
});

export const createAgreementReviewSchema = z.object({
  body: z
    .object({
      rating: z.number().int().min(1).max(5),
      comment: trimmedOptionalString(1200),
    })
    .strict(),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createAgreementDisputeSchema = z.object({
  body: z
    .object({
      type: z.enum(agreementDisputeTypeValues),
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().min(1).max(2400),
      evidenceUrl: trimmedOptionalString(600),
    })
    .strict(),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const updateAgreementPaymentStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(agreementPaymentStatusValues),
      failureReason: trimmedOptionalString(400),
    })
    .strict(),
  params: z.object({
    id: z.string().min(1),
    paymentId: z.string().min(1),
  }),
});

export const verifyAgreementPaymentSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    paymentId: z.string().min(1),
  }),
});

export const compareAgreementsSchema = z.object({
  body: z
    .object({
      agreementIds: z.array(z.string().min(1)).min(2).max(4),
    })
    .strict()
    .refine((value) => new Set(value.agreementIds).size === value.agreementIds.length, {
      message: 'Agreement selections must be unique',
      path: ['agreementIds'],
    }),
});

export const agreementDecisionBriefSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      focus: trimmedOptionalString(1000),
    })
    .strict(),
});
