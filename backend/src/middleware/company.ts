import { NextFunction, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from './auth';

/**
 * Lets a team member work as the company they belong to. For an employer account that is an ACTIVE member of someone's team, the
 * request carries on as the company owner (so jobs, applicants and reports are the company's), and the member's own id is kept as
 * req.actorId. Owners, and everyone else, pass through untouched.
 *
 * It is added to the routes a team is meant to share (jobs, applicants, dashboards, reports) and nowhere else: billing, the plan,
 * the team itself, account settings and account deletion always act as the signed-in person.
 */
export const actAsCompany = async (req: AuthRequest & { actorId?: string }, _res: Response, next: NextFunction) => {
  try {
    if (req.user?.role === 'EMPLOYER') {
      const membership = await prisma.teamMember.findFirst({
        where: { userId: req.user.id, status: 'ACTIVE', owner: { status: 'ACTIVE' } },
        select: { ownerId: true },
      });
      if (membership) {
        req.actorId = req.user.id;
        req.user = { id: membership.ownerId, role: 'EMPLOYER' };
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};
