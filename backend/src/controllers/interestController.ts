import { Request, Response } from 'express';
import prisma from '../config/prisma';
import logger from '../config/logger';
import { normalizePhone } from '../validation/interestSchemas';

export const createInterestSignup = async (req: Request, res: Response) => {
  const { email, phone, source, website } = req.body as {
    email?: string;
    phone?: string;
    source: string;
    website?: string;
  };

  // Bots fill the hidden field. Pretend it worked so they do not retry.
  if (website) return res.status(201).json({ success: true });

  const data = {
    email: email ? email.toLowerCase() : null,
    phone: phone ? normalizePhone(phone) : null,
    source,
  };

  try {
    // Same contact twice is fine: say thanks again, store it once.
    const existing = await prisma.interestSignup.findFirst({
      where: {
        source,
        OR: [...(data.email ? [{ email: data.email }] : []), ...(data.phone ? [{ phone: data.phone }] : [])],
      },
      select: { id: true },
    });
    if (!existing) await prisma.interestSignup.create({ data });
    return res.status(201).json({ success: true });
  } catch (error) {
    logger.error('interest_signup_failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ success: false, message: 'Could not save that. Please try again.' });
  }
};
