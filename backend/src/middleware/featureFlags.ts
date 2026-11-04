import { NextFunction, Request, Response } from 'express';
import env from '../config/env';

export const FREELANCE_DISABLED_MESSAGE = 'Freelance gigs are not open yet. Leave your email on the home page and we will tell you when they are.';

/**
 * Blocks a route group while FREELANCE_ENABLED is off. Pass `allow` for paths that must keep working,
 * such as the signed payment-provider webhook (it only acknowledges payments that already exist).
 */
export const requireFreelanceEnabled =
  (options: { isEnabled?: () => boolean; allow?: (req: Request) => boolean } = {}) =>
  (req: Request, res: Response, next: NextFunction) => {
    const isEnabled = options.isEnabled ?? (() => env.freelanceEnabled);
    if (isEnabled() || options.allow?.(req)) {
      next();
      return;
    }

    res.status(404).json({ success: false, code: 'FREELANCE_DISABLED', message: FREELANCE_DISABLED_MESSAGE });
  };
