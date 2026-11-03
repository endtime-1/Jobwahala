import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';

const publicProfileFields = {
  companyName: true,
  industry: true,
  logoUrl: true,
  website: true,
  description: true,
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
            verificationRequests: {
              where: { status: 'APPROVED', type: 'BUSINESS' },
              take: 1,
              select: { id: true },
            },
            jobsPosted: {
              where: { status: 'ACTIVE' },
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

    return res.json({
      success: true,
      company: {
        id: employer.id,
        ...employer.employerProfile,
        website: safeWebsite(employer.employerProfile.website),
        isVerified: employer.verificationRequests.length > 0,
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
        jobsPosted: { some: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        employerProfile: { select: { companyName: true, industry: true, logoUrl: true } },
        verificationRequests: { where: { status: 'APPROVED', type: 'BUSINESS' }, take: 1, select: { id: true } },
        _count: { select: { jobsPosted: { where: { status: 'ACTIVE' } } } },
        jobsPosted: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
      take: 60,
    });

    const companies = employers
      .filter((employer) => employer.employerProfile)
      .map((employer) => ({
        id: employer.id,
        ...employer.employerProfile!,
        isVerified: employer.verificationRequests.length > 0,
        openRoles: employer._count.jobsPosted,
        latestJobAt: employer.jobsPosted[0]?.createdAt ?? null,
      }))
      .sort((a, b) => new Date(b.latestJobAt || 0).getTime() - new Date(a.latestJobAt || 0).getTime())
      .slice(0, 12);

    return res.json({ success: true, companies });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
