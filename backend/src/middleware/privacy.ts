import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';

export const maskEmail = (email: string) => {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** Returns a copy of the payload with every `email` string replaced by a masked version. */
export const maskEmailsDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(maskEmailsDeep);
  if (!isPlainObject(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = key === 'email' && typeof entry === 'string' ? maskEmail(entry) : maskEmailsDeep(entry);
  }
  return result;
};

const hasValidToken = (req: Request) => {
  const header = req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;
  if (!token) return false;

  try {
    jwt.verify(token, env.jwtSecret);
    return true;
  } catch {
    return false;
  }
};

/**
 * For public (no login) endpoints: visitors without a valid token never receive real email
 * addresses of employers, freelancers or reviewers, so the API cannot be used to harvest them.
 */
export const maskPublicEmails = (req: Request, res: Response, next: NextFunction) => {
  if (hasValidToken(req)) return next();

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(maskEmailsDeep(body))) as Response['json'];
  next();
};
