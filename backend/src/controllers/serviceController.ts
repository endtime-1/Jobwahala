import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { singleValue } from '../utils/request';
import { createAgreementEvent } from '../utils/agreementEvents';
import { serializeVerificationStatus } from '../utils/verification';
import {
  generateMarketplaceFreelancerComparisonSummary,
  generateServiceComparisonSummary,
  generateServiceOptimization,
  generateServiceRequestCoaching,
} from '../services/ai';
import { scoreServiceForClient } from '../utils/matching';

const serviceListInclude = {
  freelancer: {
    select: {
      id: true,
      email: true,
      freelancerProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          tagline: true,
          availability: true,
          location: true,
          hourlyRate: true,
          skills: true,
        }
      },
      verificationRequests: {
        where: { type: 'PROFESSIONAL' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  },
} as const;

const buildServiceWhereClause = (q?: unknown, category?: unknown, skills?: unknown) => {
  const whereClause: any = { status: 'ACTIVE' };

  if (q) {
    const search = String(q);
    whereClause.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (category) {
    whereClause.category = { contains: String(category) };
  }

  if (skills) {
    whereClause.freelancer = {
      freelancerProfile: {
        skills: { contains: String(skills) }
      }
    };
  }

  return whereClause;
};

const serializeServiceListItem = (
  service: any,
  recommendation?: {
    matchScore: number;
    matchReasons: string[];
  },
) => ({
  ...service,
  ...(recommendation || {}),
  freelancer: {
    id: service.freelancer.id,
    email: service.freelancer.email,
    freelancerProfile: service.freelancer.freelancerProfile,
    ...serializeVerificationStatus(service.freelancer.verificationRequests[0] || null),
  },
});

const buildClientSignals = (user: any) =>
  user?.role === 'SEEKER'
    ? {
        skills: user.jobSeekerProfile?.skills,
        experience: user.jobSeekerProfile?.experience,
        industry: null,
        description: null,
      }
    : user?.role === 'EMPLOYER'
      ? {
          skills: null,
          experience: null,
          industry: user.employerProfile?.industry,
          description: [user.employerProfile?.companyName, user.employerProfile?.description]
            .filter(Boolean)
            .join(' '),
        }
      : {
          skills: user?.freelancerProfile?.skills,
          experience: user?.freelancerProfile?.bio,
          industry: null,
        description: null,
      };

const scoreServiceForMarketplace = (
  clientSignals: ReturnType<typeof buildClientSignals>,
  service: {
    id: string;
    title: string;
    description: string;
    price: number;
    deliveryTime?: string | null;
    category?: string | null;
  },
) => ({
  serviceId: service.id,
  title: service.title,
  category: service.category,
  price: service.price,
  deliveryTime: service.deliveryTime,
  ...scoreServiceForClient(clientSignals, {
    title: service.title,
    description: service.description,
    category: service.category,
    deliveryTime: service.deliveryTime,
  }),
});

export const createService = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, price, deliveryTime, category } = req.body;
    const numericPrice = Number(price);

    if (!title?.trim() || !description?.trim() || Number.isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Title, description, and a valid price are required' });
    }

    const service = await prisma.freelanceService.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        price: numericPrice,
        deliveryTime: deliveryTime?.trim() || null,
        category: category?.trim() || null,
        freelancerId: req.user!.id
      }
    });
    res.status(201).json({ success: true, service });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getServices = async (req: Request, res: Response) => {
  try {
    const { q, category, skills } = req.query;

    const services = await prisma.freelanceService.findMany({
      where: buildServiceWhereClause(q, category, skills),
      include: serviceListInclude,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      services: services.map((service) => serializeServiceListItem(service)),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRecommendedServices = async (req: AuthRequest, res: Response) => {
  try {
    const { q, category, skills } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        role: true,
        email: true,
        jobSeekerProfile: true,
        employerProfile: true,
        freelancerProfile: true,
      }
    });

    if (!user || !['SEEKER', 'EMPLOYER'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only seekers and employers can load personalized service recommendations',
      });
    }

    const clientSignals = buildClientSignals(user);
    const services = await prisma.freelanceService.findMany({
      where: buildServiceWhereClause(q, category, skills),
      include: serviceListInclude,
      orderBy: { createdAt: 'desc' },
    });

    const scoredServices = services
      .map((service) => {
        const recommendation = scoreServiceForClient(clientSignals, {
          title: service.title,
          description: service.description,
          category: service.category,
          deliveryTime: service.deliveryTime,
        });

        return serializeServiceListItem(service, recommendation);
      })
      .sort((left, right) => {
        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });

    return res.json({
      success: true,
      personalized: true,
      services: scoredServices,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getFreelancerComparison = async (req: AuthRequest, res: Response) => {
  try {
    const freelancerId = singleValue(req.params.id);

    if (!freelancerId) {
      return res.status(400).json({ success: false, message: 'Freelancer id is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        role: true,
        email: true,
        jobSeekerProfile: true,
        employerProfile: true,
        freelancerProfile: true,
      }
    });

    if (!user || !['SEEKER', 'EMPLOYER'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only seekers and employers can load freelancer comparison insights',
      });
    }

    const [freelancerProfile, alternativeServices] = await Promise.all([
      prisma.user.findFirst({
        where: { id: freelancerId, role: 'FREELANCER' },
        select: {
          id: true,
          email: true,
          freelancerProfile: true,
          verificationRequests: {
            where: { type: 'PROFESSIONAL' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          freelanceServices: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              description: true,
              price: true,
              deliveryTime: true,
              category: true,
              createdAt: true,
            },
          },
        }
      }),
      prisma.freelanceService.findMany({
        where: {
          status: 'ACTIVE',
          freelancerId: { not: freelancerId },
        },
        include: serviceListInclude,
        orderBy: { createdAt: 'desc' },
        take: 18,
      }),
    ]);

    if (!freelancerProfile) {
      return res.status(404).json({ success: false, message: 'Freelancer not found' });
    }

    const clientSignals = buildClientSignals(user);
    const freelancerName =
      [freelancerProfile.freelancerProfile?.firstName, freelancerProfile.freelancerProfile?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || freelancerProfile.email;

    const viewedServiceMatches = freelancerProfile.freelanceServices
      .map((service) => ({
        serviceId: service.id,
        title: service.title,
        category: service.category,
        price: service.price,
        deliveryTime: service.deliveryTime,
        ...scoreServiceForClient(clientSignals, {
          title: service.title,
          description: service.description,
          category: service.category,
          deliveryTime: service.deliveryTime,
        }),
      }))
      .sort((left, right) => right.matchScore - left.matchScore);

    const alternatives = alternativeServices
      .map((service) => {
        const recommendation = scoreServiceForClient(clientSignals, {
          title: service.title,
          description: service.description,
          category: service.category,
          deliveryTime: service.deliveryTime,
        });

        return serializeServiceListItem(service, recommendation);
      })
      .sort((left, right) => {
        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .slice(0, 3);

    const topViewedService = viewedServiceMatches[0] || null;
    const headline = await generateServiceComparisonSummary({
      clientRole: user.role,
      viewedFreelancerName: freelancerName,
      viewedService: topViewedService
        ? {
            freelancerName,
            serviceTitle: topViewedService.title,
            matchScore: topViewedService.matchScore,
            matchReasons: topViewedService.matchReasons,
            price: String(topViewedService.price),
            deliveryTime: topViewedService.deliveryTime,
            category: topViewedService.category,
          }
        : null,
      alternatives: alternatives.map((service) => {
        const alternativeName =
          [service.freelancer.freelancerProfile?.firstName, service.freelancer.freelancerProfile?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || service.freelancer.email;

        return {
          freelancerName: alternativeName,
          serviceTitle: service.title,
          matchScore: service.matchScore,
          matchReasons: service.matchReasons,
          price: String(service.price),
          deliveryTime: service.deliveryTime,
          category: service.category,
        };
      }),
    });

    return res.json({
      success: true,
      comparison: {
        headline,
        viewedFreelancerScore: topViewedService?.matchScore || 0,
        viewedServiceMatches,
        alternatives,
        viewedFreelancer: {
          id: freelancerProfile.id,
          email: freelancerProfile.email,
          freelancerProfile: freelancerProfile.freelancerProfile,
          ...serializeVerificationStatus(freelancerProfile.verificationRequests[0] || null),
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const compareMarketplaceFreelancers = async (req: AuthRequest, res: Response) => {
  try {
    const freelancerIds = Array.isArray(req.body?.freelancerIds)
      ? (req.body.freelancerIds as string[])
      : [];

    if (freelancerIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Select at least two freelancers to compare',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        role: true,
        email: true,
        jobSeekerProfile: true,
        employerProfile: true,
        freelancerProfile: true,
      }
    });

    if (!user || !['SEEKER', 'EMPLOYER'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only seekers and employers can compare freelancer options',
      });
    }

    const freelancerProfiles = await prisma.user.findMany({
      where: {
        id: { in: freelancerIds },
        role: 'FREELANCER',
      },
      select: {
        id: true,
        email: true,
        freelancerProfile: true,
        verificationRequests: {
          where: { type: 'PROFESSIONAL' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        freelanceServices: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            deliveryTime: true,
            category: true,
            createdAt: true,
          },
        },
      }
    });

    const profileMap = new Map(freelancerProfiles.map((profile) => [profile.id, profile]));
    const clientSignals = buildClientSignals(user);

    const comparedOptions = freelancerIds
      .map((freelancerId) => {
        const freelancerProfile = profileMap.get(freelancerId);

        if (!freelancerProfile || freelancerProfile.freelanceServices.length === 0) {
          return null;
        }

        const freelancerName =
          [freelancerProfile.freelancerProfile?.firstName, freelancerProfile.freelancerProfile?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || freelancerProfile.email;

        const matchedServices = freelancerProfile.freelanceServices
          .map((service) => scoreServiceForMarketplace(clientSignals, service))
          .sort((left, right) => {
            if (right.matchScore !== left.matchScore) {
              return right.matchScore - left.matchScore;
            }

            return left.title.localeCompare(right.title);
          });

        const topService = matchedServices[0];

        if (!topService) {
          return null;
        }

        return {
          freelancer: {
            id: freelancerProfile.id,
            email: freelancerProfile.email,
            freelancerProfile: freelancerProfile.freelancerProfile,
            ...serializeVerificationStatus(freelancerProfile.verificationRequests[0] || null),
          },
          topService,
          serviceCount: freelancerProfile.freelanceServices.length,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const scoreDelta = right!.topService.matchScore - left!.topService.matchScore;
        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        return right!.serviceCount - left!.serviceCount;
      }) as Array<{
      freelancer: {
        id: string;
        email: string;
        freelancerProfile: any;
        verificationStatus?: string | null;
        isVerified?: boolean;
      };
      topService: {
        serviceId: string;
        title: string;
        category?: string | null;
        price: number;
        deliveryTime?: string | null;
        matchScore: number;
        matchReasons: string[];
      };
      serviceCount: number;
    }>;

    if (comparedOptions.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least two selected freelancers need active services to compare',
      });
    }

    const summary = await generateMarketplaceFreelancerComparisonSummary({
      clientRole: user.role,
      options: comparedOptions.map((option) => {
        const freelancerName =
          [option.freelancer.freelancerProfile?.firstName, option.freelancer.freelancerProfile?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || option.freelancer.email;

        return {
          freelancerName,
          serviceTitle: option.topService.title,
          matchScore: option.topService.matchScore,
          matchReasons: option.topService.matchReasons,
          price: String(option.topService.price),
          deliveryTime: option.topService.deliveryTime,
          category: option.topService.category,
        };
      }),
    });

    return res.json({
      success: true,
      comparison: {
        summary,
        comparedCount: comparedOptions.length,
        options: comparedOptions,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const generateServiceDraft = async (req: AuthRequest, res: Response) => {
  try {
    const freelancerProfile = await prisma.freelancerProfile.findUnique({
      where: { userId: req.user!.id },
      select: {
        firstName: true,
        lastName: true,
        bio: true,
        skills: true,
        hourlyRate: true,
      }
    });

    const coaching = await generateServiceOptimization({
      firstName: freelancerProfile?.firstName,
      lastName: freelancerProfile?.lastName,
      bio: freelancerProfile?.bio,
      skills: freelancerProfile?.skills,
      hourlyRate: freelancerProfile?.hourlyRate,
      title: req.body?.title,
      description: req.body?.description,
      price: req.body?.price,
      deliveryTime: req.body?.deliveryTime,
      category: req.body?.category,
      focus: req.body?.focus,
    });

    return res.json({
      success: true,
      draft: coaching,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateService = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id);
    const updateData = {
      ...req.body,
    } as {
      title?: string;
      description?: string;
      price?: number;
      deliveryTime?: string | null;
      category?: string | null;
    };

    if (!id) {
      return res.status(400).json({ success: false, message: 'Service id is required' });
    }

    if (updateData.title !== undefined) updateData.title = String(updateData.title).trim();
    if (updateData.description !== undefined) updateData.description = String(updateData.description).trim();
    if (updateData.deliveryTime !== undefined) updateData.deliveryTime = String(updateData.deliveryTime).trim() || null;
    if (updateData.category !== undefined) updateData.category = String(updateData.category).trim() || null;
    if (updateData.price !== undefined) {
      const numericPrice = Number(updateData.price);
      if (Number.isNaN(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ success: false, message: 'A valid price is required' });
      }
      updateData.price = numericPrice;
    }

    // Verify ownership
    const serviceOwned = await prisma.freelanceService.findUnique({ where: { id } });
    if (!serviceOwned || serviceOwned.freelancerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const service = await prisma.freelanceService.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, service });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteService = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id);

    if (!id) {
      return res.status(400).json({ success: false, message: 'Service id is required' });
    }

    // Verify ownership
    const serviceOwned = await prisma.freelanceService.findUnique({ where: { id } });
    if (!serviceOwned || serviceOwned.freelancerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await prisma.freelanceService.delete({ where: { id } });

    res.json({ success: true, message: 'Service successfully deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFreelancerDetails = async (req: Request, res: Response) => {
  try {
    const id = singleValue(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Freelancer id is required' });
    }
    
    const profile = await prisma.user.findFirst({
      where: { id, role: 'FREELANCER' },
      select: {
        id: true,
        email: true,
        createdAt: true,
        freelancerProfile: {
          include: {
            projects: {
              orderBy: { createdAt: 'desc' },
              take: 6,
            },
          },
        },
        freelanceServices: { where: { status: 'ACTIVE' } },
        verificationRequests: {
          where: { type: 'PROFESSIONAL' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        reviewsReceived: {
          include: {
            reviewer: {
              select: {
                id: true,
                email: true,
                role: true,
                employerProfile: true,
                jobSeekerProfile: true,
                freelancerProfile: true,
              },
            },
            agreement: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
        },
      }
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Freelancer not found' });
    }

    const latestVerificationRequest = profile.verificationRequests[0] || null;
    const reviewCount = profile.reviewsReceived.length;
    const averageRating =
      reviewCount > 0
        ? Number(
            (
              profile.reviewsReceived.reduce((sum, review) => sum + review.rating, 0) /
              reviewCount
            ).toFixed(1)
          )
        : 0;

    const { verificationRequests, ...safeProfile } = profile;

    res.json({
      success: true,
      profile: {
        ...safeProfile,
        ...serializeVerificationStatus(latestVerificationRequest),
      },
      reviewSummary: {
        reviewCount,
        averageRating,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getServiceRequestCoaching = async (req: AuthRequest, res: Response) => {
  try {
    const serviceId = singleValue(req.params.id);

    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'Service id is required' });
    }

    const [service, user] = await Promise.all([
      prisma.freelanceService.findFirst({
        where: { id: serviceId, status: 'ACTIVE' },
        include: {
          freelancer: {
            select: {
              id: true,
              email: true,
              freelancerProfile: true,
            }
          }
        }
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          role: true,
          email: true,
          jobSeekerProfile: true,
          employerProfile: true,
          freelancerProfile: true,
        }
      }),
    ]);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found or inactive' });
    }

    if (service.freelancerId === req.user!.id) {
      return res.status(400).json({ success: false, message: 'You cannot request your own service' });
    }

    const clientSignals = buildClientSignals(user);

    const fit = scoreServiceForClient(clientSignals, {
      title: service.title,
      description: service.description,
      category: service.category,
      deliveryTime: service.deliveryTime,
    });

    const freelancerName =
      [service.freelancer.freelancerProfile?.firstName, service.freelancer.freelancerProfile?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || service.freelancer.email;

    const coaching = await generateServiceRequestCoaching({
      clientRole: user?.role || req.user!.role,
      freelancerName,
      serviceTitle: service.title,
      serviceDescription: service.description,
      serviceCategory: service.category,
      servicePrice: String(service.price),
      serviceDeliveryTime: service.deliveryTime,
      clientSignals: [clientSignals.skills, clientSignals.experience, clientSignals.industry, clientSignals.description]
        .filter(Boolean)
        .join(' '),
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

export const createServiceRequest = async (req: AuthRequest, res: Response) => {
  try {
    const serviceId = singleValue(req.params.id);
    const { message, budget, timeline } = req.body as {
      message: string;
      budget?: string;
      timeline?: string;
    };

    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'Service id is required' });
    }

    const service = await prisma.freelanceService.findFirst({
      where: { id: serviceId, status: 'ACTIVE' },
      include: {
        freelancer: {
          select: { id: true, email: true }
        }
      }
    });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found or inactive' });
    }

    if (service.freelancerId === req.user!.id) {
      return res.status(400).json({ success: false, message: 'You cannot request your own service' });
    }

    const existingPendingRequest = await prisma.serviceRequest.findFirst({
      where: {
        serviceId,
        clientId: req.user!.id,
        status: 'PENDING'
      }
    });

    if (existingPendingRequest) {
      return res.status(400).json({ success: false, message: 'You already have a pending request for this service' });
    }

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        serviceId,
        clientId: req.user!.id,
        message: message.trim(),
        budget: budget?.trim() || null,
        timeline: timeline?.trim() || null
      },
      include: {
        service: { select: { id: true, title: true } },
        client: { select: { id: true, email: true, role: true } }
      }
    });

    return res.status(201).json({ success: true, serviceRequest });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getReceivedServiceRequests = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.serviceRequest.findMany({
      where: {
        service: {
          freelancerId: req.user!.id
        }
      },
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
        service: {
          select: {
            id: true,
            title: true,
            price: true,
            category: true
          }
        },
        client: {
          select: {
            id: true,
            email: true,
            role: true,
            jobSeekerProfile: true,
            employerProfile: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, requests });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSentServiceRequests = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.serviceRequest.findMany({
      where: { clientId: req.user!.id },
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
        service: {
          select: {
            id: true,
            title: true,
            price: true,
            category: true,
            freelancer: {
              select: {
                id: true,
                email: true,
                freelancerProfile: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, requests });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateServiceRequestStatus = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = singleValue(req.params.requestId);
    const { status } = req.body as { status: string };

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request id is required' });
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        service: {
          select: { freelancerId: true, title: true, price: true }
        }
      }
    });

    if (!serviceRequest || serviceRequest.service.freelancerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const existingAgreement = await prisma.agreement.findUnique({
      where: { serviceRequestId: requestId }
    });

    const activeProposalStatuses = ['PENDING', 'COUNTERED'];

    if (existingAgreement && existingAgreement.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'This request is already attached to a closed agreement and cannot be changed'
      });
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const nextRequest = await tx.serviceRequest.update({
        where: { id: requestId },
        data: { status }
      });

      await tx.proposal.updateMany({
        where: {
          serviceRequestId: requestId,
          status: { in: activeProposalStatuses }
        },
        data: { status: 'CANCELLED' }
      });

      if (status === 'ACCEPTED') {
        if (existingAgreement) {
          const reactivatedAgreement = await tx.agreement.update({
            where: { id: existingAgreement.id },
            data: {
              status: 'ACTIVE',
              title: serviceRequest.service.title,
              amount: serviceRequest.budget || existingAgreement.amount,
            }
          });

          if (existingAgreement.status !== 'ACTIVE') {
            await createAgreementEvent(tx, {
              agreementId: reactivatedAgreement.id,
              actorId: req.user!.id,
              eventType: 'STATUS_CHANGED',
              message: 'Agreement reactivated after the service request was accepted again.',
              fromStatus: existingAgreement.status,
              toStatus: 'ACTIVE'
            });
          }
        } else {
          const createdAgreement = await tx.agreement.create({
            data: {
              type: 'SERVICE',
              title: serviceRequest.service.title,
              summary: serviceRequest.message.trim(),
              amount: serviceRequest.budget || null,
              serviceRequestId: requestId,
              freelancerId: serviceRequest.service.freelancerId,
              clientId: serviceRequest.clientId,
            }
          });

          await createAgreementEvent(tx, {
            agreementId: createdAgreement.id,
            actorId: req.user!.id,
            eventType: 'CREATED',
            message: 'Agreement created after the service request was accepted.',
            toStatus: createdAgreement.status
          });
        }
      } else if (status === 'COMPLETED' && existingAgreement && existingAgreement.status === 'ACTIVE') {
        const completedAgreement = await tx.agreement.update({
          where: { id: existingAgreement.id },
          data: { status: 'COMPLETED' }
        });

        await createAgreementEvent(tx, {
          agreementId: completedAgreement.id,
          actorId: req.user!.id,
          eventType: 'STATUS_CHANGED',
          message: 'Agreement completed from the service request workflow.',
          fromStatus: existingAgreement.status,
          toStatus: 'COMPLETED'
        });
      } else if (existingAgreement && existingAgreement.status === 'ACTIVE') {
        const cancelledAgreement = await tx.agreement.update({
          where: { id: existingAgreement.id },
          data: { status: 'CANCELLED' }
        });

        await createAgreementEvent(tx, {
          agreementId: cancelledAgreement.id,
          actorId: req.user!.id,
          eventType: 'STATUS_CHANGED',
          message: 'Agreement cancelled because the service request moved out of ACCEPTED.',
          fromStatus: existingAgreement.status,
          toStatus: 'CANCELLED'
        });
      }

      return nextRequest;
    });

    return res.json({ success: true, request: updatedRequest });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSentServiceRequest = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = singleValue(req.params.requestId);

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request id is required' });
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: requestId }
    });

    if (!serviceRequest || serviceRequest.clientId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { serviceRequestId: requestId }
    });

    if (serviceRequest.status !== 'PENDING' || agreement) {
      return res.status(400).json({ success: false, message: 'Only pending service requests can be cancelled' });
    }

    await prisma.serviceRequest.delete({
      where: { id: requestId }
    });

    return res.json({ success: true, message: 'Service request cancelled successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOwnedServiceStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id);
    const { status } = req.body as { status: string };

    if (!id) {
      return res.status(400).json({ success: false, message: 'Service id is required' });
    }

    const service = await prisma.freelanceService.findUnique({
      where: { id }
    });

    if (!service || service.freelancerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updatedService = await prisma.freelanceService.update({
      where: { id },
      data: { status }
    });

    return res.json({ success: true, service: updatedService });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
