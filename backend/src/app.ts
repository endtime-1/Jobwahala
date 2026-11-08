import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import prisma from './config/prisma';
import env from './config/env';
import logger from './config/logger';
import { getLocalEvidenceUploadsDir, isLocalEvidenceStorage } from './services/evidenceStorage';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import jobRoutes from './routes/jobRoutes';
import serviceRoutes from './routes/serviceRoutes';
import messageRoutes from './routes/messageRoutes';
import cvRoutes from './routes/cvRoutes';
import adminRoutes from './routes/adminRoutes';
import reportRoutes from './routes/reportRoutes';
import agreementRoutes from './routes/agreementRoutes';
import proposalRoutes from './routes/proposalRoutes';
import notificationRoutes from './routes/notificationRoutes';
import paymentRoutes from './routes/paymentRoutes';
import uploadRoutes from './routes/uploadRoutes';
import realtimeRoutes from './routes/realtimeRoutes';
import platformRoutes from './routes/platformRoutes';
import verificationRoutes from './routes/verificationRoutes';
import payoutRoutes from './routes/payoutRoutes';
import disputeRoutes from './routes/disputeRoutes';
import shareRoutes from './routes/shareRoutes';
import savedSearchRoutes from './routes/savedSearchRoutes';
import companyRoutes from './routes/companyRoutes';
import interestRoutes from './routes/interestRoutes';
import applicationRoutes from './routes/applicationRoutes';
import savedJobRoutes from './routes/savedJobRoutes';
import courseRoutes from './routes/courseRoutes';
import billingRoutes from './routes/billingRoutes';
import { claimRouter, growthRouter } from './routes/acquisitionRoutes';
import { hiringRouter, recruiterRouter } from './routes/hiringRoutes';
import teamRoutes from './routes/teamRoutes';
import cvDatabaseRoutes from './routes/cvDatabaseRoutes';
import planFeatureRoutes from './routes/planFeatureRoutes';
import providerRoutes from './routes/providerRoutes';
import learnerCourseRoutes from './routes/learnerCourseRoutes';
import { requireFreelanceEnabled } from './middleware/featureFlags';
import { Sentry } from './config/sentry';
import {
  createRateLimit,
  notFoundHandler,
  requestContextMiddleware,
  requestLoggerMiddleware,
  securityHeadersMiddleware,
  strictAiRateLimit,
} from './middleware/security';

const app = express();
const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (!env.isProduction && env.corsAllowedOrigins.length === 0) {
      callback(null, true);
      return;
    }

    if (env.corsAllowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (origin.endsWith('.up.railway.app')) {
      callback(null, true);
      return;
    }

    const error = new Error('Origin is not allowed by CORS') as Error & { status?: number };
    error.status = 403;
    callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
};

const authRateLimit = createRateLimit({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  scope: 'auth',
});

const apiRateLimit = createRateLimit({
  windowMs: env.apiRateLimitWindowMs,
  max: env.apiRateLimitMax,
  scope: 'api',
  skip: (req) =>
    req.path === '/health' ||
    req.path === '/ready' ||
    req.path.startsWith('/payments/webhooks') ||
    req.path.startsWith('/billing/webhooks'),
});

app.disable('x-powered-by');

if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(requestContextMiddleware);
app.use(requestLoggerMiddleware);
app.use(securityHeadersMiddleware);
app.use((req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const nextBody = { ...(body as Record<string, unknown>) };

      if (!('requestId' in nextBody)) {
        nextBody.requestId = res.locals.requestId;
      }

      if (env.isProduction && res.statusCode >= 500 && 'message' in nextBody) {
        nextBody.message = 'Internal Server Error';
      }

      return originalJson(nextBody);
    }

    return originalJson(body as any);
  }) as Response['json'];

  next();
});
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'JobWahala API',
    environment: env.nodeEnv,
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'ok',
    environment: env.nodeEnv,
  });
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.json({ success: true, status: 'ready' });
  } catch (error) {
    logger.error('readiness_check_failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(503).json({ success: false, status: 'not_ready' });
  }
});

app.use(cors(corsOptions));
// Paystack signs the exact bytes it sends, so the billing webhook keeps them.
app.use(
  express.json({
    limit: env.bodyLimit,
    verify: (req, _res, buffer) => {
      if ((req.url ?? '').startsWith('/api/billing/webhooks/')) (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));

if (isLocalEvidenceStorage) {
  // Only company logos are public. Verification, dispute and message files are never served as open
  // static files: they go through the signed-link route in uploadRoutes.
  app.use(
    '/api/uploads/logo',
    express.static(path.join(getLocalEvidenceUploadsDir(), 'logo'), {
      index: false,
      dotfiles: 'deny',
      maxAge: '1d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );
}
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api', apiRateLimit);
app.use('/api/uploads', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
// Freelance features are switched off by FREELANCE_ENABLED=false (the default). The guard runs before the routers.
const freelanceOnly = requireFreelanceEnabled();
const freelanceOnlyExceptWebhooks = requireFreelanceEnabled({ allow: (req) => req.path.startsWith('/webhooks/') });
app.use('/api/services', freelanceOnly, serviceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/cv', strictAiRateLimit, cvRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/agreements', freelanceOnly, agreementRoutes);
app.use('/api/disputes', freelanceOnly, disputeRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/saved-searches', savedSearchRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/proposals', freelanceOnly, proposalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', freelanceOnlyExceptWebhooks, paymentRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/interest', interestRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/saved-jobs', savedJobRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/claims', claimRouter);
app.use('/api/growth', growthRouter);
app.use('/api/hiring', hiringRouter);
app.use('/api/recruiter', recruiterRouter);
app.use('/api/cv-database', cvDatabaseRoutes);
app.use('/api', planFeatureRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/learner/courses', learnerCourseRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/payouts', freelanceOnly, payoutRoutes);

app.use(notFoundHandler);

// Reports unexpected server errors to Sentry (when it is on), then hands on to the handler below.
Sentry.setupExpressErrorHandler(app);

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  const internalMessage = err instanceof Error ? err.message : String(err);

  logger.error('request_failed', {
    requestId: res.locals.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    error: internalMessage,
    stack: err?.stack,
  });

  res.status(status).json({
    success: false,
    message: env.isProduction && status >= 500 ? 'Internal Server Error' : internalMessage,
    requestId: res.locals.requestId,
  });
});

export default app;
