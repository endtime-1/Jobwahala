import { Request, Response } from 'express';
import env from '../config/env';
import logger from '../config/logger';
import prisma from '../config/prisma';
import { optionalUser } from '../middleware/auth';
import { courseInclude, loadPublicCourses, toPublicCourse } from '../services/courseCatalog';
import { skillName } from '../content/skills';
import { getErrorMessage } from '../utils/errors';
import { publicJobWhere } from '../utils/jobLifecycle';
import { createNotification } from '../utils/notifications';
import { singleValue } from '../utils/request';
import { isVerifiedEmployer, approvedBusinessVerificationQuery } from '../utils/verification';
import {
  buildCourseLanding,
  coursesForSkills,
  jobSkills,
  publicCourseWhere,
  visitorHash,
  type CourseEventType,
  type PublicCourse,
} from '../utils/courses';

const MAX_LIST = 60;
const lower = (value: string | undefined) => (value ?? '').trim().toLowerCase();
const flag = (value: unknown) => ['1', 'true', 'yes'].includes(String(value ?? '').toLowerCase());

/** The catalogue narrowed by what the visitor asked for. Done in code, so matching ignores case on every database. */
export const filterCourses = (courses: PublicCourse[], query: Record<string, unknown>) => {
  const q = lower(singleValue(query.q as string | string[] | undefined));
  const category = lower(singleValue(query.category as string | string[] | undefined));
  const skill = lower(singleValue(query.skill as string | string[] | undefined));
  const level = (singleValue(query.level as string | string[] | undefined) || '').toUpperCase();
  const format = (singleValue(query.format as string | string[] | undefined) || '').toUpperCase();
  const location = lower(singleValue(query.location as string | string[] | undefined));
  const maxPrice = Number(singleValue(query.maxPrice as string | string[] | undefined));
  const freeOnly = flag(query.free);
  const verifiedOnly = flag(query.verified);

  return courses.filter((course) => {
    if (q && ![course.title, course.summary, course.provider.name, ...course.skills.map(skillName)].some((part) => part.toLowerCase().includes(q))) return false;
    if (category && course.category !== category) return false;
    if (skill && !course.skills.includes(skill)) return false;
    if (level && course.level !== level && course.level !== 'ALL') return false;
    if (format && course.format !== format && course.format !== 'HYBRID') return false;
    if (location && !(course.location ?? '').toLowerCase().includes(location) && course.format === 'IN_PERSON') return false;
    if (freeOnly && !course.isFree) return false;
    if (Number.isFinite(maxPrice) && maxPrice > 0 && !course.isFree && (course.priceGhs ?? Infinity) > maxPrice) return false;
    if (verifiedOnly && !course.provider.isVerified) return false;
    return true;
  });
};

export const listCourses = async (req: Request, res: Response) => {
  try {
    const all = await loadPublicCourses();
    const matching = filterCourses(all, req.query);
    return res.json({ success: true, total: matching.length, courses: matching.slice(0, MAX_LIST) });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getCourse = async (req: Request, res: Response) => {
  try {
    const slug = singleValue(req.params.slug) || '';
    const row = await prisma.course.findFirst({ where: { slug, ...publicCourseWhere() }, include: courseInclude });
    if (!row) return res.status(404).json({ success: false, message: 'Course not found' });

    const course = { ...toPublicCourse(row as never), description: row.description };
    const all = await loadPublicCourses();
    const related = all.filter((other) => other.id !== course.id && other.category === course.category).slice(0, 3);
    return res.json({ success: true, course, related });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Crawlers and link previews are not people looking at a course, so they are not counted (providers are billed on this). */
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|headless/i;

/** A view of the page, or a click on the enrolment link. Each visitor counts once a day, and a provider never counts for their own course. */
export const trackCourseEvent = async (req: Request, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const { type } = req.body as { type: 'VIEW' | 'CLICK' };
    const userAgent = req.get('user-agent') || '';

    if (BOT.test(userAgent) || !userAgent) return res.json({ success: true, counted: false });

    const course = await prisma.course.findFirst({ where: { id, ...publicCourseWhere() }, select: { id: true, providerId: true } });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const viewer = await optionalUser(req);
    if (viewer?.id === course.providerId) return res.json({ success: true, counted: false });

    try {
      await prisma.courseEvent.create({
        data: { courseId: course.id, type, visitorHash: visitorHash(env.jwtSecret, req.ip || '', userAgent, course.id, type) },
      });
      return res.json({ success: true, counted: true });
    } catch (error) {
      // The same visitor, the same day: already counted.
      if ((error as { code?: string }).code === 'P2002') return res.json({ success: true, counted: false });
      throw error;
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** A learner asks the provider something. The provider is told in the app, and it counts as an enquiry for billing. */
export const createEnquiry = async (req: Request, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const { name, email, phone, message } = req.body as { name: string; email?: string; phone?: string; message: string };

    const course = await prisma.course.findFirst({
      where: { id, ...publicCourseWhere() },
      select: { id: true, title: true, providerId: true, enquiryEnabled: true },
    });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!course.enquiryEnabled) {
      return res.status(400).json({ success: false, message: 'This provider takes enrolments through its own link. Use "Enrol" on the course page.' });
    }

    const viewer = await optionalUser(req);

    const enquiry = await prisma.$transaction(async (tx) => {
      const created = await tx.courseEnquiry.create({
        data: { courseId: course.id, userId: viewer?.id ?? null, name, email: email ?? null, phone: phone ?? null, message },
      });
      // One event per enquiry: each one is billable.
      await tx.courseEvent.create({ data: { courseId: course.id, type: 'ENQUIRY' satisfies CourseEventType, visitorHash: created.id } });
      await createNotification(tx, {
        userId: course.providerId,
        type: 'COURSE_ENQUIRY',
        title: `New enquiry about ${course.title}`,
        message: `${name} asked about your course. Open your provider dashboard to reply.`,
        actionUrl: '/provider',
      });
      return created;
    });

    return res.status(201).json({ success: true, enquiryId: enquiry.id, message: 'Sent. The training provider will contact you.' });
  } catch (error) {
    logger.error('course_enquiry_failed', { error: getErrorMessage(error) });
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** "Build skills for this job": up to 3 courses that teach what the job asks for. */
export const coursesForJob = async (req: Request, res: Response) => {
  try {
    const id = singleValue(req.params.jobId) || '';
    const job = await prisma.job.findFirst({ where: { id, ...publicJobWhere() }, select: { title: true, category: true, description: true } });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const wanted = jobSkills(job);
    const courses = coursesForSkills(await loadPublicCourses(), wanted, 3);
    const named = [...new Set(courses.flatMap((course) => course.skills.filter((skill) => wanted.includes(skill))))].map(skillName);

    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ success: true, skills: named, courses });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getProviderPage = async (req: Request, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const user = await prisma.user.findFirst({
      where: { id, role: 'EMPLOYER', status: 'ACTIVE', employerProfile: { is: { providerStatus: 'APPROVED' } } },
      select: {
        id: true,
        employerProfile: { select: { companyName: true, logoUrl: true, website: true, description: true } },
        verificationRequests: approvedBusinessVerificationQuery,
      },
    });
    if (!user || !user.employerProfile) return res.status(404).json({ success: false, message: 'Provider not found' });

    const courses = (await loadPublicCourses()).filter((course) => course.provider.id === id);
    return res.json({
      success: true,
      provider: {
        id: user.id,
        name: user.employerProfile.companyName,
        logoUrl: user.employerProfile.logoUrl,
        website: user.employerProfile.website,
        description: user.employerProfile.description,
        isVerified: isVerifiedEmployer(user.verificationRequests),
      },
      courses,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** The category or skill page as data, for the web app. */
export const getCourseLanding = async (req: Request, res: Response) => {
  try {
    const kind = singleValue(req.params.kind) === 'skill' ? 'skill' : 'category';
    const page = buildCourseLanding(kind, singleValue(req.params.slug) || '', await loadPublicCourses());
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ success: true, page });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
