import crypto from 'crypto';
import { Response } from 'express';
import env from '../config/env';
import logger from '../config/logger';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { BillingError } from '../services/billingErrors';
import { getEntitlements, reconcileTeam } from '../services/planService';
import { sendTeamInviteEmail } from '../services/emailService';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';
import { PLAN_NEEDED_MESSAGE } from '../utils/plans';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const respond = (res: Response, error: unknown) => {
  if (error instanceof BillingError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  return res.status(500).json({ success: false, message: getErrorMessage(error) });
};

/** Seats in use: the owner, plus members who have joined or been invited. Suspended members do not take a seat. */
const seatsUsed = async (ownerId: string) => 1 + (await prisma.teamMember.count({ where: { ownerId, status: { in: ['ACTIVE', 'INVITED'] } } }));

export const getTeam = async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const [entitlements, members, used] = await Promise.all([
      getEntitlements(ownerId),
      prisma.teamMember.findMany({ where: { ownerId }, orderBy: { invitedAt: 'asc' }, select: { id: true, email: true, status: true, invitedAt: true, joinedAt: true } }),
      seatsUsed(ownerId),
    ]);
    return res.json({ success: true, limit: entitlements.teamLimit, used, planName: entitlements.planName, members });
  } catch (error) {
    return respond(res, error);
  }
};

/** Invite someone by email. The plan's seat limit is checked here, on the server. */
export const inviteMember = async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const email = (req.body as { email: string }).email.trim().toLowerCase();

    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { email: true, employerProfile: { select: { companyName: true } } } });
    if (owner?.email?.toLowerCase() === email) throw new BillingError(400, 'THAT_IS_YOU', 'That is your own email: you already have the first seat.');

    const existing = await prisma.teamMember.findFirst({ where: { ownerId, email } });
    if (existing && existing.status === 'ACTIVE') throw new BillingError(409, 'ALREADY_MEMBER', 'That person is already on your team.');

    const entitlements = await getEntitlements(ownerId);
    // Re-inviting someone who already holds a seat (an invitation not yet accepted) does not need a new one.
    const needsSeat = !existing || existing.status === 'SUSPENDED';
    if (needsSeat && (await seatsUsed(ownerId)) >= entitlements.teamLimit) {
      throw new BillingError(403, 'PLAN_REQUIRED', PLAN_NEEDED_MESSAGE.teamMembers);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const member = existing
      ? await prisma.teamMember.update({ where: { id: existing.id }, data: { inviteTokenHash: hashToken(token), status: 'INVITED', userId: null, joinedAt: null, invitedAt: new Date() } })
      : await prisma.teamMember.create({ data: { ownerId, email, inviteTokenHash: hashToken(token) } });

    void sendTeamInviteEmail(email, { company: owner?.employerProfile?.companyName || 'a company', url: `${env.frontendBaseUrl}/join-team?token=${token}` }).catch((error) =>
      logger.error('team_invite_email_failed', { error: getErrorMessage(error) }),
    );

    return res.status(201).json({ success: true, member: { id: member.id, email: member.email, status: member.status } });
  } catch (error) {
    return respond(res, error);
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.teamMember.deleteMany({ where: { id: singleValue(req.params.id) || '', ownerId: req.user!.id } });
    if (result.count === 0) return res.status(404).json({ success: false, message: 'Team member not found' });
    // A freed seat can bring back someone who was paused when the plan got smaller.
    await reconcileTeam(req.user!.id);
    return res.json({ success: true });
  } catch (error) {
    return respond(res, error);
  }
};

/** Accept an invitation. Only the person it was sent to can; and the account must be a fresh employer account with no jobs of its own. */
export const acceptInvite = async (req: AuthRequest, res: Response) => {
  try {
    const token = (req.body as { token: string }).token;
    const invite = await prisma.teamMember.findUnique({ where: { inviteTokenHash: hashToken(token) }, include: { owner: { select: { status: true, employerProfile: { select: { companyName: true } } } } } });
    if (!invite || invite.status !== 'INVITED' || invite.owner.status !== 'ACTIVE') {
      throw new BillingError(404, 'INVITE_NOT_FOUND', 'This invitation is no longer valid. Ask for a new one.');
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true, emailVerified: true } });
    if (!user?.email || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new BillingError(403, 'WRONG_ACCOUNT', 'This invitation was sent to a different email address. Sign in with that one.');
    }
    if (invite.ownerId === req.user!.id) throw new BillingError(400, 'THAT_IS_YOU', 'You own this company already.');

    if (await prisma.teamMember.findFirst({ where: { userId: req.user!.id, status: 'ACTIVE' } })) {
      throw new BillingError(409, 'ALREADY_MEMBER', 'You are already on a company team.');
    }
    if ((await prisma.job.count({ where: { employerId: req.user!.id } })) > 0) {
      throw new BillingError(409, 'HAS_OWN_JOBS', 'This account already has its own jobs. Use a different email address for the team.');
    }

    const entitlements = await getEntitlements(invite.ownerId);
    const active = await prisma.teamMember.count({ where: { ownerId: invite.ownerId, status: 'ACTIVE' } });
    if (1 + active >= entitlements.teamLimit) throw new BillingError(409, 'TEAM_FULL', 'This team has no free seat right now. Ask the owner to upgrade the plan.');

    await prisma.teamMember.update({ where: { id: invite.id }, data: { status: 'ACTIVE', userId: req.user!.id, joinedAt: new Date() } });
    return res.json({ success: true, company: invite.owner.employerProfile?.companyName ?? 'the company' });
  } catch (error) {
    return respond(res, error);
  }
};

/** For a team member: which company they are working for. */
export const getMembership = async (req: AuthRequest, res: Response) => {
  try {
    const membership = await prisma.teamMember.findFirst({
      where: { userId: req.user!.id, status: { in: ['ACTIVE', 'SUSPENDED'] } },
      select: { status: true, owner: { select: { employerProfile: { select: { companyName: true } } } } },
    });
    return res.json({ success: true, membership: membership ? { status: membership.status, company: membership.owner.employerProfile?.companyName ?? 'your company' } : null });
  } catch (error) {
    return respond(res, error);
  }
};
