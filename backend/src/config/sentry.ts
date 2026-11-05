import * as Sentry from '@sentry/node';
import { scrubEvent } from '../utils/errorScrub';

export type SentrySettings = {
  dsn: string;
  environment: string;
  release?: string;
};

let started = false;

/**
 * Turns on error reporting, if a DSN is set. Without one this does nothing at all, so local runs and
 * tests never send anything. Every event passes through scrubEvent before it leaves the server.
 */
export const initSentry = (settings: SentrySettings): boolean => {
  if (!settings.dsn) return false;

  Sentry.init({
    dsn: settings.dsn,
    environment: settings.environment,
    release: settings.release,
    // Collect nothing about the person or their requests at the source. scrubEvent below is the second lock.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    },
    // Errors only: no performance traces, and no breadcrumbs (they record personal text).
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: () => null,
  });

  started = true;
  return true;
};

export const isSentryOn = () => started;

/** Report an error we caught ourselves (most controllers answer with a 500 instead of throwing). */
export const reportError = (error: unknown) => {
  if (!started || !(error instanceof Error)) return;

  // Expected failures are the caller's fault, not ours: a wrong id, a failed validation, a conflict.
  const status = (error as { status?: number; statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode;
  if (typeof status === 'number' && status < 500) return;
  if (error.name === 'ZodError') return;

  Sentry.captureException(error);
};

export { Sentry };
