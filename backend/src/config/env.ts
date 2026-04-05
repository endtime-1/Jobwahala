import dotenv from 'dotenv';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.resolve(projectRoot, '.env') });

const parseNumber = (value: string | undefined, fallback: number) => {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
};

const parseBoolean = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const parseOrigins = (value: string | undefined) =>
  (value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const jwtSecret = process.env.JWT_SECRET || '';
const paymentProvider = (process.env.PAYMENT_PROVIDER || 'SANDBOX').trim().toUpperCase();
const evidenceStorageProvider = (process.env.EVIDENCE_STORAGE_PROVIDER || 'LOCAL').trim().toUpperCase();
const evidenceStorageS3Endpoint = (process.env.EVIDENCE_STORAGE_S3_ENDPOINT || '').trim().replace(/\/$/, '');
const evidenceStorageS3PublicBaseUrl = (process.env.EVIDENCE_STORAGE_S3_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');

if (!jwtSecret && isProduction) {
  throw new Error('JWT_SECRET must be set in production.');
}

if (isProduction && databaseUrl.startsWith('file:')) {
  throw new Error('[CRITICAL JOBWAHALA ERROR] The Railway Backend is missing the DATABASE_URL environment variable and is trying to use local SQLite in Production! Please add DATABASE_URL (postgresql://...) to the Railway Variables tab and redeploy!');
}

const corsAllowedOrigins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);

if (isProduction && corsAllowedOrigins.length === 0) {
  throw new Error('CORS_ALLOWED_ORIGINS must be set in production.');
}

if (!['SANDBOX', 'PAYSTACK'].includes(paymentProvider)) {
  throw new Error('PAYMENT_PROVIDER must be SANDBOX or PAYSTACK.');
}

if (paymentProvider === 'PAYSTACK' && !process.env.PAYSTACK_SECRET_KEY) {
  throw new Error('PAYSTACK_SECRET_KEY must be set when PAYMENT_PROVIDER=PAYSTACK.');
}

if (!['LOCAL', 'S3'].includes(evidenceStorageProvider)) {
  throw new Error('EVIDENCE_STORAGE_PROVIDER must be LOCAL or S3.');
}

if (isProduction && evidenceStorageProvider === 'LOCAL') {
  console.warn('[jobwahala] Production is using local evidence storage. This is only safe for a single-instance deployment.');
}

if (evidenceStorageProvider === 'S3') {
  if (!process.env.EVIDENCE_STORAGE_S3_BUCKET) {
    throw new Error('EVIDENCE_STORAGE_S3_BUCKET must be set when EVIDENCE_STORAGE_PROVIDER=S3.');
  }

  if (!process.env.EVIDENCE_STORAGE_S3_REGION) {
    throw new Error('EVIDENCE_STORAGE_S3_REGION must be set when EVIDENCE_STORAGE_PROVIDER=S3.');
  }

  if (!process.env.EVIDENCE_STORAGE_S3_ACCESS_KEY_ID) {
    throw new Error('EVIDENCE_STORAGE_S3_ACCESS_KEY_ID must be set when EVIDENCE_STORAGE_PROVIDER=S3.');
  }

  if (!process.env.EVIDENCE_STORAGE_S3_SECRET_ACCESS_KEY) {
    throw new Error('EVIDENCE_STORAGE_S3_SECRET_ACCESS_KEY must be set when EVIDENCE_STORAGE_PROVIDER=S3.');
  }

  if (!evidenceStorageS3PublicBaseUrl) {
    throw new Error('EVIDENCE_STORAGE_S3_PUBLIC_BASE_URL must be set when EVIDENCE_STORAGE_PROVIDER=S3.');
  }
}

const smtpHost = process.env.SMTP_HOST || 'localhost';
const smtpPort = parseNumber(process.env.SMTP_PORT, 587);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpFrom = process.env.SMTP_FROM || 'noreply@jobwahala.com';

if (isProduction && !smtpUser) {
  console.warn('[jobwahala] SMTP_USER is not set. Email sending will likely fail in production.');
}

const env = {
  nodeEnv,
  isProduction,
  port: parseNumber(process.env.PORT, 5000),
  databaseUrl,
  jwtSecret: jwtSecret || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-5',
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  frontendBaseUrl: (process.env.FRONTEND_BASE_URL || 'http://localhost:5173').trim().replace(/\/$/, ''),
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
  smtpFrom,
  paymentProvider: paymentProvider as 'SANDBOX' | 'PAYSTACK',
  paymentDefaultCurrency: (process.env.PAYMENT_DEFAULT_CURRENCY || 'GHS').trim().toUpperCase(),
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || '',
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  evidenceStorageProvider: evidenceStorageProvider as 'LOCAL' | 'S3',
  evidenceStorageLocalDir: (process.env.EVIDENCE_STORAGE_LOCAL_DIR || 'uploads').trim() || 'uploads',
  evidenceStoragePrefix: (process.env.EVIDENCE_STORAGE_PREFIX || 'evidence').trim(),
  evidenceStorageS3Bucket: process.env.EVIDENCE_STORAGE_S3_BUCKET || '',
  evidenceStorageS3Region: process.env.EVIDENCE_STORAGE_S3_REGION || '',
  evidenceStorageS3Endpoint,
  evidenceStorageS3PublicBaseUrl,
  evidenceStorageS3AccessKeyId: process.env.EVIDENCE_STORAGE_S3_ACCESS_KEY_ID || '',
  evidenceStorageS3SecretAccessKey: process.env.EVIDENCE_STORAGE_S3_SECRET_ACCESS_KEY || '',
  evidenceStorageS3ForcePathStyle: parseBoolean(
    process.env.EVIDENCE_STORAGE_S3_FORCE_PATH_STYLE,
    Boolean(evidenceStorageS3Endpoint),
  ),
  corsAllowedOrigins,
  trustProxy: parseBoolean(process.env.TRUST_PROXY),
  bodyLimit: process.env.BODY_LIMIT || '8mb',
  requestTimeoutMs: parseNumber(process.env.REQUEST_TIMEOUT_MS, 30000),
  authRateLimitWindowMs: parseNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  authRateLimitMax: parseNumber(process.env.AUTH_RATE_LIMIT_MAX, 20),
  apiRateLimitWindowMs: parseNumber(process.env.API_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  apiRateLimitMax: parseNumber(process.env.API_RATE_LIMIT_MAX, 240),
  logRequests: parseBoolean(process.env.LOG_REQUESTS, !isProduction),
  smileIdPartnerId: process.env.SMILE_ID_PARTNER_ID || '',
  smileIdApiKey: process.env.SMILE_ID_API_KEY || '',
  smileIdServer: process.env.SMILE_ID_SERVER || '0', // 0 for sandbox, 1 for production
  platformFeePercentage: parseNumber(process.env.PLATFORM_FEE_PERCENTAGE, 5),
  payoutHoldDurationHours: parseNumber(process.env.PAYOUT_HOLD_DURATION_HOURS, 24),
} as const;

export default env;
