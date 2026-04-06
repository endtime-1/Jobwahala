import { z } from 'zod';

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
