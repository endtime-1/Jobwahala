import prisma from '../config/prisma';
import { isVerifiedEmployer, approvedBusinessVerificationQuery } from '../utils/verification';
import { isFeaturedNow, parseStartDates, publicCourseWhere, sortCourses, type PublicCourse } from '../utils/courses';

/** What to read with a course so it can be shown publicly. */
export const courseInclude = {
  skills: { select: { skill: true } },
  provider: {
    select: {
      id: true,
      employerProfile: { select: { companyName: true, logoUrl: true } },
      verificationRequests: approvedBusinessVerificationQuery,
    },
  },
} as const;

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  category: string;
  level: string;
  isFree: boolean;
  priceGhs: number | null;
  durationWeeks: number | null;
  format: string;
  location: string | null;
  startDatesJson: string;
  rollingStart: boolean;
  certificateOffered: boolean;
  enrolUrl: string | null;
  enquiryEnabled: boolean;
  featuredFrom: Date | null;
  featuredUntil: Date | null;
  createdAt: Date;
  skills: { skill: string }[];
  provider: {
    id: string;
    employerProfile: { companyName: string; logoUrl: string | null } | null;
    verificationRequests: { status: string; type: string }[];
  };
};

/** The public face of a course: nothing private, and the provider only as a name, a logo and a yes/no for "verified". */
export const toPublicCourse = (row: CourseRow, now = new Date()): PublicCourse => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  category: row.category,
  level: row.level,
  isFree: row.isFree,
  priceGhs: row.isFree ? null : row.priceGhs,
  durationWeeks: row.durationWeeks,
  format: row.format,
  location: row.location,
  startDates: parseStartDates(row.startDatesJson),
  rollingStart: row.rollingStart,
  certificateOffered: row.certificateOffered,
  enrolUrl: row.enrolUrl,
  enquiryEnabled: row.enquiryEnabled,
  skills: row.skills.map((entry) => entry.skill),
  featured: isFeaturedNow(row, now),
  createdAt: row.createdAt,
  provider: {
    id: row.provider.id,
    name: row.provider.employerProfile?.companyName || 'Training provider',
    logoUrl: row.provider.employerProfile?.logoUrl ?? null,
    isVerified: isVerifiedEmployer(row.provider.verificationRequests),
  },
});

// Landing pages, the sitemap and "courses for this job" all read the whole catalogue, so a short-lived copy is shared.
const CATALOG_CACHE_MS = 2 * 60 * 1000;
let cache: { at: number; courses: PublicCourse[] } | null = null;

export const resetCourseCatalogCache = () => {
  cache = null;
};

/** Every course the public may see, featured first then newest. */
export const loadPublicCourses = async (): Promise<PublicCourse[]> => {
  if (cache && Date.now() - cache.at < CATALOG_CACHE_MS) return cache.courses;

  const rows = await prisma.course.findMany({
    where: publicCourseWhere(),
    include: courseInclude,
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  const courses = sortCourses(rows.map((row) => toPublicCourse(row as unknown as CourseRow)));
  cache = { at: Date.now(), courses };
  return courses;
};
