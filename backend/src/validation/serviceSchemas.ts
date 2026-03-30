import { z } from 'zod';

export const serviceRequestStatuses = ['PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED'] as const;
export const ownerServiceStatusValues = ['ACTIVE', 'PAUSED'] as const;

const trimmedOptionalString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).optional(),
  );

const positiveNumberField = z.preprocess(
  (value) => (typeof value === 'string' ? Number(value) : value),
  z.number().positive(),
);

export const createServiceSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().min(1).max(5000),
      price: positiveNumberField,
      deliveryTime: trimmedOptionalString(120),
      category: trimmedOptionalString(120),
    })
    .strict(),
});

export const updateServiceSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(160).optional(),
      description: z.string().trim().min(1).max(5000).optional(),
      price: positiveNumberField.optional(),
      deliveryTime: trimmedOptionalString(120),
      category: trimmedOptionalString(120),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required',
    }),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createServiceRequestSchema = z.object({
  body: z
    .object({
      message: z.string().trim().min(1).max(3000),
      budget: trimmedOptionalString(120),
      timeline: trimmedOptionalString(120),
    })
    .strict(),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const serviceIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const updateServiceRequestStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(serviceRequestStatuses),
    })
    .strict(),
  params: z.object({
    requestId: z.string().min(1),
  }),
});

export const updateOwnedServiceStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(ownerServiceStatusValues),
    })
    .strict(),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const generateServiceDraftSchema = z.object({
  body: z
    .object({
      title: trimmedOptionalString(160),
      description: trimmedOptionalString(5000),
      price: trimmedOptionalString(120),
      deliveryTime: trimmedOptionalString(120),
      category: trimmedOptionalString(120),
      focus: trimmedOptionalString(1000),
    })
    .strict(),
});

export const compareMarketplaceServicesSchema = z.object({
  body: z
    .object({
      freelancerIds: z.array(z.string().min(1)).min(2).max(4),
    })
    .strict()
    .refine((value) => new Set(value.freelancerIds).size === value.freelancerIds.length, {
      message: 'Freelancer selections must be unique',
      path: ['freelancerIds'],
    }),
});
