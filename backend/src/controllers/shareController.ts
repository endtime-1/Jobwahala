import { Request, Response } from 'express';
import prisma from '../config/prisma';
import env from '../config/env';
import logger from '../config/logger';
import { singleValue } from '../utils/request';
import { getErrorMessage } from '../utils/errors';
import { renderFreelancerSharePage, renderSharePageNotFound } from '../utils/sharePage';
import {
  buildSitemapXml,
  countryEntries,
  resolvePublicBaseUrl,
  staticSitemapPaths,
  type SitemapEntry,
} from '../utils/sitemap';

/**
 * Server-rendered preview for link crawlers (WhatsApp, Facebook, X, LinkedIn, Telegram).
 * They do not run JavaScript, so the React app cannot supply per-profile OpenGraph tags.
 */
export const getFreelancerSharePage = async (req: Request, res: Response) => {
  const siteUrl = env.frontendBaseUrl;

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
      where: { status: 'ACTIVE' },
      select: { id: true, employerId: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    });

    const companyIds = [...new Set(jobs.map((job) => job.employerId))];

    const entries: SitemapEntry[] = [
      ...staticSitemapPaths,
      ...countryEntries(),
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
