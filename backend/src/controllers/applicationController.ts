import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { getErrorMessage } from '../utils/errors';
import { STAGE_LABEL, lastChangedAt } from '../utils/applicationStatus';

/** Every application the signed-in job seeker has made, newest first. */
export const listMyApplications = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const applications = await prisma.application.findMany({
      where: { seekerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        statusChangedAt: true,
        cvSource: true,
        cvFileName: true,
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            type: true,
            status: true,
            closesAt: true,
            employerId: true,
            employer: { select: { employerProfile: { select: { companyName: true, logoUrl: true } } } },
          },
        },
      },
    });

    return res.json({
      success: true,
      applications: applications.map((application) => ({
        id: application.id,
        status: application.status,
        statusLabel: STAGE_LABEL[application.status] ?? application.status,
        appliedAt: application.createdAt,
        lastChangedAt: lastChangedAt(application),
        // Which CV went with it, by name only: the address is for the employer.
        cv: application.cvSource ? { source: application.cvSource, fileName: application.cvFileName } : null,
        job: {
          id: application.job.id,
          title: application.job.title,
          location: application.job.location,
          type: application.job.type,
          // Applicants keep their record of a job that has since closed; the page just stops linking to it.
          isOpen: application.job.status === 'ACTIVE' && application.job.closesAt > now,
        },
        company: {
          id: application.job.employerId,
          name: application.job.employer.employerProfile?.companyName || 'An employer',
          logoUrl: application.job.employer.employerProfile?.logoUrl ?? null,
        },
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
