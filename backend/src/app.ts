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
import {
  createRateLimit,
  notFoundHandler,
  requestContextMiddleware,
  requestLoggerMiddleware,
  securityHeadersMiddleware,
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
    req.path.startsWith('/payments/webhooks'),
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
app.use(cors(corsOptions));
app.use(express.json({ limit: env.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));

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

if (isLocalEvidenceStorage) {
  app.use('/api/uploads', express.static(getLocalEvidenceUploadsDir()));
}
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api', apiRateLimit);
app.use('/api/uploads', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/platform', platformRoutes);

app.use(notFoundHandler);

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  const message =
    status >= 500 && env.isProduction
      ? 'Internal Server Error'
      : err?.message || 'Internal Server Error';

  logger.error('request_failed', {
    requestId: res.locals.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    error: err instanceof Error ? err.message : String(err),
  });

  res.status(status).json({
    success: false,
    message,
    requestId: res.locals.requestId,
  });
});

export default app;
