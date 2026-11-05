import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { getErrorMessage } from '../utils/errors';
import { publicJobWhere } from '../utils/jobLifecycle';
import { singleValue } from '../utils/request';
import { publicEmployerVerification, approvedBusinessVerificationQuery } from '../utils/verification';

export const MAX_SAVED_JOBS = 200;

/** Just the ids, so every job card can show whether it is saved without loading the whole list. */
export const listSavedJobIds = async (req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.savedJob.findMany({
      where: { userId: req.user!.id },
      select: { jobId: true },
      take: MAX_SAVED_JOBS,
    });
    return res.json({ success: true, ids: rows.map((row) => row.jobId) });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** The Saved jobs page. Jobs that have since closed stay in the list, marked as no longer open. */
export const listSavedJobs = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const rows = await prisma.savedJob.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAVED_JOBS,
      select: {
        createdAt: true,
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            type: true,
            salary: true,
            salaryMin: true,
            salaryMax: true,
            status: true,
            closesAt: true,
            employerId: true,
            employer: {
              select: {
                employerProfile: { select: { companyName: true, logoUrl: true } },
                verificationRequests: approvedBusinessVerificationQuery,
              },
            },
          },
        },
      },
    });

    return res.json({
      success: true,
      limit: MAX_SAVED_JOBS,
      savedJobs: rows.map((row) => ({
        savedAt: row.createdAt,
        job: {
          id: row.job.id,
          title: row.job.title,
          location: row.job.location,
          type: row.job.type,
          salary: row.job.salary,
          salaryMin: row.job.salaryMin,
          salaryMax: row.job.salaryMax,
          closesAt: row.job.closesAt,
          isOpen: row.job.status === 'ACTIVE' && row.job.closesAt > now,
        },
        company: {
          id: row.job.employerId,
          name: row.job.employer.employerProfile?.companyName || 'An employer',
          logoUrl: row.job.employer.employerProfile?.logoUrl ?? null,
          ...publicEmployerVerification(row.job.employer.verificationRequests),
        },
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Save a job. Saving one you already saved is fine. Only jobs people can see right now can be saved. */
export const saveJob = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.jobId);
    const userId = req.user!.id;

    const job = await prisma.job.findFirst({ where: { id: jobId, ...publicJobWhere() }, select: { id: true } });
    if (!job) return res.status(404).json({ success: false, message: 'That job is not open any more.' });

    const existing = await prisma.savedJob.findUnique({ where: { userId_jobId: { userId, jobId: job.id } }, select: { id: true } });
    if (existing) return res.json({ success: true, saved: true });

    const count = await prisma.savedJob.count({ where: { userId } });
    if (count >= MAX_SAVED_JOBS) {
      return res.status(409).json({ success: false, message: `You can save up to ${MAX_SAVED_JOBS} jobs. Remove one to save another.` });
    }

    await prisma.savedJob.create({ data: { userId, jobId: job.id } });
    return res.status(201).json({ success: true, saved: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Unsave a job. Unsaving one that is not saved is fine. Only ever touches the signed-in member's own list. */
export const unsaveJob = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.savedJob.deleteMany({ where: { userId: req.user!.id, jobId: singleValue(req.params.jobId) } });
    return res.json({ success: true, saved: false });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
