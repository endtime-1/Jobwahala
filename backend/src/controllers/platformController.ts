import { Request, Response } from 'express';
import prisma from '../config/prisma';

// Cached stats to avoid hitting the DB on every page load
let cachedStats: Record<string, unknown> | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const getPlatformStats = async (_req: Request, res: Response) => {
  try {
    const now = Date.now();

    if (cachedStats && now < cacheExpiry) {
      return res.json({ success: true, stats: cachedStats });
    }

    const [
      totalJobs,
      totalFreelancers,
      totalSeekers,
      totalEmployers,
      totalServices,
      totalApplications,
      recentJobs,
      topFreelancers,
    ] = await Promise.all([
      prisma.job.count({ where: { status: 'OPEN' } }),
      prisma.user.count({ where: { role: 'FREELANCER', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'SEEKER', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'EMPLOYER', status: 'ACTIVE' } }),
      prisma.freelanceService.count({ where: { status: 'ACTIVE' } }),
      prisma.application.count(),
      prisma.job.findMany({
        where: { status: 'OPEN' },
        select: {
          id: true,
          title: true,
          location: true,
          type: true,
          salary: true,
          category: true,
          createdAt: true,
          employer: {
            select: {
              employerProfile: {
                select: { companyName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.user.findMany({
        where: { role: 'FREELANCER', status: 'ACTIVE' },
        select: {
          id: true,
          freelancerProfile: {
            select: {
              firstName: true,
              lastName: true,
              skills: true,
              hourlyRate: true,
            },
          },
          freelanceServices: {
            where: { status: 'ACTIVE' },
            select: { id: true, title: true },
            take: 2,
          },
          reviewsReceived: {
            select: { rating: true },
          },
        },
        take: 6,
      }),
    ]);

    const stats = {
      counts: {
        openJobs: totalJobs,
        freelancers: totalFreelancers,
        seekers: totalSeekers,
        employers: totalEmployers,
        activeServices: totalServices,
        totalApplications: totalApplications,
        totalTalent: totalSeekers + totalFreelancers,
      },
      recentJobs: recentJobs.map((job) => ({
        id: job.id,
        title: job.title,
        location: job.location,
        type: job.type,
        salary: job.salary,
        category: job.category,
        companyName: job.employer?.employerProfile?.companyName || 'Company',
        createdAt: job.createdAt,
      })),
      topFreelancers: topFreelancers.map((f) => {
        const reviews = f.reviewsReceived || [];
        const avgRating =
          reviews.length > 0
            ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
            : 0;
        return {
          id: f.id,
          name:
            [f.freelancerProfile?.firstName, f.freelancerProfile?.lastName]
              .filter(Boolean)
              .join(' ')
              .trim() || 'Freelancer',
          skills: (f.freelancerProfile?.skills || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 3),
          hourlyRate: f.freelancerProfile?.hourlyRate,
          serviceCount: f.freelanceServices.length,
          rating: avgRating,
          reviewCount: reviews.length,
          initials:
            [(f.freelancerProfile?.firstName || '')[0], (f.freelancerProfile?.lastName || '')[0]]
              .filter(Boolean)
              .join('')
              .toUpperCase() || 'FL',
        };
      }),
    };

    cachedStats = stats;
    cacheExpiry = now + CACHE_TTL_MS;

    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
