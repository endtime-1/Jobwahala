import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

const parseEnvFile = (relativePath) => {
  const fullPath = path.resolve(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    return { fullPath, values: null };
  }

  const values = {};
  const content = fs.readFileSync(fullPath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return { fullPath, values };
};

const failures = [];
const warnings = [];

const requireValue = (sourceName, values, key) => {
  const value = values?.[key]?.trim();
  if (!value) failures.push(`${sourceName}: missing ${key}`);
  return value || '';
};

const checkWeakSecret = (label, value, minLength) => {
  if (!value) return;

  const weakMarkers = ['replace-me', 'change-me', 'example', 'dev-secret', 'mvpsecret', 'your-super-secret'];
  if (value.length < minLength || weakMarkers.some((marker) => value.toLowerCase().includes(marker))) {
    failures.push(`${label}: value is too weak for production`);
  }
};

const vpsEnvPath = process.env.JOBWAHALA_VPS_ENV_PATH || '.env.vps';
const backendEnvPath = process.env.JOBWAHALA_BACKEND_ENV_PATH || path.join('backend', '.env');

const vpsEnv = parseEnvFile(vpsEnvPath);
const backendEnv = parseEnvFile(backendEnvPath);

if (!vpsEnv.values) failures.push(`Missing ${vpsEnv.fullPath}`);
if (!backendEnv.values) failures.push(`Missing ${backendEnv.fullPath}`);

const domain = requireValue('.env.vps', vpsEnv.values, 'DOMAIN');
const letsEncryptEmail = requireValue('.env.vps', vpsEnv.values, 'LETSENCRYPT_EMAIL');
const postgresPassword = requireValue('.env.vps', vpsEnv.values, 'POSTGRES_PASSWORD');

const jwtSecret = requireValue('backend/.env', backendEnv.values, 'JWT_SECRET');
const corsAllowedOrigins = requireValue('backend/.env', backendEnv.values, 'CORS_ALLOWED_ORIGINS');
const nodeEnv = requireValue('backend/.env', backendEnv.values, 'NODE_ENV');
const evidenceStorageProvider = (backendEnv.values?.EVIDENCE_STORAGE_PROVIDER || 'LOCAL').trim().toUpperCase();
const evidenceStoragePublicBaseUrl = backendEnv.values?.EVIDENCE_STORAGE_S3_PUBLIC_BASE_URL?.trim() || '';

checkWeakSecret('POSTGRES_PASSWORD', postgresPassword, 16);
checkWeakSecret('JWT_SECRET', jwtSecret, 24);

if (domain.startsWith('http://') || domain.startsWith('https://')) {
  failures.push('DOMAIN: use the bare host only, without http:// or https://');
}

if (letsEncryptEmail && !letsEncryptEmail.includes('@')) {
  failures.push('LETSENCRYPT_EMAIL: must be a valid email address');
}

if (nodeEnv && nodeEnv !== 'production') {
  failures.push('backend/.env: NODE_ENV must be production for VPS deploys');
}

if (domain && corsAllowedOrigins && !corsAllowedOrigins.split(',').map((value) => value.trim()).includes(`https://${domain}`)) {
  failures.push(`backend/.env: CORS_ALLOWED_ORIGINS must include https://${domain}`);
}

if (backendEnv.values?.DATABASE_URL && !backendEnv.values.DATABASE_URL.startsWith('file:')) {
  warnings.push('backend/.env: DATABASE_URL is set, but docker-compose.vps.yml overrides it. Keep this file focused on app secrets.');
}

if (!backendEnv.values?.ADMIN_EMAIL || !backendEnv.values?.ADMIN_PASSWORD) {
  warnings.push('backend/.env: ADMIN_EMAIL or ADMIN_PASSWORD is missing. Admin bootstrap will require explicit values later.');
}

if (!['LOCAL', 'S3'].includes(evidenceStorageProvider)) {
  failures.push('backend/.env: EVIDENCE_STORAGE_PROVIDER must be LOCAL or S3');
}

if (evidenceStorageProvider === 'LOCAL') {
  warnings.push('backend/.env: EVIDENCE_STORAGE_PROVIDER=LOCAL is acceptable for a single VPS because docker-compose.vps.yml now persists /app/uploads on a named volume. Use S3 for off-host object storage.');
}

if (evidenceStorageProvider === 'S3') {
  const requiredS3Keys = [
    'EVIDENCE_STORAGE_S3_BUCKET',
    'EVIDENCE_STORAGE_S3_REGION',
    'EVIDENCE_STORAGE_S3_PUBLIC_BASE_URL',
    'EVIDENCE_STORAGE_S3_ACCESS_KEY_ID',
    'EVIDENCE_STORAGE_S3_SECRET_ACCESS_KEY',
  ];

  for (const key of requiredS3Keys) {
    requireValue('backend/.env', backendEnv.values, key);
  }

  if (evidenceStoragePublicBaseUrl && !/^https?:\/\//i.test(evidenceStoragePublicBaseUrl)) {
    failures.push('backend/.env: EVIDENCE_STORAGE_S3_PUBLIC_BASE_URL must start with http:// or https://');
  }
}

if (failures.length > 0) {
  console.error('VPS deploy preflight failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  if (warnings.length > 0) {
    console.error('\nWarnings:');
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

console.log('VPS deploy preflight passed.');
console.log(`- DOMAIN=${domain}`);
console.log(`- LETSENCRYPT_EMAIL=${letsEncryptEmail}`);
console.log(`- backend/.env NODE_ENV=${nodeEnv}`);
console.log(`- backend/.env EVIDENCE_STORAGE_PROVIDER=${evidenceStorageProvider}`);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
}
