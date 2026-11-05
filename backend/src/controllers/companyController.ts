import { Request, Response } from 'express';
import { approvedBusinessVerificationQuery, isVerifiedEmployer } from '../utils/verification';
import { publicJobWhere } from '../utils/jobLifecycle';
import prisma from '../config/prisma';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';
import { getEntitlements } from '../services/planService';
import { isLive } from '../utils/plans';

const publicProfileFields = {
  companyName: true,
  industry: true,
  logoUrl: true,
  website: true,
  description: true,
  coverImageUrl: true,
  galleryJson: true,
  whyWorkWithUs: true,
} as const;

const safeWebsite = (website?: string | null) => (website && /^https?:\/\//i.test(website) ? website : null);

export const getCompany = async (req: Request, res: Response) => {
  try {
    const id = singleValue(req.params.id);

    const employer = id
      ? await prisma.user.findFirst({
          where: { id, role: 'EMPLOYER', status: 'ACTIVE', employerProfile: { isNot: null } },
          select: {
            id: true,
            createdAt: true,
            employerProfile: { select: publicProfileFields },
            verificationRequests: approvedBusinessVerificationQuery,
            jobsPosted: {
              where: publicJobWhere(),
              orderBy: { createdAt: 'desc' },
              take: 50,
              select: {
                id: true,
                title: true,
                location: true,
                type: true,
                salary: true,
                category: true,
                createdAt: true,
              },
            },
          },
        })
      : null;

    if (!employer || !employer.employerProfile) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // The branded page (cover, gallery, "Why work with us") shows while the company's plan includes it. If the plan ends it is
    // hidden, not deleted.
    const { galleryJson, coverImageUrl, whyWorkWithUs, ...profile } = employer.employerProfile;
    const branded = (await getEntitlements(employer.id)).brandedPage;
    let gallery: string[] = [];
    try {
      const parsed = JSON.parse(galleryJson || '[]');
      gallery = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      gallery = [];
    }

    return res.json({
      success: true,
      company: {
        id: employer.id,
        ...profile,
        ...(branded ? { coverImageUrl, gallery, whyWorkWithUs } : {}),
        isBranded: branded,
        website: safeWebsite(employer.employerProfile.website),
        isVerified: isVerifiedEmployer(employer.verificationRequests),
        memberSince: employer.createdAt,
        jobs: employer.jobsPosted,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Companies that currently have open roles, newest hiring first: the "who's hiring" strip. */
export const listHiringCompanies = async (_req: Request, res: Response) => {
  try {
    const employers = await prisma.user.findMany({
      where: {
        role: 'EMPLOYER',
        status: 'ACTIVE',
        employerProfile: { isNot: null },
        jobsPosted: { some: publicJobWhere() },
      },
      select: {
        id: true,
        employerProfile: { select: { companyName: true, industry: true, logoUrl: true } },
        verificationRequests: approvedBusinessVerificationQuery,
        _count: { select: { jobsPosted: { where: publicJobWhere() } } },
        jobsPosted: { where: publicJobWhere(), orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
          select: { status: true, currentPeriodEnd: true, graceEndsAt: true, cancelAtPeriodEnd: true, product: { select: { topEmployers: true } } },
        },
      },
      take: 60,
    });

    const now = new Date();
    const companies = employers
      .filter((employer) => employer.employerProfile)
      .map((employer) => ({
        id: employer.id,
        ...employer.employerProfile!,
        isVerified: isVerifiedEmployer(employer.verificationRequests),
        openRoles: employer._count.jobsPosted,
        latestJobAt: employer.jobsPosted[0]?.createdAt ?? null,
        // Business plans get priority here, but only among companies with the same verification status.
        hasPriority: employer.subscriptions.some((subscription) => subscription.product.topEmployers && isLive(subscription, now)),
      }))
      .sort(
        (a, b) =>
          Number(b.isVerified) - Number(a.isVerified) ||
          Number(b.hasPriority) - Number(a.hasPriority) ||
          new Date(b.latestJobAt || 0).getTime() - new Date(a.latestJobAt || 0).getTime(),
      )
      .slice(0, 12)
      .map(({ hasPriority: _hasPriority, ...company }) => company);

    return res.json({ success: true, companies });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
