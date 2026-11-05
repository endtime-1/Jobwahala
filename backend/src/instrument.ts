// Imported first by index.ts so error reporting is ready before anything else loads.
import env from './config/env';
import { initSentry } from './config/sentry';

initSentry({
  dsn: env.sentryDsn,
  environment: env.nodeEnv,
  release: env.sentryRelease || undefined,
});
