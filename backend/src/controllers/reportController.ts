import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';

export const createReport = async (req: AuthRequest, res: Response) => {
  try {
    const { type, targetId, reason, details } = req.body as {
      type: 'job' | 'service' | 'user';
      targetId: string;
      reason: string;
      details?: string;
    };

    const normalizedReason = details?.trim()
      ? `${reason.trim()}\n\n${details.trim()}`
      : reason.trim();

    if (type === 'job') {
      const job = await prisma.job.findUnique({ where: { id: targetId } });
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      const report = await prisma.report.create({
        data: {
          reporterId: req.user!.id,
          jobId: targetId,
          reason: normalizedReason,
        },
      });

      return res.status(201).json({ success: true, report });
    }

    if (type === 'user') {
      if (targetId === req.user!.id) {
        return res.status(400).json({ success: false, message: 'You cannot report your own account' });
      }

      const user = await prisma.user.findUnique({ where: { id: targetId } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const report = await prisma.report.create({
        data: {
          reporterId: req.user!.id,
          reportedUserId: targetId,
          reason: normalizedReason,
        },
      });

      return res.status(201).json({ success: true, report });
    }

    const service = await prisma.freelanceService.findUnique({ where: { id: targetId } });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.user!.id,
        serviceId: targetId,
        reason: normalizedReason,
      },
    });

    return res.status(201).json({ success: true, report });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
