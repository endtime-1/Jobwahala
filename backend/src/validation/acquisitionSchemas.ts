import { z } from 'zod';

const id = z.string().min(1).max(80);
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .union([text(max), z.null()])
    .optional()
    .transform((value) => (value ? value : undefined));

export const OUTREACH_STATUSES = ['CONTACTED', 'INTERESTED', 'POSTED', 'NOT_INTERESTED'] as const;

export const createCompanySchema = z.object({
  body: z
    .object({
      companyName: text(120).min(2),
      industry: optionalText(120),
      website: optionalText(200),
      description: optionalText(2000),
      contactPhone: optionalText(30),
    })
    .strict(),
});

export const claimLinkSchema = z.object({
  params: z.object({ id }),
  body: z
    .object({
      channel: z.enum(['EMAIL', 'WHATSAPP', 'LINK']),
      email: z.union([z.string().trim().toLowerCase().email().max(160), z.literal('')]).optional(),
      phone: optionalText(30),
    })
    .strict(),
});

export const claimIdSchema = z.object({ params: z.object({ id }) });

export const foundingSettingsSchema = z.object({
  body: z.object({ limit: z.number().int().min(1).max(1000), featuredCredits: z.number().int().min(0).max(50) }).strict(),
});

export const foundingToggleSchema = z.object({
  params: z.object({ id }),
  body: z.object({ founding: z.boolean() }).strict(),
});

// Outreach fields keep an empty value as empty (so a note can be cleared); the controller turns it into null.
const looseText = (max: number) => z.union([text(max), z.null()]).optional();
const outreachFields = {
  businessName: text(160).min(2),
  contactName: looseText(120),
  contactPhone: looseText(30),
  contactEmail: z.union([z.string().trim().toLowerCase().email().max(160), z.literal(''), z.null()]).optional(),
  sector: looseText(120),
  location: looseText(120),
  status: z.enum(OUTREACH_STATUSES),
  notes: looseText(2000),
  followUpAt: z.union([z.string().trim().max(40), z.null()]).optional(),
};

export const createOutreachSchema = z.object({ body: z.object({ ...outreachFields, status: outreachFields.status.default('CONTACTED') }).strict() });
export const updateOutreachSchema = z.object({ params: z.object({ id }), body: z.object(outreachFields).partial().strict() });
export const outreachIdSchema = z.object({ params: z.object({ id }) });

export const acceptClaimSchema = z.object({
  params: z.object({ token: z.string().min(20).max(200) }),
  body: z.object({ email: z.string().trim().toLowerCase().email().max(160), password: z.string().min(8).max(128) }).strict(),
});
export const claimTokenSchema = z.object({ params: z.object({ token: z.string().min(20).max(200) }) });

export const referralCodeSchema = z.object({ body: z.object({ code: z.string().trim().min(4).max(20) }).strict() });
