import crypto from 'crypto';
import { SKILLS, isSkillSlug, skillName, skillsInText } from '../content/skills';

/** Courses: what a training provider can list, what the public sees, and the pages search engines get. */

export const COURSE_CATEGORIES = [
  { slug: 'technology', name: 'Technology and IT' },
  { slug: 'business', name: 'Business and management' },
  { slug: 'finance-accounting', name: 'Finance and accounting' },
  { slug: 'marketing-sales', name: 'Marketing and sales' },
  { slug: 'design-creative', name: 'Design and creative' },
  { slug: 'office-skills', name: 'Office and admin skills' },
  { slug: 'healthcare', name: 'Healthcare' },
  { slug: 'education-teaching', name: 'Education and teaching' },
  { slug: 'hospitality', name: 'Hospitality and catering' },
  { slug: 'trades-technical', name: 'Trades and technical' },
  { slug: 'agriculture', name: 'Agriculture' },
  { slug: 'languages', name: 'Languages' },
  { slug: 'personal-development', name: 'Personal development' },
] as const;

export const COURSE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL'] as const;
export const COURSE_FORMATS = ['ONLINE', 'IN_PERSON', 'HYBRID'] as const;
export const MIN_COURSES_FOR_PAGE = 3;
export const MAX_COURSE_SKILLS = 8;

export const isCategorySlug = (slug: string) => COURSE_CATEGORIES.some((category) => category.slug === slug);
export const categoryName = (slug: string) => COURSE_CATEGORIES.find((category) => category.slug === slug)?.name ?? slug;

const LEVEL_LABEL: Record<string, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced', ALL: 'All levels' };
const FORMAT_LABEL: Record<string, string> = { ONLINE: 'Online', IN_PERSON: 'In person', HYBRID: 'Online and in person' };
export const levelLabel = (level: string) => LEVEL_LABEL[level] ?? level;
export const formatLabel = (format: string) => FORMAT_LABEL[format] ?? format;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** A clean address for a course, kept unique with a short random ending. */
export const courseSlug = (title: string) => `${slugify(title).slice(0, 60) || 'course'}-${crypto.randomBytes(3).toString('hex')}`;

/** Which courses the public may see. The provider must be approved too. */
export const publicCourseWhere = () => ({
  status: 'ACTIVE',
  reviewStatus: 'APPROVED',
  provider: { status: 'ACTIVE', employerProfile: { is: { providerStatus: 'APPROVED' } } },
});

export const isFeaturedNow = (course: { featuredFrom?: Date | null; featuredUntil?: Date | null }, now = new Date()) =>
  Boolean(course.featuredUntil && course.featuredUntil.getTime() > now.getTime() && (!course.featuredFrom || course.featuredFrom.getTime() <= now.getTime()));

export const parseStartDates = (json: string | null | undefined): string[] => {
  try {
    const value = JSON.parse(json || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

/** Dates that have not passed yet, soonest first. */
export const upcomingStartDates = (dates: string[], now = new Date()) =>
  dates.filter((date) => new Date(`${date}T23:59:59Z`).getTime() >= now.getTime()).sort();

// ------------------------------------------------------------------ events

export type CourseEventType = 'VIEW' | 'CLICK' | 'ENQUIRY';

/**
 * Who a visit counts as, for one course, one kind of event, one day. A keyed hash: the same visitor on the same day
 * gives the same value (so it counts once), and nobody can work back from it to an IP address.
 */
export const visitorHash = (secret: string, ip: string, userAgent: string, courseId: string, type: CourseEventType, day = new Date()) =>
  crypto.createHmac('sha256', secret).update(`${ip}|${userAgent}|${courseId}|${type}|${day.toISOString().slice(0, 10)}`).digest('hex').slice(0, 40);

// ------------------------------------------------------------- public shape

export type PublicCourse = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: string;
  isFree: boolean;
  priceGhs: number | null;
  durationWeeks: number | null;
  format: string;
  location: string | null;
  startDates: string[];
  rollingStart: boolean;
  certificateOffered: boolean;
  enrolUrl: string | null;
  enquiryEnabled: boolean;
  skills: string[];
  featured: boolean;
  createdAt: Date | string;
  provider: { id: string; name: string; logoUrl: string | null; isVerified: boolean };
};

export const priceLabel = (course: Pick<PublicCourse, 'isFree' | 'priceGhs'>) =>
  course.isFree ? 'Free' : course.priceGhs != null ? `GHS ${course.priceGhs.toLocaleString('en-GB')}` : 'Ask for the price';

export const durationText = (weeks?: number | null) => {
  if (!weeks) return '';
  if (weeks < 8) return weeks === 1 ? '1 week' : `${weeks} weeks`;
  const months = Math.round(weeks / 4.345);
  return months === 1 ? '1 month' : `${months} months`;
};

/** Featured first, then newest. */
export const sortCourses = <T extends { featured: boolean; createdAt: Date | string }>(courses: T[]) =>
  [...courses].sort((a, b) => Number(b.featured) - Number(a.featured) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

// -------------------------------------------------- courses for a job page

/** What a job asks for, read from its title, field and description. */
export const jobSkills = (job: { title: string; category?: string | null; description?: string | null }) =>
  skillsInText([job.title, job.category, job.description].filter(Boolean).join('\n'));

/**
 * Up to 3 courses that teach what a job asks for: the ones teaching the most of those skills first, then featured,
 * then those from verified providers, then the newest.
 */
export const coursesForSkills = (courses: PublicCourse[], wanted: string[], limit = 3) => {
  if (wanted.length === 0) return [];
  const score = (course: PublicCourse) => course.skills.filter((skill) => wanted.includes(skill)).length;

  return courses
    .filter((course) => score(course) > 0)
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        Number(b.featured) - Number(a.featured) ||
        Number(b.provider.isVerified) - Number(a.provider.isVerified) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
};

// ---------------------------------------------------------- landing pages

export type CourseLanding = {
  kind: 'category' | 'skill';
  slug: string;
  path: string;
  h1: string;
  title: string;
  description: string;
  intro: string;
  count: number;
  /** False with fewer than MIN_COURSES_FOR_PAGE courses: the page says noindex and stays out of the sitemap. */
  indexable: boolean;
  courses: PublicCourse[];
  related: { label: string; path: string; count: number }[];
};

export const categoryPath = (slug: string) => `/courses/category/${slug}`;
export const skillPath = (slug: string) => `/${slug}-courses-in-ghana`;

const listWords = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

const introFor = (noun: string, courses: PublicCourse[]) => {
  if (courses.length === 0) {
    return `There are no ${noun} listed right now. Training providers add courses every week: browse every course, or check back soon.`;
  }
  const providers = new Set(courses.map((course) => course.provider.id)).size;
  const free = courses.filter((course) => course.isFree).length;
  const prices = courses.filter((course) => !course.isFree && course.priceGhs != null).map((course) => course.priceGhs as number);
  const formats = [...new Set(courses.map((course) => formatLabel(course.format).toLowerCase()))];

  return [
    courses.length === 1 ? `There is 1 course for ${noun} on JobWahala, from 1 training provider.` : `There are ${courses.length} ${noun} on JobWahala from ${providers} training ${providers === 1 ? 'provider' : 'providers'}.`,
    free > 0 ? `${free} ${free === 1 ? 'is' : 'are'} free.` : '',
    prices.length ? `Paid courses start from GHS ${Math.min(...prices).toLocaleString('en-GB')}.` : '',
    formats.length ? `Learn ${listWords(formats)}.` : '',
    'See the price, duration and start date before you enquire.',
  ]
    .filter(Boolean)
    .join(' ');
};

export const buildCourseLanding = (kind: 'category' | 'skill', slug: string, all: PublicCourse[]): CourseLanding | null => {
  const known = kind === 'category' ? isCategorySlug(slug) : isSkillSlug(slug);
  if (!known) return null;

  const courses = sortCourses(all.filter((course) => (kind === 'category' ? course.category === slug : course.skills.includes(slug))));
  const label = kind === 'category' ? categoryName(slug) : skillName(slug);
  const noun = kind === 'category' ? `${label.toLowerCase()} courses` : `${label} courses in Ghana`;

  // Neighbouring pages that are themselves published.
  const counts = new Map<string, number>();
  const related: CourseLanding['related'] = [];
  if (kind === 'category') {
    for (const course of courses) for (const skill of course.skills) counts.set(skill, (counts.get(skill) ?? 0) + 1);
    for (const [skill, count] of counts) if (count >= MIN_COURSES_FOR_PAGE) related.push({ label: `${skillName(skill)} courses in Ghana`, path: skillPath(skill), count });
  } else {
    for (const course of courses) counts.set(course.category, (counts.get(course.category) ?? 0) + 1);
    for (const [category, count] of counts) if (count >= MIN_COURSES_FOR_PAGE) related.push({ label: categoryName(category), path: categoryPath(category), count });
  }
  related.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));

  const title = kind === 'category' ? `${label} courses in Ghana` : `${label} courses in Ghana`;
  return {
    kind,
    slug,
    path: kind === 'category' ? categoryPath(slug) : skillPath(slug),
    h1: title,
    title: courses.length ? `${title} - ${courses.length} ${courses.length === 1 ? 'course' : 'courses'}` : title,
    description: courses.length
      ? `Compare ${courses.length} ${noun}${courses.some((c) => c.isFree) ? ', including free ones' : ''}. See the price, duration, format and start date, then enquire with the training provider.`
      : `Find ${noun} from training providers in Ghana. None are listed right now.`,
    intro: introFor(noun, courses),
    count: courses.length,
    indexable: courses.length >= MIN_COURSES_FOR_PAGE,
    courses: courses.slice(0, 50),
    related: related.slice(0, 8),
  };
};

/** Every skill or category page with enough courses to be published, for the sitemap. */
export const coursePagePaths = (all: PublicCourse[]) => {
  const paths: string[] = [];
  for (const category of COURSE_CATEGORIES) {
    if (all.filter((course) => course.category === category.slug).length >= MIN_COURSES_FOR_PAGE) paths.push(categoryPath(category.slug));
  }
  for (const skill of SKILLS) {
    if (all.filter((course) => course.skills.includes(skill.slug)).length >= MIN_COURSES_FOR_PAGE) paths.push(skillPath(skill.slug));
  }
  return paths;
};

/** Is this a "[skill] courses in Ghana" address? Returns the skill slug. */
export const skillFromCoursesSlug = (slug: string) => {
  const match = /^([a-z0-9-]+)-courses-in-ghana$/.exec(slug);
  return match && isSkillSlug(match[1]) ? match[1] : null;
};

// -------------------------------------------------------- structured data

const COURSE_MODE: Record<string, string> = { ONLINE: 'Online', IN_PERSON: 'Onsite', HYBRID: 'Blended' };

/** Google's Course data: what is taught, who by, what it costs, how it is delivered and when it starts. */
export const buildCourseJsonLd = (
  course: PublicCourse & { description: string },
  siteUrl: string,
  now = new Date(),
) => {
  const url = `${siteUrl}/courses/${course.slug}`;
  const starts = upcomingStartDates(course.startDates, now);

  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description.replace(/\s+/g, ' ').trim().slice(0, 500) || course.summary,
    url,
    inLanguage: 'en',
    provider: { '@type': 'Organization', name: course.provider.name, sameAs: `${siteUrl}/providers/${course.provider.id}` },
    educationalLevel: levelLabel(course.level),
    ...(course.skills.length ? { teaches: course.skills.map(skillName) } : {}),
    ...(course.durationWeeks ? { timeRequired: `P${course.durationWeeks}W` } : {}),
    ...(course.certificateOffered ? { educationalCredentialAwarded: 'Certificate' } : {}),
    offers: {
      '@type': 'Offer',
      category: course.isFree ? 'Free' : 'Paid',
      price: course.isFree ? 0 : course.priceGhs ?? 0,
      priceCurrency: 'GHS',
      url,
    },
    hasCourseInstance: (starts.length ? starts : [null]).map((startDate) => ({
      '@type': 'CourseInstance',
      courseMode: COURSE_MODE[course.format] ?? 'Online',
      ...(startDate ? { startDate } : {}),
      ...(course.durationWeeks ? { courseWorkload: `P${course.durationWeeks}W` } : {}),
      ...(course.format !== 'ONLINE' && course.location
        ? { location: { '@type': 'Place', name: course.location, address: { '@type': 'PostalAddress', addressLocality: course.location, addressCountry: 'GH' } } }
        : {}),
    })),
  };
};
