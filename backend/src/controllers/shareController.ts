import { Request, Response } from 'express';
import prisma from '../config/prisma';
import env from '../config/env';
import logger from '../config/logger';
import { singleValue } from '../utils/request';
import { getErrorMessage } from '../utils/errors';
import { renderFreelancerSharePage, renderSharePageNotFound } from '../utils/sharePage';

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
