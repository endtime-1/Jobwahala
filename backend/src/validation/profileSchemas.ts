import { z } from 'zod';
import { AVAILABILITY, CV_VISIBILITY, EDUCATION_LEVELS } from '../utils/cvDatabase';
import { matchesStoredUploadUrl } from '../services/evidenceStorage';
import { CAREER_STAGES } from '../utils/earlyCareer';

const trimmedOptionalString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).optional(),
  );

const optionalUrl = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      let trimmed = value.trim();
      if (trimmed === '') return '';
      if (!/^https?:\/\//i.test(trimmed)) {
        trimmed = `https://${trimmed}`;
      }
      return trimmed;
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
    // Early career. An empty value clears it.
    careerStage: z.union([z.enum(CAREER_STAGES), z.literal('')]).optional(),
    institution: trimmedOptionalString(120),
    programme: trimmedOptionalString(120),
    completionYear: z.number().int().min(1990).max(new Date().getFullYear() + 8).nullable().optional(),
    // CV database: who may find this profile, and what employers can filter by.
    cvVisibility: z.enum(CV_VISIBILITY).optional(),
    headline: trimmedOptionalString(120),
    location: trimmedOptionalString(80),
    educationLevel: z.union([z.enum(EDUCATION_LEVELS), z.literal('')]).optional(),
    availability: z.union([z.enum(AVAILABILITY), z.literal('')]).optional(),
    yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
    jobCategory: trimmedOptionalString(80),
  })
  .strict();

// A logo is shown publicly, so it must be an image uploaded through JobWahala (never a hot-linked
// external address that could be swapped later). An empty value clears the logo.
const logoUrlField = () =>
  z
    .preprocess((value) => (typeof value === 'string' ? value.trim() : value), z.string().max(500).optional())
    .refine((value) => !value || matchesStoredUploadUrl('logo', value), {
      message: 'Upload your logo through JobWahala',
    });

const employerProfileBodySchema = z
  .object({
    companyName: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim() : value),
      z.string().min(1, 'Company name cannot be empty').max(120).optional(),
    ),
    industry: trimmedOptionalString(120),
    logoUrl: logoUrlField(),
    website: optionalUrl(),
    description: trimmedOptionalString(2000),
    // Branded company page (plans that include it): checked against the plan when saved.
    coverImageUrl: logoUrlField(),
    gallery: z.array(logoUrlField().refine((value) => Boolean(value), 'Upload each picture through JobWahala')).max(6).optional(),
    whyWorkWithUs: trimmedOptionalString(2000),
  })
  .strict();

const freelancerProfileBodySchema = z
  .object({
    firstName: trimmedOptionalString(80),
    lastName: trimmedOptionalString(80),
    tagline: trimmedOptionalString(150),
    availability: z.enum(['AVAILABLE', 'BUSY', 'OUT_OF_OFFICE']).optional(),
    location: trimmedOptionalString(100),
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
