import { z } from 'zod';
import { isSkillSlug } from '../content/skills';
import { COURSE_CATEGORIES, COURSE_FORMATS, COURSE_LEVELS, MAX_COURSE_SKILLS } from '../utils/courses';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z.preprocess((value) => (typeof value === 'string' ? value.trim() || null : value), z.string().max(max).nullable().optional());

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must look like 2026-12-01');

/** A link people are sent to: https (or http) only, never a script. */
const webLink = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() || null : value),
  z.string().url().max(500).refine((value) => /^https?:\/\//i.test(value), 'Use a web address starting with https://').nullable().optional(),
);

export const courseBodySchema = z
  .object({
    title: text(5, 120),
    summary: text(10, 200),
    description: text(20, 5000),
    category: z.enum(COURSE_CATEGORIES.map((category) => category.slug) as [string, ...string[]]),
    level: z.enum(COURSE_LEVELS),
    isFree: z.boolean(),
    priceGhs: z.number().int().min(1).max(1_000_000).nullable().optional(),
    durationWeeks: z.number().int().min(1).max(156).nullable().optional(),
    format: z.enum(COURSE_FORMATS),
    location: optionalText(120),
    startDates: z.array(day).max(12).optional(),
    rollingStart: z.boolean().optional(),
    certificateOffered: z.boolean().optional(),
    enrolUrl: webLink,
    enquiryEnabled: z.boolean().optional(),
    skills: z
      .array(z.string())
      .min(1, 'Choose at least one skill the course teaches')
      .max(MAX_COURSE_SKILLS)
      .refine((skills) => skills.every(isSkillSlug), 'Choose skills from the list')
      .refine((skills) => new Set(skills).size === skills.length, 'Each skill once'),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (!body.isFree && !body.priceGhs) ctx.addIssue({ code: 'custom', path: ['priceGhs'], message: 'Give the price in GHS, or mark the course as free' });
    if (body.format !== 'ONLINE' && !body.location) ctx.addIssue({ code: 'custom', path: ['location'], message: 'Say where in-person classes are held' });
    if (!body.enrolUrl && body.enquiryEnabled === false) ctx.addIssue({ code: 'custom', path: ['enrolUrl'], message: 'Give an enrolment link, or allow enquiries' });
  });

export const createCourseSchema = z.object({ body: courseBodySchema });
export const updateCourseSchema = z.object({ params: z.object({ id: z.string().min(1) }), body: courseBodySchema });
export const courseIdSchema = z.object({ params: z.object({ id: z.string().min(1).max(80) }) });

export const courseEventSchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
  body: z.object({ type: z.enum(['VIEW', 'CLICK']) }).strict(),
});

export const enquirySchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
  body: z
    .object({
      name: text(2, 80),
      email: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() || undefined : v), z.string().email().max(160).optional()),
      phone: z.preprocess((v) => (typeof v === 'string' ? v.trim() || undefined : v), z.string().min(7).max(20).regex(/^[+\d][\d\s()-]+$/, 'Phone number looks wrong').optional()),
      message: text(5, 1000),
    })
    .strict()
    .refine((body) => body.email || body.phone, { message: 'Give an email address or a phone number so the provider can reply', path: ['email'] }),
});

export const courseListQuerySchema = z.object({
  query: z
    .object({
      q: z.string().trim().max(80).optional(),
      category: z.string().max(40).optional(),
      skill: z.string().max(40).optional(),
      level: z.string().max(20).optional(),
      format: z.string().max(20).optional(),
      location: z.string().trim().max(80).optional(),
      free: z.string().max(5).optional(),
      maxPrice: z.string().max(10).optional(),
      verified: z.string().max(5).optional(),
    })
    .passthrough(),
});

// ---- learners

export const learnerCourseSchema = z.object({
  body: z
    .object({
      courseId: z.string().min(1).max(80).optional(),
      title: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(3).max(160).optional()),
      providerName: optionalText(120),
      completedOn: day.optional(),
      certificateUrl: webLink,
    })
    .strict()
    .refine((body) => body.courseId || body.title, { message: 'Choose a course, or write its name', path: ['title'] }),
});

export const decisionSchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
  body: z.object({ decision: z.enum(['CONFIRM', 'DECLINE']), note: z.string().trim().max(300).optional() }).strict(),
});

// ---- admin

export const providerReviewSchema = z.object({
  params: z.object({ userId: z.string().min(1).max(80) }),
  body: z.object({ decision: z.enum(['APPROVE', 'REJECT']), reason: z.string().trim().max(500).optional() }).strict(),
});

export const courseReviewSchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
  body: z.object({ decision: z.enum(['APPROVE', 'REJECT', 'REMOVE']), reason: z.string().trim().max(500).optional() }).strict(),
});

export const featuredSchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
  body: z
    .object({
      // A number of days from today, or false/0 to stop featuring it.
      days: z.number().int().min(0).max(365),
    })
    .strict(),
});
