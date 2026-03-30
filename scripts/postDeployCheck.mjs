const rawTarget = process.argv[2] || process.env.DEPLOY_URL || '';

if (!rawTarget) {
  console.error('Usage: node scripts/postDeployCheck.mjs https://your-domain');
  process.exit(1);
}

const baseUrl = rawTarget.startsWith('http://') || rawTarget.startsWith('https://')
  ? rawTarget.replace(/\/$/, '')
  : `https://${rawTarget.replace(/\/$/, '')}`;

const checks = [
  { name: 'Landing page', path: '/', expectedStatus: 200 },
  { name: 'Health endpoint', path: '/health', expectedStatus: 200 },
  { name: 'Readiness endpoint', path: '/ready', expectedStatus: 200 },
  { name: 'Public jobs API', path: '/api/jobs', expectedStatus: 200, expectJson: true },
  { name: 'Public services API', path: '/api/services', expectedStatus: 200, expectJson: true },
];

for (const check of checks) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    headers: {
      Accept: check.expectJson ? 'application/json' : 'text/html',
    },
  });

  if (response.status !== check.expectedStatus) {
    throw new Error(`${check.name} failed with status ${response.status}`);
  }

  if (check.expectJson) {
    const data = await response.json();
    if (typeof data !== 'object' || data === null) {
      throw new Error(`${check.name} did not return JSON`);
    }
  } else {
    const html = await response.text();
    if (!html.toLowerCase().includes('<html')) {
      throw new Error(`${check.name} did not return HTML`);
    }

    const hsts = response.headers.get('strict-transport-security');
    if (!hsts) {
      throw new Error(`${check.name} is missing Strict-Transport-Security`);
    }
  }

  console.log(`OK: ${check.name}`);
}

console.log(`Post-deploy verification passed for ${baseUrl}`);
