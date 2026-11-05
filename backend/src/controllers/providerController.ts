import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { resetCourseCatalogCache } from '../services/courseCatalog';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';
import { createNotification } from '../utils/notifications';
import { courseSlug, isFeaturedNow, parseStartDates } from '../utils/courses';

const MAX_COURSES = 100;
const DAY = 86_400_000;

type CourseBody = {
  title: string;
  summary: string;
  description: string;
  category: string;
  level: string;
  isFree: boolean;
  priceGhs?: number | null;
  durationWeeks?: number | null;
  format: string;
  location?: string | null;
  startDates?: string[];
  rollingStart?: boolean;
  certificateOffered?: boolean;
  enrolUrl?: string | null;
  enquiryEnabled?: boolean;
  skills: string[];
};

/** The columns saved for a course body. A free course has no price; an online one has no required place. */
const courseData = (body: CourseBody) => ({
  title: body.title,
  summary: body.summary,
  description: body.description,
  category: body.category,
  level: body.level,
  isFree: body.isFree,
  priceGhs: body.isFree ? null : body.priceGhs ?? null,
  durationWeeks: body.durationWeeks ?? null,
  format: body.format,
  location: body.location ?? null,
  startDatesJson: JSON.stringify([...new Set(body.startDates ?? [])].sort()),
  rollingStart: body.rollingStart ?? false,
  certificateOffered: body.certificateOffered ?? false,
  enrolUrl: body.enrolUrl ?? null,
  enquiryEnabled: body.enquiryEnabled ?? true,
});

/** Changing what a learner is promised puts the listing back in front of the admin. */
const MATERIAL_FIELDS = ['title', 'summary', 'description', 'isFree', 'priceGhs', 'enrolUrl', 'category'] as const;

const requireProvider = async (req: AuthRequest, res: Response) => {
  const profile = await prisma.employerProfile.findUnique({
    where: { userId: req.user!.id },
    select: { isTrainingProvider: true, providerStatus: true, companyName: true },
  });
  if (!profile?.isTrainingProvider) {
    res.status(403).json({ success: false, message: 'Turn on "We are a training provider" first.' });
    return null;
  }
  return profile;
};

export const getProviderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.employerProfile.findUnique({
      where: { userId: req.user!.id },
      select: { isTrainingProvider: true, providerStatus: true, providerReviewNote: true, companyName: true },
    });
    return res.json({
      success: true,
      provider: {
        isTrainingProvider: Boolean(profile?.isTrainingProvider),
        status: profile?.providerStatus ?? 'NONE',
        reviewNote: profile?.providerReviewNote ?? null,
        companyName: profile?.companyName ?? null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** A company says it also runs courses. The admin approves it before any of its courses can be public. */
export const enableProvider = async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.employerProfile.findUnique({ where: { userId: req.user!.id }, select: { providerStatus: true } });
    if (!profile) return res.status(400).json({ success: false, message: 'Finish setting up your company first.' });

    // A company already approved stays approved; one that was turned down or never asked goes to review.
    const providerStatus = profile.providerStatus === 'APPROVED' ? 'APPROVED' : 'PENDING';
    const updated = await prisma.employerProfile.update({
      where: { userId: req.user!.id },
      data: { isTrainingProvider: true, providerStatus },
      select: { isTrainingProvider: true, providerStatus: true },
    });
    return res.json({ success: true, provider: { isTrainingProvider: updated.isTrainingProvider, status: updated.providerStatus } });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

type Totals = Record<string, { views: number; clicks: number; enquiries: number }>;

const statsFor = async (courseIds: string[], since?: Date) => {
  type Row = { courseId: string; type: string; _count: { _all: number } };
  const groupBy = prisma.courseEvent.groupBy as unknown as (args: object) => Promise<Row[]>;
  const rows = await groupBy.call(prisma.courseEvent, {
    by: ['courseId', 'type'],
    where: { courseId: { in: courseIds }, ...(since ? { createdAt: { gte: since } } : {}) },
    _count: { _all: true },
  });

  const totals: Totals = {};
  for (const id of courseIds) totals[id] = { views: 0, clicks: 0, enquiries: 0 };
  for (const row of rows) {
    const entry = totals[row.courseId];
    if (!entry) continue;
    if (row.type === 'VIEW') entry.views = row._count._all;
    else if (row.type === 'CLICK') entry.clicks = row._count._all;
    else if (row.type === 'ENQUIRY') entry.enquiries = row._count._all;
  }
  return totals;
};

/** The provider's own courses, with views, clicks and enquiries (all time and the last 30 days). */
export const listMyCourses = async (req: AuthRequest, res: Response) => {
  try {
    const courses = await prisma.course.findMany({
      where: { providerId: req.user!.id, status: { not: 'REMOVED' }, reviewStatus: { not: 'REMOVED' } },
      include: { skills: { select: { skill: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const ids = courses.map((course) => course.id);
    const [allTime, lastMonth] = ids.length ? await Promise.all([statsFor(ids), statsFor(ids, new Date(Date.now() - 30 * DAY))]) : [{}, {}];

    return res.json({
      success: true,
      courses: courses.map((course) => ({
        id: course.id,
        slug: course.slug,
        title: course.title,
        summary: course.summary,
        description: course.description,
        category: course.category,
        level: course.level,
        isFree: course.isFree,
        priceGhs: course.priceGhs,
        durationWeeks: course.durationWeeks,
        format: course.format,
        location: course.location,
        startDates: parseStartDates(course.startDatesJson),
        rollingStart: course.rollingStart,
        certificateOffered: course.certificateOffered,
        enrolUrl: course.enrolUrl,
        enquiryEnabled: course.enquiryEnabled,
        skills: course.skills.map((entry) => entry.skill),
        status: course.status,
        reviewStatus: course.reviewStatus,
        reviewNote: course.reviewNote,
        featured: isFeaturedNow(course),
        featuredUntil: course.featuredUntil,
        stats: { allTime: allTime[course.id], last30Days: lastMonth[course.id] },
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const createCourse = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireProvider(req, res))) return;

    const count = await prisma.course.count({ where: { providerId: req.user!.id, status: { not: 'REMOVED' } } });
    if (count >= MAX_COURSES) return res.status(400).json({ success: false, message: `You can list up to ${MAX_COURSES} courses.` });

    const body = req.body as CourseBody;
    const course = await prisma.course.create({
      data: {
        providerId: req.user!.id,
        slug: courseSlug(body.title),
        ...courseData(body),
        skills: { create: body.skills.map((skill) => ({ skill })) },
      },
      select: { id: true, slug: true, reviewStatus: true },
    });
    resetCourseCatalogCache();
    return res.status(201).json({ success: true, course });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

const loadOwned = async (req: AuthRequest, res: Response) => {
  const id = singleValue(req.params.id) || '';
  const course = await prisma.course.findUnique({ where: { id }, include: { skills: { select: { skill: true } } } });
  if (!course || course.providerId !== req.user!.id || course.status === 'REMOVED') {
    res.status(404).json({ success: false, message: 'Course not found' });
    return null;
  }
  return course;
};

export const updateCourse = async (req: AuthRequest, res: Response) => {
  try {
    const course = await loadOwned(req, res);
    if (!course) return;
    if (course.reviewStatus === 'REMOVED') {
      return res.status(409).json({ success: false, message: 'JobWahala removed this listing. Contact support if you think that was a mistake.' });
    }

    const body = req.body as CourseBody;
    const data = courseData(body);
    const material = MATERIAL_FIELDS.some((field) => (data as Record<string, unknown>)[field] !== (course as Record<string, unknown>)[field]);
    const skillsChanged = [...body.skills].sort().join() !== course.skills.map((entry) => entry.skill).sort().join();

    await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: course.id },
        data: { ...data, ...(material && course.reviewStatus === 'APPROVED' ? { reviewStatus: 'PENDING', reviewNote: null } : {}) },
      });
      if (skillsChanged) {
        await tx.courseSkill.deleteMany({ where: { courseId: course.id } });
        await tx.courseSkill.createMany({ data: body.skills.map((skill) => ({ courseId: course.id, skill })) });
      }
    });
    resetCourseCatalogCache();
    return res.json({ success: true, backInReview: material && course.reviewStatus === 'APPROVED' });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

const setStatus = (status: 'ACTIVE' | 'PAUSED' | 'REMOVED') => async (req: AuthRequest, res: Response) => {
  try {
    const course = await loadOwned(req, res);
    if (!course) return;
    await prisma.course.update({ where: { id: course.id }, data: { status } });
    resetCourseCatalogCache();
    return res.json({ success: true, status });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const pauseCourse = setStatus('PAUSED');
export const resumeCourse = setStatus('ACTIVE');
export const removeCourse = setStatus('REMOVED');

/** Questions from learners about the provider's courses, newest first. */
export const listEnquiries = async (req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.courseEnquiry.findMany({
      where: { course: { providerId: req.user!.id } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, name: true, email: true, phone: true, message: true, status: true, createdAt: true, course: { select: { id: true, title: true } } },
    });
    return res.json({ success: true, enquiries: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const markEnquiryRead = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const result = await prisma.courseEnquiry.updateMany({ where: { id, course: { providerId: req.user!.id } }, data: { status: 'READ' } });
    if (result.count === 0) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Learners who say they completed one of this provider's courses and ask it to confirm. */
export const listCompletionRequests = async (req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.learnerCourse.findMany({
      where: { course: { providerId: req.user!.id }, status: { in: ['REQUESTED', 'CONFIRMED', 'DECLINED'] } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        completedOn: true,
        certificateUrl: true,
        status: true,
        user: { select: { jobSeekerProfile: { select: { firstName: true, lastName: true } } } },
      },
    });
    return res.json({
      success: true,
      requests: rows.map((row) => ({
        id: row.id,
        courseTitle: row.title,
        completedOn: row.completedOn,
        certificateUrl: row.certificateUrl,
        status: row.status,
        learnerName: [row.user.jobSeekerProfile?.firstName, row.user.jobSeekerProfile?.lastName].filter(Boolean).join(' ') || 'A learner',
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Confirm (or decline) that a learner completed this provider's course. Only the course's own provider can. */
export const decideCompletion = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const { decision, note } = req.body as { decision: 'CONFIRM' | 'DECLINE'; note?: string };

    const record = await prisma.learnerCourse.findUnique({ where: { id }, include: { course: { select: { providerId: true, title: true } } } });
    if (!record || !record.course || record.course.providerId !== req.user!.id) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (record.status !== 'REQUESTED') {
      return res.status(409).json({ success: false, message: 'This one has already been answered.' });
    }

    const confirmed = decision === 'CONFIRM';
    await prisma.$transaction(async (tx) => {
      await tx.learnerCourse.update({
        where: { id },
        data: confirmed
          ? { status: 'CONFIRMED', confirmedAt: new Date(), confirmedById: req.user!.id, decisionNote: null }
          : { status: 'DECLINED', decisionNote: note?.trim() || null },
      });
      await createNotification(tx, {
        userId: record.userId,
        type: 'COURSE_COMPLETION',
        title: confirmed ? 'Your certificate is verified' : 'Your course completion was not confirmed',
        message: confirmed
          ? `${record.course!.title} now shows a "Verified certificate" badge to employers.`
          : `The provider could not confirm you completed ${record.course!.title}.${note?.trim() ? ` ${note.trim()}` : ''}`,
        actionUrl: '/dashboard',
      });
    });
    return res.json({ success: true, status: confirmed ? 'CONFIRMED' : 'DECLINED' });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
