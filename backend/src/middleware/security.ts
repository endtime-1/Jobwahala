import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import env from '../config/env';
import logger from '../config/logger';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  scope: string;
  skip?: (req: Request) => boolean;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const getRequestId = (req: Request) => {
  const headerValue = req.header('X-Request-Id');
  return headerValue && headerValue.trim() ? headerValue.trim() : randomUUID();
};

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = getRequestId(req);
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};

export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!env.logRequests) {
    next();
    return;
  }

  const startedAt = Date.now();

  res.on('finish', () => {
    logger.info('request_completed', {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
    });
  });

  next();
};

export const securityHeadersMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  if (env.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

export const createRateLimit = ({ windowMs, max, scope, skip }: RateLimitOptions) => {
  const store = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip?.(req)) {
      next();
      return;
    }

    const now = Date.now();
    const key = `${scope}:${req.ip}`;
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        requestId: res.locals.requestId,
      });
      return;
    }

    current.count += 1;
    store.set(key, current);
    next();
  };
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: res.locals.requestId,
  });
};

export const strictAiRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 AI generations per hour
  scope: 'ai',
});
