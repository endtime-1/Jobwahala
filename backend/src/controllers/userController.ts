import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { generateSeekerProfileOptimization } from '../services/ai';
import { scoreApplicantForJob, scoreJobForSeeker } from '../utils/matching';
import { getRequiredVerificationType, serializeVerificationStatus } from '../utils/verification';

type DashboardAgreementUser = {
  id: string;
  email: string;
  employerProfile?: {
    companyName?: string | null;
  } | null;
  jobSeekerProfile?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  freelancerProfile?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
} | null;

const getDashboardUserName = (user: DashboardAgreementUser) => {
  if (!user) return 'Unknown';

  const firstName =
    user.jobSeekerProfile?.firstName || user.freelancerProfile?.firstName || '';
  const lastName =
    user.jobSeekerProfile?.lastName || user.freelancerProfile?.lastName || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return user.employerProfile?.companyName || fullName || user.email;
};

const getAgreementParticipantWhere = (userId: string) => ({
  OR: [
    { employerId: userId },
    { seekerId: userId },
    { freelancerId: userId },
    { clientId: userId }
  ]
});

const getWorkspaceSignalCounts = async (userId: string) => {
  const agreementParticipantWhere = getAgreementParticipantWhere(userId);

  const [
    unreadMessages,
    rawPaymentMilestones,
    rawProposalActions,
    pendingReviewActions,
    pendingDisputeActions,
  ] = await Promise.all([
    prisma.message.count({
      where: {
        read: false,
        senderId: { not: userId },
        conversation: {
          OR: [{ user1Id: userId }, { user2Id: userId }]
        }
      }
    }),
    prisma.agreementMilestone.findMany({
      where: {
        amount: { not: null },
        agreement: {
          status: 'ACTIVE',
          ...agreementParticipantWhere
        },
        OR: [
          {
            status: 'COMPLETED',
            paymentStatus: 'PENDING'
          },
          {
            paymentStatus: 'REQUESTED'
          }
        ]
      },
      select: {
        status: true,
        paymentStatus: true,
        agreement: {
          select: {
            type: true,
            employerId: true,
            seekerId: true,
            freelancerId: true,
            clientId: true
          }
        }
      }
    }),
    prisma.proposal.findMany({
      where: {
        status: { in: ['PENDING', 'COUNTERED'] },
        OR: [{ creatorId: userId }, { recipientId: userId }]
      },
      select: {
        revisions: {
          select: {
            authorId: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    }),
    prisma.agreement.count({
      where: {
        status: 'COMPLETED',
        ...agreementParticipantWhere,
        reviews: {
          none: {
            reviewerId: userId
          }
        }
      }
    }),
    prisma.agreementDispute.count({
      where: {
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
        agreement: agreementParticipantWhere,
      }
    }),
  ]);

  const pendingPaymentActions = rawPaymentMilestones.reduce((count, milestone) => {
    const agreement = milestone.agreement;
    const payerId = agreement.type === 'JOB' ? agreement.employerId : agreement.clientId;
    const payeeId = agreement.type === 'JOB' ? agreement.seekerId : agreement.freelancerId;

    if (
      milestone.status === 'COMPLETED' &&
      milestone.paymentStatus === 'PENDING' &&
      payeeId === userId
    ) {
      return count + 1;
    }

    if (milestone.paymentStatus === 'REQUESTED' && payerId === userId) {
      return count + 1;
    }

    return count;
  }, 0);

  const pendingProposalActions = rawProposalActions.reduce((count, proposal) => {
    const latestRevision = proposal.revisions[0];

    if (!latestRevision || latestRevision.authorId === userId) {
      return count;
    }

    return count + 1;
  }, 0);

  return {
    unreadMessages,
    pendingProposalActions,
    pendingReviewActions,
    pendingDisputeActions,
    pendingPaymentActions,
    pendingAgreementActions:
      pendingPaymentActions + pendingReviewActions + pendingDisputeActions,
  };
};

const getDashboardWorkflowSummaryData = async (userId: string, limit = 4) => {
  const agreementParticipantWhere = getAgreementParticipantWhere(userId);

  const [
    activeAgreementCount,
    rawUpcomingMilestones,
    rawPaymentMilestones,
    rawProposalActions,
    rawReviewActions,
    rawDisputeActions,
  ] = await Promise.all([
    prisma.agreement.count({
      where: {
        status: 'ACTIVE',
        ...agreementParticipantWhere
      }
    }),
    prisma.agreementMilestone.findMany({
      where: {
        status: { not: 'COMPLETED' },
        agreement: {
          status: 'ACTIVE',
          ...agreementParticipantWhere
        }
      },
      include: {
        agreement: {
          select: {
            id: true,
            title: true,
            type: true,
            updatedAt: true
          }
        }
      },
      take: Math.max(limit * 2, 8)
    }),
    prisma.agreementMilestone.findMany({
      where: {
        amount: { not: null },
        agreement: {
          status: 'ACTIVE',
          ...agreementParticipantWhere
        },
        OR: [
          {
            status: 'COMPLETED',
            paymentStatus: 'PENDING'
          },
          {
            paymentStatus: 'REQUESTED'
          }
        ]
      },
      include: {
        agreement: {
          select: {
            id: true,
            title: true,
            type: true,
            updatedAt: true,
            employerId: true,
            seekerId: true,
            freelancerId: true,
            clientId: true,
            employer: {
              select: {
                id: true,
                email: true,
                employerProfile: true
              }
            },
            seeker: {
              select: {
                id: true,
                email: true,
                jobSeekerProfile: true
              }
            },
            freelancer: {
              select: {
                id: true,
                email: true,
                freelancerProfile: true
              }
            },
            client: {
              select: {
                id: true,
                email: true,
                employerProfile: true,
                jobSeekerProfile: true
              }
            }
          }
        }
      }
    }),
    prisma.proposal.findMany({
      where: {
        status: { in: ['PENDING', 'COUNTERED'] },
        OR: [{ creatorId: userId }, { recipientId: userId }]
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            employerProfile: true,
            jobSeekerProfile: true,
            freelancerProfile: true
          }
        },
        recipient: {
          select: {
            id: true,
            email: true,
            employerProfile: true,
            jobSeekerProfile: true,
            freelancerProfile: true
          }
        },
        revisions: {
          select: {
            authorId: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        application: {
          select: {
            id: true,
            status: true,
            agreement: {
              select: {
                id: true,
                status: true
              }
            },
            job: {
              select: {
                id: true,
                title: true
              }
            }
          }
        },
        serviceRequest: {
          select: {
            id: true,
            status: true,
            agreement: {
              select: {
                id: true,
                status: true
              }
            },
            service: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    }),
    prisma.agreement.findMany({
      where: {
        status: 'COMPLETED',
        ...agreementParticipantWhere,
        reviews: {
          none: {
            reviewerId: userId
          }
        }
      },
      include: {
        employer: {
          select: {
            id: true,
            email: true,
            employerProfile: true
          }
        },
        seeker: {
          select: {
            id: true,
            email: true,
            jobSeekerProfile: true
          }
        },
        freelancer: {
          select: {
            id: true,
            email: true,
            freelancerProfile: true
          }
        },
        client: {
          select: {
            id: true,
            email: true,
            employerProfile: true,
            jobSeekerProfile: true
          }
        },
        application: {
          select: {
            id: true,
            job: {
              select: {
                id: true,
                title: true
              }
            }
          }
        },
        serviceRequest: {
          select: {
            id: true,
            service: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.max(limit + 2, 6)
    }),
    prisma.agreementDispute.findMany({
      where: {
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
        agreement: agreementParticipantWhere,
      },
      include: {
        agreement: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            updatedAt: true,
          }
        },
        creator: {
          select: {
            id: true,
            email: true,
            employerProfile: true,
            jobSeekerProfile: true,
            freelancerProfile: true,
          }
        },
        counterparty: {
          select: {
            id: true,
            email: true,
            employerProfile: true,
            jobSeekerProfile: true,
            freelancerProfile: true,
          }
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.max(limit + 2, 6),
    }),
  ]);

  const upcomingMilestones = rawUpcomingMilestones
    .sort((left, right) => {
      const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;

      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }

      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    })
    .slice(0, limit);

  const paymentActionItems = rawPaymentMilestones
    .flatMap((milestone) => {
      const agreement = milestone.agreement;
      const payerId = agreement.type === 'JOB' ? agreement.employerId : agreement.clientId;
      const payeeId = agreement.type === 'JOB' ? agreement.seekerId : agreement.freelancerId;
      const payer = agreement.type === 'JOB' ? agreement.employer : agreement.client;
      const payee = agreement.type === 'JOB' ? agreement.seeker : agreement.freelancer;

      if (
        milestone.status === 'COMPLETED' &&
        milestone.paymentStatus === 'PENDING' &&
        payeeId === userId
      ) {
        return [
          {
            id: milestone.id,
            title: milestone.title,
            amount: milestone.amount,
            dueDate: milestone.dueDate,
            status: milestone.status,
            paymentStatus: milestone.paymentStatus,
            paymentRequestedAt: milestone.paymentRequestedAt,
            paidAt: milestone.paidAt,
            action: 'REQUEST_PAYMENT',
            counterpartyName: getDashboardUserName(payer),
            agreement: {
              id: agreement.id,
              title: agreement.title,
              type: agreement.type,
              updatedAt: agreement.updatedAt
            }
          }
        ];
      }

      if (milestone.paymentStatus === 'REQUESTED' && payerId === userId) {
        return [
          {
            id: milestone.id,
            title: milestone.title,
            amount: milestone.amount,
            dueDate: milestone.dueDate,
            status: milestone.status,
            paymentStatus: milestone.paymentStatus,
            paymentRequestedAt: milestone.paymentRequestedAt,
            paidAt: milestone.paidAt,
            action: 'MARK_PAID',
            counterpartyName: getDashboardUserName(payee),
            agreement: {
              id: agreement.id,
              title: agreement.title,
              type: agreement.type,
              updatedAt: agreement.updatedAt
            }
          }
        ];
      }

      return [];
    })
    .sort((left, right) => {
      const leftPriority = left.action === 'MARK_PAID' ? 0 : 1;
      const rightPriority = right.action === 'MARK_PAID' ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftTime = left.paymentRequestedAt
        ? new Date(left.paymentRequestedAt).getTime()
        : left.dueDate
          ? new Date(left.dueDate).getTime()
          : new Date(left.agreement.updatedAt).getTime();
      const rightTime = right.paymentRequestedAt
        ? new Date(right.paymentRequestedAt).getTime()
        : right.dueDate
          ? new Date(right.dueDate).getTime()
          : new Date(right.agreement.updatedAt).getTime();

      return leftTime - rightTime;
    });

  const proposalActionItems = rawProposalActions
    .flatMap((proposal) => {
      const latestRevision = proposal.revisions[0];

      if (!latestRevision || latestRevision.authorId === userId) {
        return [];
      }

      const counterparty = proposal.creatorId === userId ? proposal.recipient : proposal.creator;
      const source = proposal.application
        ? {
            kind: 'APPLICATION',
            id: proposal.application.id,
            title: proposal.application.job.title,
            status: proposal.application.status,
            agreement: proposal.application.agreement
          }
        : proposal.serviceRequest
          ? {
              kind: 'SERVICE_REQUEST',
              id: proposal.serviceRequest.id,
              title: proposal.serviceRequest.service.title,
              status: proposal.serviceRequest.status,
              agreement: proposal.serviceRequest.agreement
            }
          : null;

      return [
        {
          id: proposal.id,
          type: proposal.type,
          status: proposal.status,
          title: proposal.title,
          amount: proposal.amount,
          timeline: proposal.timeline,
          expiresAt: proposal.expiresAt,
          updatedAt: proposal.updatedAt,
          counterpartyName: getDashboardUserName(counterparty),
          source,
        }
      ];
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  const disputeActionItems = rawDisputeActions
    .map((dispute) => {
      const openedByCurrentUser = dispute.creatorId === userId;
      const otherParticipant = openedByCurrentUser ? dispute.counterparty : dispute.creator;

      return {
        id: dispute.id,
        title: dispute.title,
        type: dispute.type,
        status: dispute.status,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
        openedByCurrentUser,
        counterpartyName: getDashboardUserName(otherParticipant),
        agreement: {
          id: dispute.agreement.id,
          title: dispute.agreement.title,
          type: dispute.agreement.type,
          status: dispute.agreement.status,
          updatedAt: dispute.agreement.updatedAt,
        },
      };
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  const reviewActionItems = rawReviewActions.flatMap((agreement) => {
    const counterparty =
      [agreement.employer, agreement.seeker, agreement.freelancer, agreement.client]
        .filter(Boolean)
        .find((participant) => participant!.id !== userId) || null;

    if (!counterparty) {
      return [];
    }

    return [
      {
        id: agreement.id,
        title: agreement.title,
        type: agreement.type,
        updatedAt: agreement.updatedAt,
        counterpartyName: getDashboardUserName(counterparty),
        source: agreement.application
          ? {
              kind: 'APPLICATION',
              id: agreement.application.id,
              title: agreement.application.job.title,
            }
          : agreement.serviceRequest
            ? {
                kind: 'SERVICE_REQUEST',
                id: agreement.serviceRequest.id,
                title: agreement.serviceRequest.service.title,
              }
            : null,
      }
    ];
  });

  return {
    activeAgreementCount,
    upcomingMilestones,
    pendingDisputeActions: disputeActionItems.length,
    disputeActionItems: disputeActionItems.slice(0, limit),
    pendingProposalActions: proposalActionItems.length,
    proposalActionItems: proposalActionItems.slice(0, limit),
    pendingReviewActions: reviewActionItems.length,
    reviewActionItems: reviewActionItems.slice(0, limit),
    pendingPaymentActions: paymentActionItems.length,
    paymentActionItems: paymentActionItems.slice(0, limit),
  };
};

const getDashboardOverviewData = async (userId: string, role: string) => {
  if (role === 'SEEKER') {
    const [applications, rawRecommendedJobs, cvCount, seekerProfile] = await Promise.all([
      prisma.application.findMany({
        where: { seekerId: userId },
        include: {
          agreement: {
            select: { id: true, status: true, updatedAt: true }
          },
          job: {
            select: {
              id: true,
              title: true,
              location: true,
              salary: true,
              createdAt: true,
              employer: {
                select: {
                  email: true,
                  employerProfile: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.job.findMany({
        where: {
          status: 'ACTIVE',
          NOT: {
            applications: {
              some: { seekerId: userId }
            }
          }
        },
        include: {
          employer: {
            select: {
              email: true,
              employerProfile: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 8
      }),
      prisma.cVGeneration.count({
        where: { userId }
      }),
      prisma.jobSeekerProfile.findUnique({
        where: { userId },
        select: {
          skills: true,
          experience: true
        }
      }),
    ]);

    const recommendedJobs = rawRecommendedJobs
      .map((job) => ({
        ...job,
        ...scoreJobForSeeker(seekerProfile, job)
      }))
      .sort((left, right) => {
        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .slice(0, 4);

    return {
      applications,
      recommendedJobs,
      cvCount,
    };
  }

  if (role === 'EMPLOYER') {
    const [jobs, rawRecentApplications] = await Promise.all([
      prisma.job.findMany({
        where: { employerId: userId },
        include: {
          postedByAdmin: {
            select: {
              id: true,
              email: true,
            }
          },
          _count: {
            select: { applications: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 6
      }),
      prisma.application.findMany({
        where: {
          job: {
            employerId: userId
          }
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              description: true,
              category: true,
              type: true,
              location: true
            }
          },
          seeker: {
            select: {
              email: true,
              jobSeekerProfile: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 8
      })
    ]);

    const recentApplications = rawRecentApplications
      .map((application) => ({
        ...application,
        ...scoreApplicantForJob(
          application.job,
          application.seeker.jobSeekerProfile,
          application
        )
      }))
      .sort((left, right) => {
        if (right.fitScore !== left.fitScore) {
          return right.fitScore - left.fitScore;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .slice(0, 6);

    return {
      jobs,
      recentApplications,
    };
  }

  if (role === 'FREELANCER') {
    const [services, successPayments, pendingPayments] = await Promise.all([
      prisma.freelanceService.findMany({
        where: { freelancerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 6
      }),
      prisma.payment.findMany({
        where: { payeeId: userId, payoutStatus: 'SUCCESS' },
        select: { payoutAmount: true }
      }),
      prisma.payment.findMany({
        where: { payeeId: userId, payoutStatus: 'PENDING', status: 'SUCCEEDED' },
        select: { amount: true }
      })
    ]);

    const totalEarnings = (successPayments as any[]).reduce((acc: number, p: any) => acc + parseFloat(p.payoutAmount || '0'), 0);
    const pendingEscrow = (pendingPayments as any[]).reduce((acc: number, p: any) => acc + parseFloat(p.amount || '0'), 0);

    return {
      services,
      earnings: {
        total: totalEarnings.toFixed(2),
        pending: pendingEscrow.toFixed(2),
        currency: 'GHS'
      }
    };
  }

  return {};
};

const getFreelancerRecentMessages = async (userId: string) => {
  const recentConversations = await prisma.conversation.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }]
    },
    include: {
      user1: { select: { id: true, email: true } },
      user2: { select: { id: true, email: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });

  return recentConversations.map((conversation) => {
    const participant = conversation.user1Id === userId ? conversation.user2 : conversation.user1;
    return {
      id: conversation.id,
      participant,
      lastMessage: conversation.messages[0] || null
    };
  });
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      include: {
        jobSeekerProfile: true,
        employerProfile: true,
        freelancerProfile: true,
        verificationRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const latestVerificationRequest = user.verificationRequests[0] || null;
    const { verificationRequests, ...profile } = user;

    res.json({
      success: true,
      profile: {
        ...profile,
        ...serializeVerificationStatus(latestVerificationRequest, verificationRequests),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!;
    const userId = req.user!.id;
    const updateData = { ...req.body };

    const normalizeNullableField = (field: string) => {
      if (updateData[field] === '') {
        updateData[field] = null;
      }
    };

    normalizeNullableField('resumeFileUrl');
    normalizeNullableField('logoUrl');
    normalizeNullableField('website');
    normalizeNullableField('portfolioUrl');

    let updatedProfile;

    if (role === 'SEEKER') {
      updatedProfile = await prisma.jobSeekerProfile.update({
        where: { userId },
        data: updateData
      });
    } else if (role === 'EMPLOYER') {
      updatedProfile = await prisma.employerProfile.update({
        where: { userId },
        data: updateData
      });
    } else if (role === 'FREELANCER') {
      updatedProfile = await prisma.freelancerProfile.update({
        where: { userId },
        data: updateData
      });
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported role for profile updates' });
    }

    res.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true }
    });
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWorkspaceSignals = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const signals = await getWorkspaceSignalCounts(userId);

    return res.json({
      success: true,
      ...signals,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardWorkflowSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const workflowSummary = await getDashboardWorkflowSummaryData(userId);

    return res.json({
      success: true,
      ...workflowSummary,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardOverview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const overview = await getDashboardOverviewData(userId, role);

    return res.json({
      success: true,
      role,
      ...overview,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProfileOptimization = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    if (role !== 'SEEKER') {
      return res.status(403).json({
        success: false,
        message: 'Profile optimization is only available for seeker accounts',
      });
    }

    const [seekerProfile, latestCv, cvCount, rawRecommendedJobs] = await Promise.all([
      prisma.jobSeekerProfile.findUnique({
        where: { userId },
        select: {
          firstName: true,
          lastName: true,
          skills: true,
          experience: true,
          resumeFileUrl: true,
        }
      }),
      prisma.cVGeneration.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          prompt: true,
          createdAt: true,
        }
      }),
      prisma.cVGeneration.count({
        where: { userId }
      }),
      prisma.job.findMany({
        where: {
          status: 'ACTIVE',
          NOT: {
            applications: {
              some: { seekerId: userId }
            }
          }
        },
        include: {
          employer: {
            select: {
              email: true,
              employerProfile: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 8
      }),
    ]);

    const recommendedJobs = rawRecommendedJobs
      .map((job) => ({
        ...job,
        ...scoreJobForSeeker(seekerProfile, job)
      }))
      .sort((left, right) => {
        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .slice(0, 4);

    const optimization = await generateSeekerProfileOptimization({
      firstName: seekerProfile?.firstName,
      lastName: seekerProfile?.lastName,
      skills: seekerProfile?.skills,
      experience: seekerProfile?.experience,
      resumeFileUrl: seekerProfile?.resumeFileUrl,
      cvCount,
      latestCvPrompt: latestCv?.prompt,
      recommendedJobs: recommendedJobs.map((job) => ({
        title: job.title,
        matchScore: job.matchScore,
        matchReasons: job.matchReasons,
      })),
    });

    return res.json({
      success: true,
      optimization,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardData = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const requiredVerificationType = getRequiredVerificationType(role);

    const unreadMessages = await prisma.message.count({
      where: {
        read: false,
        senderId: { not: userId },
        conversation: {
          OR: [{ user1Id: userId }, { user2Id: userId }]
        }
      }
    });

    const [workflowSummary, verificationRequests, roleOverview, recentMessages] = await Promise.all([
      getDashboardWorkflowSummaryData(userId),
      requiredVerificationType
        ? prisma.verificationRequest.findMany({
            where: { userId, type: requiredVerificationType },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : Promise.resolve([]),
      getDashboardOverviewData(userId, role),
      role === 'FREELANCER'
        ? getFreelancerRecentMessages(userId)
        : Promise.resolve(null),
    ]);

    const latestVerificationRequest = verificationRequests[0] || null;
    const verification = {
      requiredType: requiredVerificationType,
      ...serializeVerificationStatus(latestVerificationRequest, verificationRequests),
    };
    return res.json({
      success: true,
      role,
      unreadMessages,
      verification,
      ...workflowSummary,
      ...roleOverview,
      ...(role === 'FREELANCER' && recentMessages ? { recentMessages } : {})
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
