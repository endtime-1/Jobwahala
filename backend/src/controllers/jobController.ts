import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { singleValue } from '../utils/request';
import { createAgreementEvent } from '../utils/agreementEvents';
import { generateEmployerApplicantComparisonSummary, generateEmployerApplicantDecisionBrief, generateEmployerShortlistSummary, generateJobApplicationCoaching, generateJobPostOptimization, generateSeekerJobComparisonSummary } from '../services/ai';
import { scoreApplicantForJob, scoreJobForSeeker } from '../utils/matching';
import { serializeVerificationStatus } from '../utils/verification';

const mapRankedApplications = <
  T extends {
    createdAt: Date;
    coverLetter?: string | null;
    seeker: {
      jobSeekerProfile?: {
        skills?: string | null;
        experience?: string | null;
      } | null;
    };
  }
>(
  applications: T[],
  job: {
    title?: string | null;
    description?: string | null;
    category?: string | null;
    type?: string | null;
    location?: string | null;
  },
) =>
  applications
    .map((application) => ({
      ...application,
      ...scoreApplicantForJob(job, application.seeker.jobSeekerProfile, application)
    }))
    .sort((left, right) => {
      if (right.fitScore !== left.fitScore) {
        return right.fitScore - left.fitScore;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

export const createJob = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, location, type, salary, category } = req.body;
    if (!title?.trim() || !description?.trim() || !type?.trim()) {
      return res.status(400).json({ success: false, message: 'Title, description, and type are required' });
    }

    const job = await prisma.job.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        location: location?.trim() || null,
        type: type.trim(),
        salary: salary?.trim() || null,
        category: category?.trim() || null,
        employerId: req.user!.id
      }
    });
    res.status(201).json({ success: true, job });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateJobDraft = async (req: AuthRequest, res: Response) => {
  try {
    const employerProfile = await prisma.employerProfile.findUnique({
      where: { userId: req.user!.id },
      select: {
        companyName: true,
        industry: true,
        website: true,
        description: true,
      }
    });

    const draft = await generateJobPostOptimization({
      companyName: employerProfile?.companyName,
      industry: employerProfile?.industry,
      website: employerProfile?.website,
      companyDescription: employerProfile?.description,
      title: req.body?.title,
      description: req.body?.description,
      location: req.body?.location,
      type: req.body?.type,
      salary: req.body?.salary,
      category: req.body?.category,
      focus: req.body?.focus,
    });

    return res.json({
      success: true,
      draft,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getJobs = async (req: AuthRequest, res: Response) => {
  try {
    const q = singleValue(req.query.q as string | string[] | undefined)?.trim() || '';
    const category = singleValue(req.query.category as string | string[] | undefined)?.trim() || '';
    const type = singleValue(req.query.type as string | string[] | undefined)?.trim() || '';
    const location = singleValue(req.query.location as string | string[] | undefined)?.trim() || '';

    const where: any = { status: 'ACTIVE' };

    // Full-text search across title + description
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
      ];
    }

    if (category) {
      where.category = { contains: category };
    }

    if (type) {
      where.type = { contains: type };
    }

    if (location) {
      where.location = { contains: location };
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        employer: {
          select: {
            id: true,
            email: true,
            employerProfile: true,
            verificationRequests: {
              where: { type: 'BUSINESS' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      jobs: jobs.map((job) => ({
        ...job,
        employer: {
          id: job.employer.id,
          email: job.employer.email,
          employerProfile: job.employer.employerProfile,
          ...serializeVerificationStatus(job.employer.verificationRequests[0] || null),
        },
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const compareJobsForSeeker = async (req: AuthRequest, res: Response) => {
  try {
    const jobIds = Array.isArray(req.body?.jobIds) ? (req.body.jobIds as string[]) : [];

    if (jobIds.length < 2) {
      return res.status(400).json({ success: false, message: 'Select at least two jobs to compare' });
    }

    const [seekerProfile, jobs] = await Promise.all([
      prisma.jobSeekerProfile.findUnique({
        where: { userId: req.user!.id },
        select: {
          skills: true,
          experience: true,
        }
      }),
      prisma.job.findMany({
        where: {
          id: { in: jobIds },
          status: 'ACTIVE',
        },
        include: {
          employer: {
            select: {
              id: true,
              email: true,
              employerProfile: true,
              verificationRequests: {
                where: { type: 'BUSINESS' },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            }
          }
        }
      }),
    ]);

    const jobMap = new Map(jobs.map((job) => [job.id, job]));

    const rankedJobs = jobIds
      .map((jobId) => {
        const job = jobMap.get(jobId);

        if (!job) {
          return null;
        }

        return {
          ...job,
          ...scoreJobForSeeker(seekerProfile, job),
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const scoreDelta = right!.matchScore - left!.matchScore;
        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        return new Date(right!.createdAt).getTime() - new Date(left!.createdAt).getTime();
      }) as Array<(typeof jobs)[number] & { matchScore: number; matchReasons: string[] }>;

    if (rankedJobs.length < 2) {
      return res.status(400).json({ success: false, message: 'At least two selected jobs must still be active to compare' });
    }

    const summary = await generateSeekerJobComparisonSummary({
      options: rankedJobs.map((job) => ({
        companyName: job.employer.employerProfile?.companyName || job.employer.email,
        jobTitle: job.title,
        matchScore: job.matchScore,
        matchReasons: job.matchReasons,
        location: job.location,
        type: job.type,
        salary: job.salary,
        category: job.category,
      })),
    });

    return res.json({
      success: true,
      comparison: {
        summary,
        comparedCount: rankedJobs.length,
        jobs: rankedJobs.map((job) => ({
          id: job.id,
          title: job.title,
          description: job.description,
          location: job.location,
          salary: job.salary,
          type: job.type,
          category: job.category,
          createdAt: job.createdAt,
          matchScore: job.matchScore,
          matchReasons: job.matchReasons,
          employer: {
            id: job.employer.id,
            email: job.employer.email,
            employerProfile: job.employer.employerProfile,
            ...serializeVerificationStatus(job.employer.verificationRequests[0] || null),
          },
        })),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getJobById = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, status: 'ACTIVE' },
      include: {
        employer: {
          select: {
            id: true,
            email: true,
            employerProfile: true,
            verificationRequests: {
              where: { type: 'BUSINESS' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      }
    });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({
      success: true,
      job: {
        ...job,
        employer: {
          id: job.employer.id,
          email: job.employer.email,
          employerProfile: job.employer.employerProfile,
          ...serializeVerificationStatus(job.employer.verificationRequests[0] || null),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const applyForJob = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    const { coverLetter } = req.body;
    const seekerId = req.user!.id;

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, status: 'ACTIVE' }
    });

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or inactive' });
    }

    const existing = await prisma.application.findUnique({
      where: {
        jobId_seekerId: { jobId, seekerId }
      }
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already applied to this job' });
    }

    const application = await prisma.application.create({
      data: {
        jobId,
        seekerId,
        coverLetter: coverLetter?.trim() || null
      }
    });
    res.status(201).json({ success: true, application });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'You have already applied to this job' });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyJobApplication = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    const seekerId = req.user!.id;

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const application = await prisma.application.findUnique({
      where: {
        jobId_seekerId: { jobId, seekerId }
      },
      include: {
        agreement: {
          select: { id: true, status: true, updatedAt: true }
        }
      }
    });

    return res.json({ success: true, application });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getJobApplicants = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }
    
    // Ensure employer owns it
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        employerId: true,
        title: true,
        description: true,
        category: true,
        type: true,
        location: true
      }
    });
    if (!job || job.employerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const applications = await prisma.application.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      include: {
        agreement: {
          select: { id: true, status: true, updatedAt: true }
        },
        proposals: {
          where: {
            status: { in: ['PENDING', 'COUNTERED'] }
          },
          select: {
            id: true,
            status: true,
            title: true,
            updatedAt: true,
            creatorId: true,
            recipientId: true,
          }
        },
        seeker: {
          select: { id: true, email: true, jobSeekerProfile: true }
        }
      }
    });

    const rankedApplications = mapRankedApplications(applications, job);

    res.json({ success: true, applications: rankedApplications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateJobApplicantDecisionBrief = async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = singleValue(req.params.applicationId);
    const { focus } = req.body as { focus?: string };

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'Application id is required' });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        agreement: {
          select: {
            id: true,
            status: true,
          }
        },
        proposals: {
          where: {
            status: { in: ['PENDING', 'COUNTERED'] }
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            title: true,
            updatedAt: true,
          }
        },
        job: {
          select: {
            id: true,
            employerId: true,
            title: true,
            description: true,
            category: true,
            type: true,
            location: true,
          }
        },
        seeker: {
          select: {
            email: true,
            jobSeekerProfile: true,
          }
        }
      }
    });

    if (!application || application.job.employerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const rankedApplication = {
      ...application,
      ...scoreApplicantForJob(application.job, application.seeker.jobSeekerProfile, application),
    };

    const brief = await generateEmployerApplicantDecisionBrief({
      jobTitle: application.job.title,
      jobDescription: application.job.description,
      jobType: application.job.type,
      category: application.job.category,
      location: application.job.location,
      candidateName:
        [application.seeker.jobSeekerProfile?.firstName, application.seeker.jobSeekerProfile?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() || application.seeker.email,
      applicationStatus: application.status,
      fitScore: rankedApplication.fitScore,
      fitReasons: rankedApplication.fitReasons,
      skills: application.seeker.jobSeekerProfile?.skills || '',
      experience: application.seeker.jobSeekerProfile?.experience || '',
      coverLetter: application.coverLetter,
      hasProposal: Boolean(application.proposals?.[0]),
      proposalStatus: application.proposals?.[0]?.status || null,
      hasAgreement: Boolean(application.agreement),
      agreementStatus: application.agreement?.status || null,
      focus: focus?.trim() || '',
    });

    return res.json({
      success: true,
      brief,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const generateJobShortlistSummary = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    const { focus } = req.body as { focus?: string };

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        employerId: true,
        title: true,
        description: true,
        category: true,
        type: true,
        location: true,
      }
    });

    if (!job || job.employerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const applications = await prisma.application.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      include: {
        seeker: {
          select: {
            email: true,
            jobSeekerProfile: true,
          }
        }
      }
    });

    const rankedApplications = mapRankedApplications(applications, job);
    const summary = await generateEmployerShortlistSummary({
      jobTitle: job.title,
      jobDescription: job.description,
      focus: focus?.trim() || '',
      candidates: rankedApplications.map((application) => ({
        name:
          [application.seeker.jobSeekerProfile?.firstName, application.seeker.jobSeekerProfile?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || application.seeker.email,
        status: application.status,
        fitScore: application.fitScore,
        fitReasons: application.fitReasons,
        skills: application.seeker.jobSeekerProfile?.skills || application.seeker.jobSeekerProfile?.experience || '',
        coverLetter: application.coverLetter,
      })),
    });

    return res.json({
      success: true,
      summary,
      candidatesConsidered: rankedApplications.length,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const generateJobApplicantComparison = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    const { focus } = req.body as { focus?: string };

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        employerId: true,
        title: true,
        description: true,
        category: true,
        type: true,
        location: true,
      }
    });

    if (!job || job.employerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const applications = await prisma.application.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      include: {
        seeker: {
          select: {
            email: true,
            jobSeekerProfile: true,
          }
        }
      }
    });

    const rankedApplications = mapRankedApplications(applications, job);
    const summary = await generateEmployerApplicantComparisonSummary({
      jobTitle: job.title,
      jobDescription: job.description,
      focus: focus?.trim() || '',
      candidates: rankedApplications.slice(0, 4).map((application) => ({
        name:
          [application.seeker.jobSeekerProfile?.firstName, application.seeker.jobSeekerProfile?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || application.seeker.email,
        status: application.status,
        fitScore: application.fitScore,
        fitReasons: application.fitReasons,
        skills: application.seeker.jobSeekerProfile?.skills || application.seeker.jobSeekerProfile?.experience || '',
        coverLetter: application.coverLetter,
      })),
    });

    return res.json({
      success: true,
      summary,
      candidatesConsidered: Math.min(rankedApplications.length, 4),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getJobApplicationCoaching = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    const seekerId = req.user!.id;

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const [job, seekerProfile, application] = await Promise.all([
      prisma.job.findFirst({
        where: { id: jobId, status: 'ACTIVE' },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          category: true,
          location: true,
          salary: true,
        }
      }),
      prisma.jobSeekerProfile.findUnique({
        where: { userId: seekerId },
        select: {
          firstName: true,
          lastName: true,
          skills: true,
          experience: true,
          resumeFileUrl: true,
        }
      }),
      prisma.application.findUnique({
        where: {
          jobId_seekerId: { jobId, seekerId }
        },
        select: {
          coverLetter: true
        }
      }),
    ]);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const fit = scoreJobForSeeker(seekerProfile, job);
    const coaching = await generateJobApplicationCoaching({
      firstName: seekerProfile?.firstName,
      lastName: seekerProfile?.lastName,
      jobTitle: job.title,
      jobDescription: job.description,
      jobType: job.type,
      category: job.category,
      location: job.location,
      salary: job.salary,
      skills: seekerProfile?.skills,
      experience: seekerProfile?.experience,
      existingCoverLetter: application?.coverLetter,
      matchScore: fit.matchScore,
      matchReasons: fit.matchReasons,
    });

    return res.json({
      success: true,
      coaching,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateApplicationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = singleValue(req.params.applicationId);
    const { status } = req.body as { status: string };

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'Application id is required' });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: { employerId: true, title: true, salary: true }
        }
      }
    });

    if (!application || application.job.employerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const existingAgreement = await prisma.agreement.findUnique({
      where: { applicationId }
    });

    const activeProposalStatuses = ['PENDING', 'COUNTERED'];

    if (existingAgreement && existingAgreement.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'This application is already attached to a closed agreement and cannot be changed'
      });
    }

    const updatedApplication = await prisma.$transaction(async (tx) => {
      const nextApplication = await tx.application.update({
        where: { id: applicationId },
        data: { status }
      });

      await tx.proposal.updateMany({
        where: {
          applicationId,
          status: { in: activeProposalStatuses }
        },
        data: { status: 'CANCELLED' }
      });

      if (status === 'HIRED') {
        if (existingAgreement) {
          const reactivatedAgreement = await tx.agreement.update({
            where: { id: existingAgreement.id },
            data: {
              status: 'ACTIVE',
              title: application.job.title,
              amount: application.job.salary || existingAgreement.amount,
            }
          });

          if (existingAgreement.status !== 'ACTIVE') {
            await createAgreementEvent(tx, {
              agreementId: reactivatedAgreement.id,
              actorId: req.user!.id,
              eventType: 'STATUS_CHANGED',
              message: 'Agreement reactivated after the candidate was moved back to HIRED.',
              fromStatus: existingAgreement.status,
              toStatus: 'ACTIVE'
            });
          }
        } else {
          const createdAgreement = await tx.agreement.create({
            data: {
              type: 'JOB',
              title: application.job.title,
              summary: application.coverLetter?.trim() || `Job agreement for ${application.job.title}`,
              amount: application.job.salary || null,
              applicationId,
              employerId: application.job.employerId,
              seekerId: application.seekerId,
            }
          });

          await createAgreementEvent(tx, {
            agreementId: createdAgreement.id,
            actorId: req.user!.id,
            eventType: 'CREATED',
            message: 'Agreement created after the candidate was hired.',
            toStatus: createdAgreement.status
          });
        }
      } else if (existingAgreement && existingAgreement.status === 'ACTIVE') {
        const cancelledAgreement = await tx.agreement.update({
          where: { id: existingAgreement.id },
          data: { status: 'CANCELLED' }
        });

        await createAgreementEvent(tx, {
          agreementId: cancelledAgreement.id,
          actorId: req.user!.id,
          eventType: 'STATUS_CHANGED',
          message: 'Agreement cancelled because the application moved out of HIRED.',
          fromStatus: existingAgreement.status,
          toStatus: 'CANCELLED'
        });
      }

      return nextApplication;
    });

    return res.json({ success: true, application: updatedApplication });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteApplication = async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = singleValue(req.params.applicationId);

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'Application id is required' });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId }
    });

    if (!application || application.seekerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { applicationId }
    });

    if (application.status === 'HIRED' || application.status === 'COMPLETED' || application.status === 'CANCELLED' || agreement) {
      return res.status(400).json({ success: false, message: 'This application is already attached to a work agreement' });
    }

    await prisma.application.delete({
      where: { id: applicationId }
    });

    return res.json({ success: true, message: 'Application withdrawn successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOwnedJobStatus = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    const { status } = req.body as { status: string };

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job || job.employerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status }
    });

    return res.json({ success: true, job: updatedJob });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
