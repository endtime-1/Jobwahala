// The only file that imports the Sentry SDK. errorReporting.ts loads it on demand, so none of this
// is downloaded unless error reporting is switched on, and then only after the page is up.
// Named imports, so the bundler can leave out every part of the SDK we do not use.
import {
  captureException,
  dedupeIntegration,
  globalHandlersIntegration,
  init,
  linkedErrorsIntegration,
} from '@sentry/browser'
import { scrubEvent } from './errorScrub'

export type SentryStartOptions = { dsn: string; environment: string; release?: string }

export const startSentry = (options: SentryStartOptions) => {
  init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    // Collect nothing about the person or their requests at the source. scrubEvent below is the second lock.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    // Only the basics: catch uncaught errors and rejections, follow error causes, skip repeats.
    defaultIntegrations: false,
    integrations: [globalHandlersIntegration(), linkedErrorsIntegration(), dedupeIntegration()],
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: () => null,
  })
}

export const sendError = (error: unknown) => {
  captureException(error)
}
