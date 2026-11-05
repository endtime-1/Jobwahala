import { z } from 'zod';
import { isPlausibleRegistrationNumber } from '../utils/verification';
import { normalizePhone } from './interestSchemas';

const verificationStatusValues = ['APPROVED', 'REJECTED', 'NEEDS_INFO'] as const;

const idParamsSchema = z.object({
  id: z.string().min(1),
});

export const createVerificationRequestSchema = z.object({
  body: z
    .object({
      details: z.string().trim().min(20).max(2000),
      documentUrl: z
        .preprocess(
          (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
          z.string().trim().url().max(500).optional(),
        ),
    })
    .strict(),
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
    })
    .strict(),
  params: idParamsSchema,
});

const blankToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

/** What a company sends to get verified: the details the admin team needs, and a contact we can confirm. */
export const createBusinessVerificationRequestSchema = z.object({
  body: z
    .object({
      registrationNumber: z
        .string()
        .trim()
        .refine(isPlausibleRegistrationNumber, 'Enter your Registrar-General registration number'),
      documentUrl: z.string().trim().min(1, 'Upload your registration certificate').url('Upload your registration certificate').max(500),
      contactEmail: z
        .string()
        .trim()
        .email('Enter the company email address')
        .max(254)
        .transform((value) => value.toLowerCase()),
      contactPhone: z.preprocess(
        blankToUndefined,
        z
          .string()
          .trim()
          .max(30)
          .refine((value) => normalizePhone(value) !== null, 'Enter a valid phone number')
          .optional(),
      ),
      address: z.string().trim().min(10, 'Enter the full physical address').max(300),
      details: z.preprocess(blankToUndefined, z.string().trim().max(2000).optional()),
    })
    .strict(),
});

export const verificationCodeParamsSchema = z.object({ params: idParamsSchema });

export const confirmVerificationCodeSchema = z.object({
  params: idParamsSchema,
  body: z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') }).strict(),
});
