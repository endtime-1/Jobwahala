import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { resetCourseCatalogCache } from '../services/courseCatalog';
import { recordAdminAction } from '../utils/adminAudit';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';
import { createNotification } from '../utils/notifications';
import { isFeaturedNow } from '../utils/courses';

const MIN_REASON = 5;
const DAY = 86_400_000;

const adminOf = async (req: AuthRequest) => {
  const admin = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true } });
  return { id: req.user!.id, email: admin?.email ?? 'unknown' };
};

/** What the admin needs to review: providers and listings waiting, and recent listings to look over. */
export const getCourseQueue = async (_req: AuthRequest, res: Response) => {
  try {
    const [providers, pendingCourses, recent] = await Promise.all([
      prisma.employerProfile.findMany({
        where: { isTrainingProvider: true, providerStatus: 'PENDING' },
        select: { userId: true, companyName: true, description: true, website: true, user: { select: { email: true, verificationRequests: { where: { status: 'APPROVED', type: 'BUSINESS' }, take: 1, select: { id: true } } } } },
        take: 100,
      }),
      prisma.course.findMany({
        where: { reviewStatus: 'PENDING', status: { not: 'REMOVED' } },
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: { skills: { select: { skill: true } }, provider: { select: { id: true, employerProfile: { select: { companyName: true, providerStatus: true } } } } },
      }),
      prisma.course.findMany({
        where: { reviewStatus: { in: ['APPROVED', 'REJECTED', 'REMOVED'] } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: { skills: { select: { skill: true } }, provider: { select: { id: true, employerProfile: { select: { companyName: true, providerStatus: true } } } } },
      }),
    ]);

    const shape = (course: (typeof pendingCourses)[number]) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      description: course.description,
      category: course.category,
      isFree: course.isFree,
      priceGhs: course.priceGhs,
      enrolUrl: course.enrolUrl,
      skills: course.skills.map((entry) => entry.skill),
      status: course.status,
      reviewStatus: course.reviewStatus,
      reviewNote: course.reviewNote,
      featured: isFeaturedNow(course),
      featuredUntil: course.featuredUntil,
      providerId: course.provider.id,
      providerName: course.provider.employerProfile?.companyName ?? 'Unknown',
      providerStatus: course.provider.employerProfile?.providerStatus ?? 'NONE',
    });

    return res.json({
      success: true,
      providers: providers.map((provider) => ({
        userId: provider.userId,
        companyName: provider.companyName,
        description: provider.description,
        website: provider.website,
        email: provider.user.email,
        isVerified: provider.user.verificationRequests.length > 0,
      })),
      pending: pendingCourses.map(shape),
      recent: recent.map(shape),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Approve or reject a company as a training provider. A rejection needs a reason, which the provider is shown. */
export const reviewProvider = async (req: AuthRequest, res: Response) => {
  try {
    const userId = singleValue(req.params.userId) || '';
    const { decision, reason } = req.body as { decision: 'APPROVE' | 'REJECT'; reason?: string };

    if (decision === 'REJECT' && (reason ?? '').trim().length < MIN_REASON) {
      return res.status(400).json({ success: false, message: 'Say why, in a few words. The provider will see it.' });
    }

    const profile = await prisma.employerProfile.findUnique({ where: { userId }, select: { isTrainingProvider: true, companyName: true } });
    if (!profile?.isTrainingProvider) return res.status(404).json({ success: false, message: 'Provider not found' });

    const approved = decision === 'APPROVE';
    const admin = await adminOf(req);
    await prisma.$transaction(async (tx) => {
      await tx.employerProfile.update({
        where: { userId },
        data: { providerStatus: approved ? 'APPROVED' : 'REJECTED', providerReviewNote: approved ? null : reason!.trim(), providerReviewedAt: new Date() },
      });
      await recordAdminAction(tx, {
        admin,
        action: approved ? 'COURSE_PROVIDER_APPROVED' : 'COURSE_PROVIDER_REJECTED',
        targetType: 'EmployerProfile',
        targetId: userId,
        reason,
        metadata: { companyName: profile.companyName },
      });
      await createNotification(tx, {
        userId,
        type: 'COURSE_REVIEW',
        title: approved ? 'You are approved as a training provider' : 'Your training provider request was not approved',
        message: approved ? 'Your approved courses can now be seen by learners.' : reason!.trim(),
        actionUrl: '/provider',
      });
    });
    resetCourseCatalogCache();
    return res.json({ success: true, status: approved ? 'APPROVED' : 'REJECTED' });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Approve a listing, reject it, or remove a misleading one. Rejecting and removing need a reason the provider sees. */
export const reviewCourse = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const { decision, reason } = req.body as { decision: 'APPROVE' | 'REJECT' | 'REMOVE'; reason?: string };

    if (decision !== 'APPROVE' && (reason ?? '').trim().length < MIN_REASON) {
      return res.status(400).json({ success: false, message: 'Say why, in a few words. The provider will see it.' });
    }

    const course = await prisma.course.findUnique({ where: { id }, select: { id: true, title: true, providerId: true, reviewStatus: true } });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const reviewStatus = decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'REMOVED';
    const admin = await adminOf(req);

    await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id },
        data: {
          reviewStatus,
          reviewNote: decision === 'APPROVE' ? null : reason!.trim(),
          reviewedAt: new Date(),
          // A removed listing stops being featured too.
          ...(decision === 'REMOVE' ? { featuredFrom: null, featuredUntil: null } : {}),
        },
      });
      await recordAdminAction(tx, {
        admin,
        action: `COURSE_${reviewStatus}`,
        targetType: 'Course',
        targetId: id,
        reason,
        metadata: { title: course.title, providerId: course.providerId, previous: course.reviewStatus },
      });
      await createNotification(tx, {
        userId: course.providerId,
        type: 'COURSE_REVIEW',
        title:
          decision === 'APPROVE' ? `${course.title} is now live` : decision === 'REJECT' ? `${course.title} was not approved` : `${course.title} was removed`,
        message: decision === 'APPROVE' ? 'Learners can now find it on JobWahala.' : reason!.trim(),
        actionUrl: '/provider',
      });
    });
    resetCourseCatalogCache();
    return res.json({ success: true, reviewStatus });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Mark a listing as featured for a number of days from today, or stop featuring it (0 days). */
export const setFeatured = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const { days } = req.body as { days: number };

    const course = await prisma.course.findUnique({ where: { id }, select: { id: true, title: true, providerId: true } });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const now = new Date();
    const featuredFrom = days > 0 ? now : null;
    const featuredUntil = days > 0 ? new Date(now.getTime() + days * DAY) : null;
    const admin = await adminOf(req);

    await prisma.$transaction(async (tx) => {
      await tx.course.update({ where: { id }, data: { featuredFrom, featuredUntil } });
      await recordAdminAction(tx, {
        admin,
        action: days > 0 ? 'COURSE_FEATURED' : 'COURSE_UNFEATURED',
        targetType: 'Course',
        targetId: id,
        metadata: { title: course.title, providerId: course.providerId, days, until: featuredUntil?.toISOString() ?? null },
      });
    });
    resetCourseCatalogCache();
    return res.json({ success: true, featuredFrom, featuredUntil });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
