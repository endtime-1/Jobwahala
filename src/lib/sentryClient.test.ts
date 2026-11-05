import { beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  globalHandlersIntegration: vi.fn(() => ({ name: 'GlobalHandlers' })),
  linkedErrorsIntegration: vi.fn(() => ({ name: 'LinkedErrors' })),
  dedupeIntegration: vi.fn(() => ({ name: 'Dedupe' })),
}))

vi.mock('@sentry/browser', () => sentry)

import { sendError, startSentry } from './sentryClient'

const start = () => {
  startSentry({ dsn: 'https://key@o1.ingest.sentry.io/1', environment: 'production', release: 'abc' })
  return sentry.init.mock.calls[0][0]
}

describe('the Sentry client configuration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('collects no personal data at the source and sends no breadcrumbs or traces', () => {
    const options = start()

    expect(options).toMatchObject({
      dsn: 'https://key@o1.ingest.sentry.io/1',
      environment: 'production',
      release: 'abc',
      tracesSampleRate: 0,
      maxBreadcrumbs: 0,
    })
    expect(options.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    })
    expect(options.beforeBreadcrumb({ message: 'clicked "Sign in" as ama@example.com' })).toBeNull()
  })

  it('turns on only the three small integrations it needs: no replay, no breadcrumbs, no page tracing', () => {
    const options = start()

    expect(options.defaultIntegrations).toBe(false)
    expect(options.integrations.map((integration: { name: string }) => integration.name)).toEqual(['GlobalHandlers', 'LinkedErrors', 'Dedupe'])
  })

  it('scrubs every report before it is sent', () => {
    const sent = start().beforeSend({
      message: 'Failed for ama@example.com on 024 123 4567',
      user: { id: 'u1', email: 'ama@example.com' },
      request: { url: 'https://jobwahala.com/reset-password?token=abc', cookies: { a: 'b' } },
    })

    expect(sent.message).toBe('Failed for [email] on [phone]')
    expect(sent.user).toEqual({ id: 'u1' })
    expect(sent.request).toEqual({ url: 'https://jobwahala.com/reset-password' })
  })

  it('passes errors on to Sentry', () => {
    const error = new Error('boom')

    sendError(error)

    expect(sentry.captureException).toHaveBeenCalledWith(error)
  })
})
