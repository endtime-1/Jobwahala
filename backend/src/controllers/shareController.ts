import { Request, Response } from 'express';
import prisma from '../config/prisma';
import env from '../config/env';
import logger from '../config/logger';
import { singleValue } from '../utils/request';
import { getErrorMessage } from '../utils/errors';
import { renderFreelancerSharePage, renderSharePageNotFound } from '../utils/sharePage';
import { renderJobListPage, renderJobPage, type SeoJob } from '../utils/seoPages';
import { EARLY_CAREER_TYPES } from '../utils/earlyCareer';
import { publicJobWhere } from '../utils/jobLifecycle';
import { buildLandingIndex, buildLandingPage, landingSitemapPaths, type LandingIndex, type LandingJob } from '../utils/landingPages';
import { renderLandingNotFound, renderLandingPage } from '../utils/landingRender';
import { siteCopy } from '../content/siteCopy';
import {
  buildSitemapXml,
  countryEntries,
  resolvePublicBaseUrl,
  staticSitemapPaths,
  type SitemapEntry,
} from '../utils/sitemap';

const publicSiteUrl = (req: Request) =>
  resolvePublicBaseUrl({
    configured: process.env.FRONTEND_BASE_URL,
    protocol: req.get('x-forwarded-proto') || req.protocol,
    host: req.get('x-forwarded-host') || req.get('host') || undefined,
  }) || env.frontendBaseUrl;

const seoJobSelect = {
  id: true,
  title: true,
  description: true,
  location: true,
  type: true,
  category: true,
  salary: true,
  salaryMin: true,
  salaryMax: true,
  createdAt: true,
  closesAt: true,
  schedule: true,
  durationMonths: true,
  unpaid: true,
  employer: { select: { employerProfile: { select: { companyName: true, logoUrl: true, website: true } } } },
} as const;

type SeoJobRow = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  type: string;
  category: string | null;
  salary: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  createdAt: Date;
  closesAt: Date;
  schedule: string | null;
  durationMonths: number | null;
  unpaid: boolean;
  employer: { employerProfile: { companyName: string; logoUrl: string | null; website: string | null } | null };
};

const toSeoJob = (row: SeoJobRow, siteUrl: string): SeoJob => {
  const logo = row.employer.employerProfile?.logoUrl ?? null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    type: row.type,
    category: row.category,
    salary: row.salary,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    createdAt: row.createdAt,
    closesAt: row.closesAt,
    schedule: row.schedule,
    durationMonths: row.durationMonths,
    unpaid: row.unpaid,
    employerName: row.employer.employerProfile?.companyName || 'A company on JobWahala',
    employerLogoUrl: logo ? (/^https?:\/\//i.test(logo) ? logo : `${siteUrl}${logo}`) : null,
    employerWebsite: row.employer.employerProfile?.website ?? null,
  };
};

/**
 * Server-rendered preview for link crawlers (WhatsApp, Facebook, X, LinkedIn, Telegram).
 * They do not run JavaScript, so the React app cannot supply per-profile OpenGraph tags.
 */
export const getFreelancerSharePage = async (req: Request, res: Response) => {
  const siteUrl = publicSiteUrl(req);

  try {
    const id = singleValue(req.params.id);

    const freelancer = id
      ? await prisma.user.findFirst({
          where: { id, role: 'FREELANCER', status: 'ACTIVE' },
          select: {
            freelancerProfile: {
              select: { firstName: true, lastName: true, tagline: true, bio: true, skills: true, location: true },
            },
            freelanceServices: { where: { status: 'ACTIVE' }, select: { title: true }, take: 3 },
          },
        })
      : null;

    res.type('html');

    if (!freelancer) {
      return res.status(404).send(renderSharePageNotFound(siteUrl));
    }

    res.set('Cache-Control', 'public, max-age=300');
    return res.send(
      renderFreelancerSharePage(
        {
          id: id!,
          ...(freelancer.freelancerProfile || {}),
          serviceTitles: freelancer.freelanceServices.map((service) => service.title),
        },
        siteUrl,
      ),
    );
  } catch (error) {
    logger.error('share_page_error', { error: getErrorMessage(error) });
    return res.status(500).type('html').send(renderSharePageNotFound(siteUrl));
  }
};

/**
 * A sitemap with the pages search engines should know about: the fixed pages, a page per
 * country, every open job and every company that has one.
 */
export const getSitemap = async (req: Request, res: Response) => {
  try {
    const baseUrl = resolvePublicBaseUrl({
      configured: process.env.FRONTEND_BASE_URL,
      protocol: req.get('x-forwarded-proto') || req.protocol,
      host: req.get('x-forwarded-host') || req.get('host') || undefined,
    });

    const jobs = await prisma.job.findMany({
      where: publicJobWhere(),
      select: { id: true, employerId: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    });

    const companyIds = [...new Set(jobs.map((job) => job.employerId))];

    const entries: SitemapEntry[] = [
      ...staticSitemapPaths,
      ...countryEntries(),
      ...landingSitemapPaths(await loadLandingIndex()).map((path) => ({ path, changeFrequency: 'daily' as const, priority: 0.6 })),
      ...jobs.map((job) => ({
        path: `/jobs/${job.id}`,
        lastModified: job.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...companyIds.map((id) => ({ path: `/companies/${id}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ];

    res.type('application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    return res.send(buildSitemapXml(baseUrl, entries));
  } catch (error) {
    logger.error('sitemap_failed', { error: getErrorMessage(error) });
    return res.status(500).type('text/plain').send('Unable to build the sitemap right now');
  }
};

/** A job page for search engines and link previews, with Google's JobPosting data. */
export const getJobSharePage = async (req: Request, res: Response) => {
  const siteUrl = publicSiteUrl(req);

  try {
    const id = singleValue(req.params.id);
    const job = id
      ? await prisma.job.findFirst({ where: { id, ...publicJobWhere() }, select: seoJobSelect })
      : null;

    res.type('html');

    if (!job) {
      return res.status(404).send(renderSharePageNotFound(siteUrl));
    }

    res.set('Cache-Control', 'public, max-age=300');
    return res.send(renderJobPage(toSeoJob(job as SeoJobRow, siteUrl), siteUrl));
  } catch (error) {
    logger.error('job_share_page_error', { error: getErrorMessage(error) });
    return res.status(500).type('html').send(renderSharePageNotFound(siteUrl));
  }
};

const countryNameFromSlug = (slug: string) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

/** The home page, the jobs page and the country pages as plain HTML lists of real open jobs. */
export const getJobListSharePage = async (req: Request, res: Response) => {
  const siteUrl = publicSiteUrl(req);

  try {
    const kind = req.path.includes('/jobs-in/')
      ? 'country'
      : req.path.endsWith('/home')
        ? 'home'
        : req.path.endsWith('/internships')
          ? 'internships'
          : 'jobs';
    const country = kind === 'country' ? countryNameFromSlug(singleValue(req.params.country) || '') : '';

    const rows = await prisma.job.findMany({
      where: {
        ...publicJobWhere(),
        ...(country ? { location: { contains: country } } : {}),
        ...(kind === 'internships' ? { type: { in: [...EARLY_CAREER_TYPES] } } : {}),
      },
      select: seoJobSelect,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const jobs = rows.map((row) => toSeoJob(row as SeoJobRow, siteUrl));

    const page =
      kind === 'country'
        ? {
            heading: `Jobs in ${country}`,
            description: `Browse and apply for real jobs in ${country}. See the pay and location before you apply, and track every application.`,
            intro: `Real jobs from employers you can check in ${country}.`,
            path: `/jobs-in/${req.params.country}`,
          }
        : kind === 'internships'
          ? {
              heading: 'Internships, National Service and graduate jobs in Africa',
              description:
                'Find internships, National Service (NSS) placements, industrial attachments and entry-level graduate jobs. See the stipend, duration and start date up front.',
              intro: 'Early-career opportunities for students, National Service personnel and graduates.',
              path: '/internships',
            }
        : kind === 'jobs'
          ? {
              heading: 'Open jobs across Africa',
              description: 'Browse and apply for real jobs across Africa. See the pay and location before you apply.',
              intro: 'Real jobs from employers you can check, across Africa.',
              path: '/jobs',
            }
          : {
              heading: siteCopy.title,
              description: siteCopy.description,
              intro: siteCopy.crawlerIntro,
              path: '/',
            };

    res.type('html');
    res.set('Cache-Control', 'public, max-age=300');
    return res.send(renderJobListPage({ ...page, jobs, siteUrl }));
  } catch (error) {
    logger.error('job_list_share_page_error', { error: getErrorMessage(error) });
    return res.status(500).type('html').send(renderSharePageNotFound(siteUrl));
  }
};

// Landing pages are made from the live jobs. Building them is cheap but not free, so a short-lived copy is shared.
const LANDING_CACHE_MS = 2 * 60 * 1000;
let landingCache: { at: number; index: LandingIndex } | null = null;

export const resetLandingCache = () => {
  landingCache = null;
};

export const loadLandingIndex = async (): Promise<LandingIndex> => {
  if (landingCache && Date.now() - landingCache.at < LANDING_CACHE_MS) return landingCache.index;

  const rows = await prisma.job.findMany({
    where: publicJobWhere(),
    select: {
      id: true,
      title: true,
      location: true,
      type: true,
      category: true,
      salary: true,
      salaryMin: true,
      createdAt: true,
      employer: { select: { employerProfile: { select: { companyName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const jobs: LandingJob[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    location: row.location,
    type: row.type,
    category: row.category,
    salary: row.salary,
    salaryMin: row.salaryMin,
    createdAt: row.createdAt,
    employerName: row.employer.employerProfile?.companyName || 'A company on JobWahala',
  }));

  const index = buildLandingIndex(jobs);
  landingCache = { at: Date.now(), index };
  return index;
};

/** The page for crawlers: /jobs-in-accra, /banking-jobs, /banking-jobs-in-accra, /jobs-by-location ... */
export const getLandingSharePage = async (req: Request, res: Response) => {
  const siteUrl = publicSiteUrl(req);

  try {
    const page = buildLandingPage(singleValue(req.params.slug) || '', await loadLandingIndex());
    if (!page) return res.status(404).type('html').send(renderLandingNotFound(siteUrl));

    res.type('html');
    res.set('Cache-Control', 'public, max-age=300');
    return res.send(renderLandingPage(page, siteUrl));
  } catch (error) {
    logger.error('landing_page_error', { error: getErrorMessage(error) });
    return res.status(500).type('html').send(renderLandingNotFound(siteUrl));
  }
};

/** The same page as data, for the web app. */
export const getLandingJson = async (req: Request, res: Response) => {
  try {
    const page = buildLandingPage(singleValue(req.params.slug) || '', await loadLandingIndex());
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ success: true, page });
  } catch (error) {
    logger.error('landing_page_error', { error: getErrorMessage(error) });
    return res.status(500).json({ success: false, message: 'Unable to load this page right now' });
  }
};
