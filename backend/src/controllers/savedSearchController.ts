import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { singleValue } from '../utils/request';
import { getErrorMessage } from '../utils/errors';
import { criteriaKey } from '../utils/jobAlerts';

export const MAX_SAVED_SEARCHES = 10;

const publicFields = {
  id: true,
  query: true,
  location: true,
  jobType: true,
  emailAlerts: true,
  createdAt: true,
} as const;

export const listSavedSearches = async (req: AuthRequest, res: Response) => {
  try {
    const savedSearches = await prisma.savedSearch.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      select: publicFields,
    });

    return res.json({ success: true, savedSearches, limit: MAX_SAVED_SEARCHES });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const createSavedSearch = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { query, location, jobType, emailAlerts } = req.body as {
      query?: string;
      location?: string;
      jobType?: string;
      emailAlerts?: boolean;
    };

    const existing = await prisma.savedSearch.findMany({
      where: { userId },
      select: { query: true, location: true, jobType: true },
    });

    if (existing.length >= MAX_SAVED_SEARCHES) {
      return res.status(409).json({
        success: false,
        message: `You can keep up to ${MAX_SAVED_SEARCHES} job alerts. Remove one to add another.`,
      });
    }

    const key = criteriaKey({ query, location, jobType });
    if (existing.some((search) => criteriaKey(search) === key)) {
      return res.status(409).json({ success: false, message: 'You already have an alert for this search.' });
    }

    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId,
        query: query || null,
        location: location || null,
        jobType: jobType || null,
        emailAlerts: emailAlerts ?? true,
      },
      select: publicFields,
    });

    return res.status(201).json({ success: true, savedSearch });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const updateSavedSearch = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id);
    const { emailAlerts } = req.body as { emailAlerts: boolean };

    const result = await prisma.savedSearch.updateMany({
      where: { id, userId: req.user!.id },
      data: { emailAlerts },
    });

    if (result.count === 0) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const deleteSavedSearch = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id);

    const result = await prisma.savedSearch.deleteMany({ where: { id, userId: req.user!.id } });

    if (result.count === 0) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
