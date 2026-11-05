import prisma from '../config/prisma';
import env from '../config/env';
import { fileWasUploadedBy, UploadRef } from '../utils/fileAccess';

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
      const [sentToThisEmployer, ownCurrent] = await Promise.all([
        prisma.application.findFirst({
          where: { cvFileUrl: { endsWith: tail }, job: { employerId: viewer.id } },
          select: { id: true },
        }),
        prisma.seekerCv.findFirst({
          where: { userId: viewer.id, OR: [{ uploadedUrl: { endsWith: tail } }, { builderUrl: { endsWith: tail } }] },
          select: { id: true },
        }),
      ]);
      return Boolean(sentToThisEmployer || ownCurrent);
    }

    default:
      return false;
  }
};
