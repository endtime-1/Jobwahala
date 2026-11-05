import { z } from 'zod';
import { normalizeGhanaPhone } from '../utils/phone';

const publicRegistrationRoles = ['SEEKER', 'EMPLOYER', 'FREELANCER'] as const;

const normalizedEmail = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(120)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
  body: z
    .object({
      email: normalizedEmail,
      password: passwordSchema,
      role: z
        .preprocess(
          (value) => (typeof value === 'string' ? value.toUpperCase() : value),
          z.enum(publicRegistrationRoles).default('SEEKER'),
        ),
    })
    .strict(),
});

export const loginSchema = z.object({
  body: z
    .object({
      email: normalizedEmail,
      password: passwordSchema,
    })
    .strict(),
});

export const verifyEmailSchema = z.object({
  body: z
    .object({
      token: z.string().min(1),
    })
    .strict(),
});

export const resendVerificationSchema = z.object({
  body: z
    .object({
      email: normalizedEmail,
    })
    .strict(),
});

export const forgotPasswordSchema = z.object({
  body: z
    .object({
      email: normalizedEmail,
    })
    .strict(),
});

export const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z.string().min(1),
      password: passwordSchema,
    })
    .strict(),
});

/** A Ghanaian mobile number typed any usual way; becomes +233XXXXXXXXX. */
export const ghanaPhoneSchema = z
  .string()
  .trim()
  .min(1, 'Enter your phone number')
  .max(30)
  .transform((value, ctx) => {
    const phone = normalizeGhanaPhone(value);
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a Ghanaian mobile number, like 024 123 4567' });
      return z.NEVER;
    }
    return phone;
  });

const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const sendPhoneCodeSchema = z.object({
  body: z.object({ phone: ghanaPhoneSchema, purpose: z.enum(['LOGIN', 'SIGNUP']) }).strict(),
});

export const phoneLoginSchema = z.object({
  body: z.object({ phone: ghanaPhoneSchema, code: otpCodeSchema }).strict(),
});

export const phoneSignupSchema = z.object({
  body: z
    .object({
      phone: ghanaPhoneSchema,
      code: otpCodeSchema,
      role: z.preprocess(
        (value) => (typeof value === 'string' ? value.toUpperCase() : value),
        z.enum(publicRegistrationRoles).default('SEEKER'),
      ),
    })
    .strict(),
});

export const addPhoneSchema = z.object({ body: z.object({ phone: ghanaPhoneSchema }).strict() });

export const confirmAddPhoneSchema = z.object({
  body: z.object({ phone: ghanaPhoneSchema, code: otpCodeSchema }).strict(),
});

/** Deleting an account: typed confirmation, plus a password (email accounts) or a texted code (phone-only accounts). */
export const deleteAccountSchema = z.object({
  body: z
    .object({
      confirm: z.literal('DELETE', { message: 'Type DELETE to confirm' }),
      password: z.string().max(200).optional(),
      code: otpCodeSchema.optional(),
      acknowledgeCompany: z.boolean().optional(),
    })
    .strict(),
});

export const googleAuthSchema = z.object({
  body: z
    .object({
      // The ID token the Google button gives the browser.
      credential: z.string().min(20).max(4000),
      // Needed only to create a new account; log-in does not need it.
      role: z
        .preprocess((value) => (typeof value === 'string' ? value.toUpperCase() : value), z.enum(['SEEKER', 'EMPLOYER']))
        .optional(),
    })
    .strict(),
});
