import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import env from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

const resolveToken = (req: AuthRequest, allowQueryToken = false) => {
  const authorizationHeader = req.header('Authorization');
  const headerToken = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.replace('Bearer ', '')
    : authorizationHeader;

  if (headerToken) {
    return headerToken;
  }

  if (!allowQueryToken) {
    return '';
  }

  const queryToken = req.query.token;
  if (typeof queryToken === 'string') {
    return queryToken;
  }

  if (Array.isArray(queryToken) && typeof queryToken[0] === 'string') {
    return queryToken[0];
  }

  return '';
};

const authenticateRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  allowQueryToken = false,
) => {
  const token = resolveToken(req, allowQueryToken);

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { id: string; role: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, status: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account is not active' });
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token is not valid' });
  }
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) =>
  authenticateRequest(req, res, next);

export const authStreamMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) =>
  authenticateRequest(req, res, next, true);

export const roleMiddleware = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
    }
    next();
  };
};
