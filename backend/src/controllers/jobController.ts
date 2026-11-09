import { Prisma } from '@prisma/client';
import { notifyJobAlerts } from '../services/jobAlertService';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import env from '../config/env';
import { singleValue } from '../utils/request';
import { createAgreementEvent } from '../utils/agreementEvents';
import { generateEmployerApplicantComparisonSummary, generateEmployerApplicantDecisionBrief, generateEmployerShortlistSummary, generateJobApplicationCoaching, generateJobPostOptimization, generateSeekerJobComparisonSummary } from '../services/ai';
import { scoreApplicantForJob, scoreJobForSeeker } from '../utils/matching';
import {
  ClosingDateError,
  canChangeStatus,
  closesAtFromDays,
  isOwnerManaged,
  isPastClosingDate,
  publicJobWhere,
  resolveClosesAt,
  DEFAULT_JOB_DAYS,
  addDays,
} from '../utils/jobLifecycle';
import { approvedBusinessVerificationQuery, publicEmployerVerification, rankJobsByVerification, verifiedEmployerFilter } from '../utils/verification';
import { getErrorMessage } from '../utils/errors';
import { resolvePay } from '../utils/salary';
import { promotionOf } from '../utils/billing';
import { EARLY_CAREER_TYPES, EarlyCareerError, UNPAID_PAY, canonicalEarlyCareerType, earlyCareerData, isEarlyCareerType, parseDay, type EarlyCareerInput } from '../utils/earlyCareer';
import logger from '../config/logger';
import { createNotification } from '../utils/notifications';
import { sendApplicationStatusEmail } from '../services/emailService';
import { rewardReferralForFirstJob } from '../services/acquisitionService';
import { describeStatusChange, isFirstResponse, nextResponseStats, responseHours } from '../utils/applicationStatus';

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
    const { title, description, location, type, salary, category, closesAt: closesAtInput, status: requestedStatus, salaryMin, salaryMax, ...earlyInput } = req.body;
    if (!title?.trim() || !description?.trim() || !type?.trim()) {
      return res.status(400).json({ success: false, message: 'Title, description, and type are required' });
    }

    let closesAt: Date;
    try {
      closesAt = resolveClosesAt(closesAtInput);
    } catch (error) {
      if (error instanceof ClosingDateError) {
        return res.status(400).json({ success: false, message: error.message });
      }
      throw error;
    }

    const status = requestedStatus === 'DRAFT' ? 'DRAFT' : 'ACTIVE';

    // Early-career details; unpaid means no stipend numbers, and says so in the pay text.
    let early;
    try {
      early = earlyCareerData(earlyInput, type.trim());
    } catch (error) {
      if (error instanceof EarlyCareerError) return res.status(400).json({ success: false, message: error.message });
      throw error;
    }
    const unpaid = early.unpaid === true;

    const job = await prisma.job.create({
      data: {
        status,
        closesAt,
        title: title.trim(),
        description: description.trim(),
        location: location?.trim() || null,
        type: canonicalEarlyCareerType(type) ?? type.trim(),
        // Pay: the numbers if they were given, otherwise read from the text, so the job can be found by salary.
        ...(unpaid ? UNPAID_PAY : resolvePay({ salary, salaryMin, salaryMax })),
        ...early,
        salaryParsedAt: new Date(),
        category: category?.trim() || null,
        employerId: req.user!.id
      }
    });
    // Drafts are private; alerts go out when the job is published.
    if (status === 'ACTIVE') {
      void notifyJobAlerts(job);
      // A referred company's first job earns the company that referred it a free featured credit.
      void rewardReferralForFirstJob(req.user!.id);
    }
    res.status(201).json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
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
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getJobs = async (req: AuthRequest, res: Response) => {
  try {
    const q = singleValue(req.query.q as string | string[] | undefined)?.trim() || '';
    const category = singleValue(req.query.category as string | string[] | undefined)?.trim() || '';
    const type = singleValue(req.query.type as string | string[] | undefined)?.trim() || '';
    const location = singleValue(req.query.location as string | string[] | undefined)?.trim() || '';

    const where: any = { ...publicJobWhere() };

    // ?verified=1 shows only jobs from companies with an approved business verification.
    const verifiedOnly = ['1', 'true'].includes((singleValue(req.query.verified as string | string[] | undefined) || '').toLowerCase());
    if (verifiedOnly) {
      where.employer = verifiedEmployerFilter;
    }

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

    // The Internships & NSS section: ?section=early limits it to early-career types, and ?types=a,b picks some of them.
    const sectionEarly = singleValue(req.query.section as string | string[] | undefined) === 'early';
    const typeList = (singleValue(req.query.types as string | string[] | undefined) || '')
      .split(',')
      .map((value) => canonicalEarlyCareerType(value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    if (sectionEarly || typeList.length > 0) {
      where.type = { in: typeList.length > 0 ? typeList : [...EARLY_CAREER_TYPES] };
    } else if (type) {
      where.type = { contains: type };
    }

    if (location) {
      where.location = { contains: location };
    }

    // Salary, in Ghana cedis a month: jobs whose pay range reaches ?salaryMin and/or stays within ?salaryMax.
    // Jobs that never gave numbers cannot be matched, so they drop out while a salary filter is on.
    const wantedMin = Number(singleValue(req.query.salaryMin as string | string[] | undefined));
    const wantedMax = Number(singleValue(req.query.salaryMax as string | string[] | undefined));
    const and: any[] = [];
    if (Number.isFinite(wantedMin) && wantedMin > 0) {
      and.push({ OR: [{ salaryMax: { gte: Math.floor(wantedMin) } }, { salaryMax: null, salaryMin: { gte: Math.floor(wantedMin) } }] });
    }
    if (Number.isFinite(wantedMax) && wantedMax > 0) {
      and.push({ OR: [{ salaryMin: { lte: Math.floor(wantedMax) } }, { salaryMin: null, salaryMax: { lte: Math.floor(wantedMax) } }] });
    }
    // Early-career filters: paid only, longest duration, when it starts, offer possible, full or part time.
    const flag = (name: string) => ['1', 'true'].includes((singleValue(req.query[name] as string | string[] | undefined) || '').toLowerCase());
    if (flag('paid')) and.push({ unpaid: false });
    if (flag('offer')) and.push({ possibleJobOffer: true });
    const maxDuration = Number(singleValue(req.query.maxDuration as string | string[] | undefined));
    if (Number.isFinite(maxDuration) && maxDuration > 0) and.push({ durationMonths: { lte: Math.floor(maxDuration) } });
    const schedule = singleValue(req.query.schedule as string | string[] | undefined);
    if (schedule === 'FULL_TIME' || schedule === 'PART_TIME') and.push({ schedule });
    if (flag('startsNow')) {
      and.push({ startsImmediately: true });
    } else {
      const startBy = singleValue(req.query.startBy as string | string[] | undefined);
      if (startBy) {
        try {
          const by = parseDay(startBy);
          and.push({ OR: [{ startsImmediately: true }, { startDate: { lte: by } }] });
        } catch {
          // An unreadable date is ignored rather than failing the search.
        }
      }
    }
    if (and.length > 0) {
      where.AND = and;
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        employer: {
          select: {
            id: true,
            email: true,
            employerProfile: true,
            verificationRequests: approvedBusinessVerificationQuery,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Verified employers first, then newest.
    res.json({
      success: true,
      jobs: rankJobsByVerification(
        jobs.map((job) => ({
          ...job,
          // "Urgently hiring" or "Featured" while a paid promotion is running; it ends by itself.
          promotion: promotionOf(job),
          employer: {
            id: job.employer.id,
            email: job.employer.email,
            employerProfile: job.employer.employerProfile,
            ...publicEmployerVerification(job.employer.verificationRequests),
          },
        })),
      ),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
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
          ...publicJobWhere(),
        },
        include: {
          employer: {
            select: {
              id: true,
              email: true,
              employerProfile: true,
              verificationRequests: approvedBusinessVerificationQuery,
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
        companyName: job.employer.employerProfile?.companyName || job.employer.email || 'An employer',
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
            ...publicEmployerVerification(job.employer.verificationRequests),
          },
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getJobById = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, ...publicJobWhere() },
      include: {
        employer: {
          select: {
            id: true,
            email: true,
            employerProfile: true,
            verificationRequests: approvedBusinessVerificationQuery,
          },
        },
      }
    });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({
      success: true,
      job: {
        ...job,
        promotion: promotionOf(job),
        // Shown as "posted by JobWahala on behalf of [company]" (the admin's own details are never sent).
        postedOnBehalf: Boolean(job.postedByAdminId),
        employer: {
          id: job.employer.id,
          email: job.employer.email,
          employerProfile: job.employer.employerProfile,
          ...publicEmployerVerification(job.employer.verificationRequests),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const applyForJob = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    const { coverLetter, cv } = req.body as { coverLetter?: string; cv?: 'UPLOADED' | 'BUILDER' | 'NONE' };
    const seekerId = req.user!.id;

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, ...publicJobWhere() }
    });

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or inactive' });
    }

    // The employer takes applications outside JobWahala (WhatsApp, email): nobody here would see an in-app application.
    if (job.applyInstructions) {
      return res.status(400).json({ success: false, message: 'This employer takes applications outside JobWahala. Follow the How to apply steps on the job page.' });
    }

    const existing = await prisma.application.findUnique({
      where: {
        jobId_seekerId: { jobId, seekerId }
      }
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already applied to this job' });
    }

    // The CV the applicant chose is copied onto the application now, so the employer keeps what was sent
    // even if the applicant later replaces or removes their CV.
    let cvData: { cvSource?: string; cvFileUrl?: string; cvFileName?: string } = {};
    if (cv === 'UPLOADED' || cv === 'BUILDER') {
      const files = await prisma.seekerCv.findUnique({ where: { userId: seekerId } });
      const url = cv === 'UPLOADED' ? files?.uploadedUrl : files?.builderUrl;
      const name = cv === 'UPLOADED' ? files?.uploadedFileName : files?.builderFileName;
      if (!url) {
        return res.status(400).json({
          success: false,
          message: cv === 'UPLOADED' ? 'You have not uploaded a CV yet.' : 'You have not saved a CV from the CV builder yet.',
        });
      }
      cvData = { cvSource: cv, cvFileUrl: url, cvFileName: name || 'CV' };
    }

    const application = await prisma.application.create({
      data: {
        jobId,
        seekerId,
        coverLetter: coverLetter?.trim() || null,
        ...cvData,
      }
    });
    res.status(201).json({ success: true, application });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'You have already applied to this job' });
    }

    res.status(500).json({ success: false, message: getErrorMessage(error) });
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
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
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
          select: {
            id: true,
            email: true,
            jobSeekerProfile: true,
            // Courses the applicant says they completed; "verified" means the provider confirmed it.
            learnerCourses: {
              orderBy: { completedOn: 'desc' },
              take: 10,
              select: { id: true, title: true, providerName: true, completedOn: true, certificateUrl: true, status: true },
            },
          }
        },
        // The employer's private notes and rating. Only this route (job owner) ever returns it.
        review: { select: { rating: true, note: true, updatedAt: true } }
      }
    });

    const withCourses = applications.map((application) => ({
      ...application,
      seeker: {
        ...application.seeker,
        learnerCourses: (application.seeker.learnerCourses ?? []).map(({ status, ...course }) => ({ ...course, verified: status === 'CONFIRMED' })),
      },
    }));
    const rankedApplications = mapRankedApplications(withCourses, job);

    res.json({ success: true, applications: rankedApplications });
  } catch (error) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
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
          .trim() || application.seeker.email || 'Candidate',
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
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
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
            .trim() || application.seeker.email || 'Candidate',
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
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
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
            .trim() || application.seeker.email || 'Candidate',
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
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
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
        where: { id: jobId, ...publicJobWhere() },
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
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

type StatusChangeResult =
  | { ok: true; changed: boolean; application: { id: string; status: string } }
  | { ok: false; code: 400 | 403; message: string };

/**
 * Moves one application to a new stage for the employer who owns the job: saves it, tracks the response
 * time, notifies the applicant in-app and by email, and keeps any agreement in step. One place, so the
 * single change and "reject several" behave exactly the same (including the polite rejection wording).
 */
export const changeApplicationStatus = async (applicationId: string, status: string, employerId: string): Promise<StatusChangeResult> => {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        seeker: { select: { id: true, email: true } },
        job: {
          select: {
            employerId: true,
            title: true,
            salary: true,
            employer: { select: { employerProfile: { select: { companyName: true } } } },
          }
        }
      }
    });

    if (!application || application.job.employerId !== employerId) {
      return { ok: false, code: 403, message: 'Access denied' };
    }

    // Nothing changed, so nobody is notified and the clock does not move.
    if (application.status === status) {
      return { ok: true, changed: false, application };
    }

    const now = new Date();
    const companyName = application.job.employer.employerProfile?.companyName || 'The employer';
    const statusMessage = describeStatusChange(status, { jobTitle: application.job.title, company: companyName });
    const firstResponse = isFirstResponse(application, status);

    const existingAgreement = await prisma.agreement.findUnique({
      where: { applicationId }
    });

    const activeProposalStatuses = ['PENDING', 'COUNTERED'];

    if (existingAgreement && existingAgreement.status !== 'ACTIVE') {
      return { ok: false, code: 400, message: 'This application is already attached to a closed agreement and cannot be changed' };
    }

    const updatedApplication = await prisma.$transaction(async (tx) => {
      const nextApplication = await tx.application.update({
        where: { id: applicationId },
        data: { status, statusChangedAt: now, ...(firstResponse ? { firstRespondedAt: now } : {}) }
      });

      // How quickly this employer first answers applicants (kept as a running average).
      if (firstResponse) {
        const profile = await tx.employerProfile.findUnique({
          where: { userId: application.job.employerId },
          select: { avgResponseHours: true, responseCount: true },
        });
        if (profile) {
          await tx.employerProfile.update({
            where: { userId: application.job.employerId },
            data: nextResponseStats(profile, responseHours(application.createdAt, now)),
          });
        }
      }

      if (statusMessage) {
        await createNotification(tx, {
          userId: application.seekerId,
          type: 'APPLICATION_STATUS',
          title: statusMessage.title,
          message: statusMessage.message,
          actionUrl: '/applications',
        });
      }

      await tx.proposal.updateMany({
        where: {
          applicationId,
          status: { in: activeProposalStatuses }
        },
        data: { status: 'CANCELLED' }
      });

      if (status === 'HIRED') {
        if (!env.freelanceEnabled && !existingAgreement) {
          // Agreements (and their escrow) are not live yet: hiring just updates the application.
        } else if (existingAgreement) {
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
              actorId: employerId,
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
            actorId: employerId,
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
          actorId: employerId,
          eventType: 'STATUS_CHANGED',
          message: 'Agreement cancelled because the application moved out of HIRED.',
          fromStatus: existingAgreement.status,
          toStatus: 'CANCELLED'
        });
      }

      return nextApplication;
    });

    // The email goes out after the change is saved, and never holds up (or fails) the employer's action.
    // Phone-only members have no email; they still get the in-app notification.
    if (statusMessage && application.seeker.email) {
      void sendApplicationStatusEmail(application.seeker.email, {
        ...statusMessage,
        jobTitle: application.job.title,
        company: companyName,
      }).catch((error) =>
        logger.error('application_status_email_failed', { applicationId, error: getErrorMessage(error) }),
      );
    }

    return { ok: true, changed: true, application: updatedApplication };
};

export const updateApplicationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = singleValue(req.params.applicationId);
    const { status } = req.body as { status: string };

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'Application id is required' });
    }

    const result = await changeApplicationStatus(applicationId, status, req.user!.id);
    if (!result.ok) {
      return res.status(result.code).json({ success: false, message: result.message });
    }

    return res.json({ success: true, application: result.application });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// Private notes and a 1-5 rating on one applicant. Only the employer who owns the job can read or write them.
export const reviewApplication = async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = singleValue(req.params.applicationId);
    const { rating, note } = req.body as { rating?: number | null; note?: string };

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'Application id is required' });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, job: { select: { employerId: true } } },
    });

    if (!application || application.job.employerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const data = {
      ...(rating !== undefined ? { rating } : {}),
      ...(note !== undefined ? { note: note === '' ? null : note } : {}),
    };

    const review = await prisma.applicationReview.upsert({
      where: { applicationId },
      create: { applicationId, employerId: req.user!.id, ...data },
      update: data,
      select: { rating: true, note: true, updatedAt: true },
    });

    return res.json({ success: true, review });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// Politely turns down several applicants at once. Each one gets the same notification and email as a single
// rejection. Hired people and ones already turned down are skipped, never changed.
export const bulkRejectApplicants = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = singleValue(req.params.id);
    const { applicationIds } = req.body as { applicationIds: string[] };

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { employerId: true } });
    if (!job || job.employerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const ids = [...new Set(applicationIds)];
    const found = await prisma.application.findMany({
      where: { id: { in: ids }, jobId },
      select: { id: true, status: true },
    });
    const byId = new Map(found.map((application) => [application.id, application.status]));

    const rejected: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const id of ids) {
      const status = byId.get(id);
      if (!status) {
        skipped.push({ id, reason: 'Not an applicant for this job' });
        continue;
      }
      if (status === 'REJECTED') {
        skipped.push({ id, reason: 'Already turned down' });
        continue;
      }
      if (status === 'HIRED' || status === 'COMPLETED' || status === 'CANCELLED') {
        skipped.push({ id, reason: 'Already hired' });
        continue;
      }

      const result = await changeApplicationStatus(id, 'REJECTED', req.user!.id);
      if (result.ok) rejected.push(id);
      else skipped.push({ id, reason: result.message });
    }

    return res.json({ success: true, rejected, skipped });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
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
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
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

    if (!isOwnerManaged(job.status)) {
      return res.status(409).json({ success: false, message: 'This job is under review by JobWahala and cannot be changed yet.' });
    }

    if (job.status === status) {
      return res.json({ success: true, job });
    }

    if (!canChangeStatus(job.status, status)) {
      return res.status(409).json({
        success: false,
        message: job.status === 'EXPIRED'
          ? 'This job has expired. Extend its closing date to open it again.'
          : `A ${job.status.toLowerCase()} job cannot be set to ${status.toLowerCase()}.`,
      });
    }

    if (status === 'ACTIVE' && isPastClosingDate(job.closesAt)) {
      return res.status(409).json({ success: false, message: 'The closing date has passed. Extend the job to open it again.' });
    }

    // Applicants are never touched: pausing, closing or expiring only changes who can find and apply.
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status }
    });

    // First publish of a draft is the moment saved-search alerts go out (not a resume).
    if (job.status === 'DRAFT' && status === 'ACTIVE') void notifyJobAlerts(updatedJob);

    return res.json({ success: true, job: updatedJob });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

const loadOwnedJob = async (req: AuthRequest, res: Response) => {
  const jobId = singleValue(req.params.id);
  if (!jobId) {
    res.status(400).json({ success: false, message: 'Job id is required' });
    return null;
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.employerId !== req.user!.id) {
    res.status(403).json({ success: false, message: 'Access denied' });
    return null;
  }

  if (!isOwnerManaged(job.status)) {
    res.status(409).json({ success: false, message: 'This job is under review by JobWahala and cannot be changed yet.' });
    return null;
  }

  return job;
};

/** Edit a job's details. Allowed in every owner status; applicants are untouched. */
export const updateOwnedJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = await loadOwnedJob(req, res);
    if (!job) return;

    const body = req.body as Record<string, string | undefined>;
    const data: Record<string, unknown> = {};

    for (const key of ['title', 'description', 'type'] as const) {
      if (body[key] !== undefined) data[key] = body[key]!.trim();
    }
    for (const key of ['location', 'category'] as const) {
      if (body[key] !== undefined) data[key] = body[key]!.trim() || null;
    }

    // Pay. Numbers win; with only new text, the numbers are read from it; with only new numbers, the text is rewritten.
    const rawBody = req.body as { salary?: string; salaryMin?: number | null; salaryMax?: number | null };
    if (rawBody.salary !== undefined || rawBody.salaryMin !== undefined || rawBody.salaryMax !== undefined) {
      const numbersGiven = rawBody.salaryMin !== undefined || rawBody.salaryMax !== undefined;
      const pay = resolvePay({
        salary: rawBody.salary !== undefined ? rawBody.salary : numbersGiven ? null : undefined,
        ...(numbersGiven
          ? { salaryMin: rawBody.salaryMin !== undefined ? rawBody.salaryMin : job.salaryMin, salaryMax: rawBody.salaryMax !== undefined ? rawBody.salaryMax : job.salaryMax }
          : {}),
      });
      Object.assign(data, pay, { salaryParsedAt: new Date() });
    }

    // Early-career details. A job that is (or becomes) a normal job carries none; unpaid replaces any stipend.
    const earlyKeys = ['unpaid', 'durationMonths', 'startsImmediately', 'startDate', 'schedule', 'possibleJobOffer'] as const;
    const typeChanged = typeof body.type === 'string';
    const earlyTouched = earlyKeys.some((key) => (req.body as Record<string, unknown>)[key] !== undefined);
    if (typeChanged || earlyTouched) {
      const effectiveType = typeof data.type === 'string' ? data.type : job.type;
      try {
        const early = earlyCareerData(req.body as EarlyCareerInput, effectiveType);
        Object.assign(data, early);
        if (isEarlyCareerType(effectiveType)) data.type = canonicalEarlyCareerType(effectiveType);
        if (early.unpaid === true) {
          Object.assign(data, UNPAID_PAY, { salaryParsedAt: new Date() });
        } else if (early.unpaid === false && job.unpaid && rawBody.salary === undefined && rawBody.salaryMin === undefined && rawBody.salaryMax === undefined) {
          // No longer unpaid, and no new pay given: drop the "Unpaid" label.
          Object.assign(data, { salary: null, salaryMin: null, salaryMax: null, salaryParsedAt: new Date() });
        }
      } catch (error) {
        if (error instanceof EarlyCareerError) return res.status(400).json({ success: false, message: error.message });
        throw error;
      }
    }

    if (body.closesAt !== undefined && body.closesAt !== '') {
      if (job.status === 'EXPIRED') {
        return res.status(409).json({ success: false, message: 'This job has expired. Use Extend to open it again.' });
      }
      try {
        data.closesAt = resolveClosesAt(body.closesAt);
        data.expiryWarningSentAt = null;
      } catch (error) {
        if (error instanceof ClosingDateError) {
          return res.status(400).json({ success: false, message: error.message });
        }
        throw error;
      }
    }

    const updated = await prisma.job.update({ where: { id: job.id }, data });
    return res.json({ success: true, job: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Copy a job as a new private draft with a fresh 30-day closing date. */
export const duplicateOwnedJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = await loadOwnedJob(req, res);
    if (!job) return;

    const copy = await prisma.job.create({
      data: {
        employerId: job.employerId,
        title: job.title,
        description: job.description,
        location: job.location,
        type: job.type,
        salary: job.salary,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryParsedAt: new Date(),
        unpaid: job.unpaid,
        durationMonths: job.durationMonths,
        startsImmediately: job.startsImmediately,
        startDate: job.startDate && job.startDate.getTime() > Date.now() ? job.startDate : null,
        schedule: job.schedule,
        possibleJobOffer: job.possibleJobOffer,
        currency: job.currency,
        category: job.category,
        status: 'DRAFT',
        closesAt: addDays(new Date(), DEFAULT_JOB_DAYS),
      },
    });

    return res.status(201).json({ success: true, job: copy });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Push the closing date out (counted from today). An expired job opens again; others keep their status. */
export const extendOwnedJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = await loadOwnedJob(req, res);
    if (!job) return;

    let closesAt: Date;
    try {
      closesAt = closesAtFromDays((req.body as { days?: number }).days);
    } catch (error) {
      if (error instanceof ClosingDateError) {
        return res.status(400).json({ success: false, message: error.message });
      }
      throw error;
    }

    if (closesAt.getTime() <= job.closesAt.getTime()) {
      return res.status(400).json({ success: false, message: 'That is not later than the current closing date.' });
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        closesAt,
        expiryWarningSentAt: null,
        ...(job.status === 'EXPIRED' ? { status: 'ACTIVE' } : {}),
      },
    });

    return res.json({ success: true, job: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
