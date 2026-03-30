import { z } from 'zod';

const trimmedOptionalString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).optional(),
  );

const optionalUrl = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? '' : trimmed;
    },
    z.union([z.literal(''), z.string().url().max(500)]).optional(),
  );

const seekerProfileBodySchema = z
  .object({
    firstName: trimmedOptionalString(80),
    lastName: trimmedOptionalString(80),
    skills: trimmedOptionalString(500),
    experience: trimmedOptionalString(2000),
    resumeFileUrl: optionalUrl(),
  })
  .strict();

const employerProfileBodySchema = z
  .object({
    companyName: trimmedOptionalString(120),
    industry: trimmedOptionalString(120),
    logoUrl: optionalUrl(),
    website: optionalUrl(),
    description: trimmedOptionalString(2000),
  })
  .strict();

const freelancerProfileBodySchema = z
  .object({
    firstName: trimmedOptionalString(80),
    lastName: trimmedOptionalString(80),
    hourlyRate: z.coerce.number().positive().max(100000).optional(),
    portfolioUrl: optionalUrl(),
    bio: trimmedOptionalString(2000),
    skills: trimmedOptionalString(500),
  })
  .strict();

export const getProfileUpdateSchema = (role?: string) => {
  if (role === 'SEEKER') {
    return z.object({ body: seekerProfileBodySchema });
  }

  if (role === 'EMPLOYER') {
    return z.object({ body: employerProfileBodySchema });
  }

  if (role === 'FREELANCER') {
    return z.object({ body: freelancerProfileBodySchema });
  }

  return z.object({
    body: z.never(),
  });
};
