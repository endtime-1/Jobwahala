import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';
import { createNotification } from '../utils/notifications';

const MAX_LEARNER_COURSES = 30;

/** Courses a job seeker says they completed. */
export const listLearnerCourses = async (req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.learnerCourse.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ completedOn: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, courseId: true, title: true, providerName: true, completedOn: true, certificateUrl: true, status: true, decisionNote: true, course: { select: { slug: true } } },
    });
    return res.json({
      success: true,
      courses: rows.map(({ course, ...row }) => ({ ...row, courseSlug: course?.slug ?? null })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Add a course from the catalogue, or one done elsewhere (written in by hand, which no provider can confirm). */
export const addLearnerCourse = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, title, providerName, completedOn, certificateUrl } = req.body as {
      courseId?: string;
      title?: string;
      providerName?: string | null;
      completedOn?: string;
      certificateUrl?: string | null;
    };

    if (completedOn && new Date(`${completedOn}T00:00:00Z`).getTime() > Date.now() + 86_400_000) {
      return res.status(400).json({ success: false, message: 'The completion date cannot be in the future.' });
    }

    const count = await prisma.learnerCourse.count({ where: { userId: req.user!.id } });
    if (count >= MAX_LEARNER_COURSES) return res.status(400).json({ success: false, message: `You can add up to ${MAX_LEARNER_COURSES} courses.` });

    let name = title ?? '';
    let provider = providerName ?? null;
    if (courseId) {
      const course = await prisma.course.findFirst({
        where: { id: courseId, status: { not: 'REMOVED' }, reviewStatus: 'APPROVED' },
        select: { id: true, title: true, provider: { select: { employerProfile: { select: { companyName: true } } } } },
      });
      if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
      name = course.title;
      provider = course.provider.employerProfile?.companyName ?? null;

      if (await prisma.learnerCourse.findFirst({ where: { userId: req.user!.id, courseId }, select: { id: true } })) {
        return res.status(409).json({ success: false, message: 'You have already added this course.' });
      }
    }

    const created = await prisma.learnerCourse.create({
      data: {
        userId: req.user!.id,
        courseId: courseId ?? null,
        title: name,
        providerName: provider,
        completedOn: completedOn ? new Date(`${completedOn}T00:00:00Z`) : null,
        certificateUrl: certificateUrl ?? null,
      },
      select: { id: true, status: true },
    });
    return res.status(201).json({ success: true, course: created });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const removeLearnerCourse = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const result = await prisma.learnerCourse.deleteMany({ where: { id, userId: req.user!.id } });
    if (result.count === 0) return res.status(404).json({ success: false, message: 'Course not found' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Ask the course's provider to confirm the learner completed it. */
export const requestConfirmation = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const record = await prisma.learnerCourse.findUnique({ where: { id }, include: { course: { select: { providerId: true, title: true } } } });
    if (!record || record.userId !== req.user!.id) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!record.course) return res.status(400).json({ success: false, message: 'Only courses from our catalogue can be confirmed by their provider.' });
    if (!record.completedOn) return res.status(400).json({ success: false, message: 'Add the date you completed it first.' });
    if (record.status === 'REQUESTED' || record.status === 'CONFIRMED') {
      return res.status(409).json({ success: false, message: record.status === 'CONFIRMED' ? 'This is already confirmed.' : 'You have already asked the provider.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.learnerCourse.update({ where: { id }, data: { status: 'REQUESTED', decisionNote: null } });
      await createNotification(tx, {
        userId: record.course!.providerId,
        type: 'COURSE_COMPLETION',
        title: 'A learner asks you to confirm they completed a course',
        message: `Someone says they completed ${record.course!.title}. Open your provider dashboard to confirm.`,
        actionUrl: '/provider',
      });
    });
    return res.json({ success: true, status: 'REQUESTED' });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
