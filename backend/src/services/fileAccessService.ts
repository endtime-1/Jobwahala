import prisma from '../config/prisma';
import env from '../config/env';
import { fileWasUploadedBy, UploadRef } from '../utils/fileAccess';
import { getEntitlements } from './planService';

type Viewer = { id: string; role: string };

/**
 * Decides whether someone may open one private file.
 *
 * - Admins can open any file (they review verifications and disputes).
 * - The person who uploaded it can open it, so they can preview before attaching it.
 * - Everyone else needs a real connection to the record that references the file: the owner of
 *   the verification request, the people on the agreement a dispute belongs to, or the two
 *   people in the conversation a message belongs to.
 */
export const canViewUpload = async (viewer: Viewer, ref: UploadRef): Promise<boolean> => {
  if (viewer.role === 'ADMIN') return true;
  if (fileWasUploadedBy(ref.fileName, viewer.id, env.jwtSecret)) return true;

  // Stored addresses may be relative or absolute, so match on the stable tail.
  const tail = ref.path;
  const participant = {
    OR: [
      { employerId: viewer.id },
      { seekerId: viewer.id },
      { freelancerId: viewer.id },
      { clientId: viewer.id },
    ],
  };

  switch (ref.category) {
    case 'verification': {
      const request = await prisma.verificationRequest.findFirst({
        where: { userId: viewer.id, documentUrl: { endsWith: tail } },
        select: { id: true },
      });
      return Boolean(request);
    }

    case 'dispute': {
      const [dispute, disputeMessage] = await Promise.all([
        prisma.agreementDispute.findFirst({
          where: { evidenceUrl: { endsWith: tail }, agreement: participant },
          select: { id: true },
        }),
        prisma.disputeMessage.findFirst({
          where: { evidenceUrl: { endsWith: tail }, dispute: { agreement: participant } },
          select: { id: true },
        }),
      ]);
      return Boolean(dispute || disputeMessage);
    }

    case 'message': {
      const message = await prisma.message.findFirst({
        where: {
          attachmentUrl: { endsWith: tail },
          conversation: { OR: [{ user1Id: viewer.id }, { user2Id: viewer.id }] },
        },
        select: { id: true },
      });
      return Boolean(message);
    }

    case 'cv': {
      // An employer may open a CV only if an applicant chose to send it with an application to one of THEIR jobs.
      // The seeker themselves (the uploader) is let in above; this also covers their current saved CVs.
      // A team member opens files as the company they work for.
      const membership = viewer.role === 'EMPLOYER' ? await prisma.teamMember.findFirst({ where: { userId: viewer.id, status: 'ACTIVE' }, select: { ownerId: true } }) : null;
      const companyId = membership?.ownerId ?? viewer.id;

      const [sentToThisEmployer, ownCurrent] = await Promise.all([
        prisma.application.findFirst({
          where: { cvFileUrl: { endsWith: tail }, job: { employerId: companyId } },
          select: { id: true },
        }),
        prisma.seekerCv.findFirst({
          where: { userId: viewer.id, OR: [{ uploadedUrl: { endsWith: tail } }, { builderUrl: { endsWith: tail } }] },
          select: { id: true },
        }),
      ]);
      if (sentToThisEmployer || ownCurrent) return true;

      // The CV database: a CV opens only for a company that UNLOCKED that person, while the person is still visible and has not
      // blocked the company. Searching alone never opens a CV.
      if (viewer.role === 'EMPLOYER') {
        const unlocked = await prisma.seekerCv.findFirst({
          where: {
            OR: [{ uploadedUrl: { endsWith: tail } }, { builderUrl: { endsWith: tail } }],
            user: {
              status: 'ACTIVE',
              jobSeekerProfile: { is: { cvVisibility: 'VERIFIED_EMPLOYERS' } },
              cvUnlocksReceived: { some: { employerId: companyId } },
              cvBlocksMade: { none: { employerId: companyId } },
            },
          },
          select: { id: true },
        });
        if (unlocked) return true;
      }
      return false;
    }

    default:
      return false;
  }
};
