import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';

/** The admin audit log, newest first. Filter by target (type and id), by admin, or page back with ?before=<ISO date>. */
export const getAdminAuditLog = async (req: AuthRequest, res: Response) => {
  try {
    const targetType = singleValue(req.query.targetType as string | string[] | undefined);
    const targetId = singleValue(req.query.targetId as string | string[] | undefined);
    const adminId = singleValue(req.query.adminId as string | string[] | undefined);
    const before = singleValue(req.query.before as string | string[] | undefined);
    const requested = Number(singleValue(req.query.limit as string | string[] | undefined));
    const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 100) : 50;

    const beforeDate = before ? new Date(before) : null;
    if (beforeDate && Number.isNaN(beforeDate.getTime())) {
      return res.status(400).json({ success: false, message: 'before must be a date' });
    }

    const entries = await prisma.adminActionLog.findMany({
      where: {
        ...(targetType ? { targetType } : {}),
        ...(targetId ? { targetId } : {}),
        ...(adminId ? { adminId } : {}),
        ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json({ success: true, entries });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
