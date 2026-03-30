import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { singleValue } from '../utils/request';
import { createAgreementEvent } from '../utils/agreementEvents';
import { createNotifications } from '../utils/notifications';
import { emitAgreementRefresh } from '../utils/workflowRealtime';

// Moderation Lookups
export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        reporter: { select: { email: true } },
        job: { select: { id: true, title: true, status: true } },
        service: { select: { id: true, title: true, status: true } },
        reportedUser: { select: { id: true, email: true, role: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, reports });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        employerProfile: {
          select: {
            companyName: true,
          },
        },
      }
    });
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAdminJob = async (req: AuthRequest, res: Response) => {
  try {
    const { employerId, title, description, location, type, salary, category } = req.body as {
      employerId: string;
      title: string;
      description: string;
      location?: string;
      type: string;
      salary?: string;
      category?: string;
    };

    const employer = await prisma.user.findFirst({
      where: {
        id: employerId,
        role: 'EMPLOYER',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        employerProfile: {
          select: {
            companyName: true,
          },
        },
      },
    });

    const companyName = employer?.employerProfile?.companyName;

    if (!employer || !companyName) {
      return res.status(404).json({
        success: false,
        message: 'Select an active employer company to post this job for',
      });
    }

    const job = await prisma.$transaction(async (tx) => {
      const createdJob = await tx.job.create({
        data: {
          employerId: employer.id,
          postedByAdminId: req.user!.id,
          postedByAdminAt: new Date(),
          title,
          description,
          location: location || null,
          type,
          salary: salary || null,
          category: category || null,
        },
        include: {
          employer: {
            select: {
              email: true,
              employerProfile: {
                select: {
                  companyName: true,
                },
              },
            },
          },
          postedByAdmin: {
            select: {
              id: true,
              email: true,
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      });

      await createNotifications(tx, [
        {
          userId: employer.id,
          type: 'ADMIN_JOB_POSTED',
          title: 'Admin posted a job on your behalf',
          message: `A new job, "${createdJob.title}", was posted for ${companyName}.`,
          actionUrl: '/dashboard',
        },
      ]);

      return createdJob;
    });

    return res.status(201).json({
      success: true,
      message: `Job posted on behalf of ${companyName}`,
      job,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllJobs = async (req: AuthRequest, res: Response) => {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        employer: {
          select: {
            email: true,
            employerProfile: { select: { companyName: true } }
          }
        },
        postedByAdmin: {
          select: {
            id: true,
            email: true,
          },
        },
        _count: { select: { applications: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, jobs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllServices = async (req: AuthRequest, res: Response) => {
  try {
    const services = await prisma.freelanceService.findMany({
      include: {
        freelancer: {
          select: {
            email: true,
            freelancerProfile: { select: { firstName: true, lastName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, services });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAgreementDisputes = async (req: AuthRequest, res: Response) => {
  try {
    const disputes = await prisma.agreementDispute.findMany({
      include: {
        agreement: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
          },
        },
        creator: {
          select: {
            id: true,
            email: true,
            role: true,
            employerProfile: true,
            jobSeekerProfile: true,
            freelancerProfile: true,
          },
        },
        counterparty: {
          select: {
            id: true,
            email: true,
            role: true,
            employerProfile: true,
            jobSeekerProfile: true,
            freelancerProfile: true,
          },
        },
        resolver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, disputes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// State Modifiers
export const updateUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body; // e.g., 'ACTIVE', 'FLAGGED', 'SUSPENDED'
    const userId = singleValue(req.params.id);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User id is required' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status }
    });
    res.json({ success: true, message: `User status updated to ${status}`, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUsersStatusBulk = async (req: AuthRequest, res: Response) => {
  try {
    const { userIds, status } = req.body as {
      userIds: string[];
      status: string;
    };

    const updated = await prisma.user.updateMany({
      where: {
        id: { in: userIds },
      },
      data: { status },
    });

    return res.json({
      success: true,
      message: `${updated.count} users updated to ${status}`,
      updatedCount: updated.count,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReportStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const reportId = singleValue(req.params.id);
    if (!reportId) {
      return res.status(400).json({ success: false, message: 'Report id is required' });
    }

    const report = await prisma.report.update({
      where: { id: reportId },
      data: { status }
    });

    res.json({ success: true, message: `Report status updated to ${status}`, report });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReportsStatusBulk = async (req: AuthRequest, res: Response) => {
  try {
    const { reportIds, status } = req.body as {
      reportIds: string[];
      status: string;
    };

    const updated = await prisma.report.updateMany({
      where: {
        id: { in: reportIds },
      },
      data: { status },
    });

    return res.json({
      success: true,
      message: `${updated.count} reports updated to ${status}`,
      updatedCount: updated.count,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateJobStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body; 
    const jobId = singleValue(req.params.id);
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const job = await prisma.job.update({
      where: { id: jobId },
      data: { status }
    });
    res.json({ success: true, message: `Job status updated to ${status}`, job });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateJobsStatusBulk = async (req: AuthRequest, res: Response) => {
  try {
    const { jobIds, status } = req.body as {
      jobIds: string[];
      status: string;
    };

    const updated = await prisma.job.updateMany({
      where: {
        id: { in: jobIds },
      },
      data: { status },
    });

    return res.json({
      success: true,
      message: `${updated.count} jobs updated to ${status}`,
      updatedCount: updated.count,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateServiceStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body; 
    const serviceId = singleValue(req.params.id);
    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'Service id is required' });
    }

    const service = await prisma.freelanceService.update({
      where: { id: serviceId },
      data: { status }
    });
    res.json({ success: true, message: `Service status updated to ${status}`, service });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateServicesStatusBulk = async (req: AuthRequest, res: Response) => {
  try {
    const { serviceIds, status } = req.body as {
      serviceIds: string[];
      status: string;
    };

    const updated = await prisma.freelanceService.updateMany({
      where: {
        id: { in: serviceIds },
      },
      data: { status },
    });

    return res.json({
      success: true,
      message: `${updated.count} services updated to ${status}`,
      updatedCount: updated.count,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAgreementDisputeStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, resolutionNote } = req.body as {
      status: 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
      resolutionNote?: string;
    };
    const disputeId = singleValue(req.params.id);
    const adminUserId = req.user!.id;

    if (!disputeId) {
      return res.status(400).json({ success: false, message: 'Dispute id is required' });
    }

    const dispute = await prisma.agreementDispute.findUnique({
      where: { id: disputeId },
      include: {
        agreement: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    if (dispute.status === status) {
      return res.json({ success: true, dispute });
    }

    if (['RESOLVED', 'DISMISSED'].includes(dispute.status)) {
      return res.status(400).json({ success: false, message: 'This dispute is already closed' });
    }

    if (status === 'UNDER_REVIEW' && dispute.status !== 'OPEN') {
      return res.status(400).json({ success: false, message: 'Only open disputes can move into review' });
    }

    const updatedDispute = await prisma.$transaction(async (tx) => {
      const nextDispute = await tx.agreementDispute.update({
        where: { id: disputeId },
        data: {
          status,
          resolverId: adminUserId,
          resolutionNote:
            status === 'UNDER_REVIEW' ? null : resolutionNote?.trim() || null,
          resolvedAt: status === 'UNDER_REVIEW' ? null : new Date(),
        },
      });

      const notificationType =
        status === 'UNDER_REVIEW'
          ? 'DISPUTE_UNDER_REVIEW'
          : status === 'RESOLVED'
            ? 'DISPUTE_RESOLVED'
            : 'DISPUTE_DISMISSED';
      const notificationTitle =
        status === 'UNDER_REVIEW'
          ? 'Dispute under review'
          : status === 'RESOLVED'
            ? 'Dispute resolved'
            : 'Dispute dismissed';
      const notificationMessage =
        status === 'UNDER_REVIEW'
          ? `Admin started reviewing the dispute "${dispute.title}" on "${dispute.agreement.title}".`
          : status === 'RESOLVED'
            ? `Admin resolved the dispute "${dispute.title}" on "${dispute.agreement.title}".`
            : `Admin dismissed the dispute "${dispute.title}" on "${dispute.agreement.title}".`;

      await createAgreementEvent(tx, {
        agreementId: dispute.agreementId,
        actorId: adminUserId,
        eventType: notificationType,
        message: notificationMessage,
        fromStatus: dispute.status,
        toStatus: status,
      });

      await createNotifications(
        tx,
        [dispute.creatorId, dispute.counterpartyId]
          .filter((participantId): participantId is string => Boolean(participantId))
          .map((participantId) => ({
            userId: participantId,
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
            actionUrl: '/agreements',
          })),
      );

      return nextDispute;
    });

    emitAgreementRefresh(
      [dispute.creatorId, dispute.counterpartyId].filter((participantId): participantId is string => Boolean(participantId)),
      {
        reason: 'dispute_status_changed',
        agreementId: dispute.agreementId,
        disputeId,
        actorId: adminUserId,
      },
    );

    res.json({
      success: true,
      message: `Dispute status updated to ${status}`,
      dispute: updatedDispute,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = singleValue(req.params.id);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User id is required' });
    }

    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true, message: 'User permanently removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
