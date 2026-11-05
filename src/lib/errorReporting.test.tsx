import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from '../components/ErrorBoundary'
import { scrubEvent, scrubString } from './errorScrub'

const startSentry = vi.fn()
const sendError = vi.fn()

vi.mock('./sentryClient', () => ({
  startSentry: (...args: unknown[]) => startSentry(...args),
  sendError: (...args: unknown[]) => sendError(...args),
}))

import {
  installEarlyErrorCapture,
  isErrorReportingConfigured,
  reportError,
  resetErrorReportingForTests,
  startErrorReporting,
} from './errorReporting'

// These tests fire fake browser errors. Mark them handled so the test runner does not count them as real crashes.
const markHandled = (event: Event) => event.preventDefault()

beforeEach(() => {
  vi.clearAllMocks()
  resetErrorReportingForTests()
  window.addEventListener('error', markHandled)
  window.addEventListener('unhandledrejection', markHandled)
})

afterEach(() => {
  vi.unstubAllEnvs()
  window.removeEventListener('error', markHandled)
  window.removeEventListener('unhandledrejection', markHandled)
})

describe('error reporting is off until a DSN is set', () => {
  it('loads nothing and reports nothing without a DSN', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')

    expect(isErrorReportingConfigured()).toBe(false)
    expect(await startErrorReporting()).toBe(false)
    reportError(new Error('boom'))

    expect(startSentry).not.toHaveBeenCalled()
    expect(sendError).not.toHaveBeenCalled()
  });

  it('does not even listen for early crashes without a DSN', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')
    installEarlyErrorCapture()

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('early'), message: 'early' }))
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1')
    await startErrorReporting()

    expect(sendError).not.toHaveBeenCalled()
  })
})

describe('error reporting when it is on', () => {
  beforeEach(() => vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1'))

  it('starts with the DSN and environment, once', async () => {
    expect(await startErrorReporting()).toBe(true)
    expect(await startErrorReporting()).toBe(true)

    expect(startSentry).toHaveBeenCalledTimes(1)
    expect(startSentry).toHaveBeenCalledWith(expect.objectContaining({ dsn: 'https://key@o1.ingest.sentry.io/1', environment: expect.any(String) }))
  })

  it('sends errors reported after it has started', async () => {
    await startErrorReporting()
    const error = new Error('render crash')

    reportError(error)

    expect(sendError).toHaveBeenCalledWith(error)
  })

  it('keeps crashes from before it loaded and sends them once it starts, in order', async () => {
    installEarlyErrorCapture()
    const first = new Error('first')
    window.dispatchEvent(new ErrorEvent('error', { error: first, message: 'first' }))
    const reason = new Error('second')
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(rejection, 'reason', { value: reason })
    window.dispatchEvent(rejection)

    expect(sendError).not.toHaveBeenCalled()
    await startErrorReporting()

    expect(sendError.mock.calls.map((call) => call[0])).toEqual([first, reason])
  })

  it('does not hoard more than ten early errors', async () => {
    for (let i = 0; i < 25; i += 1) reportError(new Error(`e${i}`))

    await startErrorReporting()

    expect(sendError).toHaveBeenCalledTimes(10)
  })

  it('stops listening for early errors once Sentry has taken over', async () => {
    installEarlyErrorCapture()
    await startErrorReporting()
    sendError.mockClear()

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('later'), message: 'later' }))

    expect(sendError).not.toHaveBeenCalled()
  })
})

describe('the personal-data scrubber (browser copy)', () => {
  it('removes emails, phones, tokens and one-time codes from text', () => {
    expect(scrubString('mail ama@example.com or call +233 24 123 4567')).toBe('mail [email] or call [phone]')
    expect(scrubString('Bearer abcdef1234567890xyz')).toBe('Bearer [token]')
    expect(scrubString('Your code is 482913')).toBe('Your code is [code]')
  })

  it('keeps what broke and drops who it happened to', () => {
    const out = scrubEvent({
      user: { id: 'u1', email: 'ama@example.com', ip_address: '1.2.3.4' },
      request: { method: 'GET', url: 'https://x/y?token=1', headers: { cookie: 'a=b' } },
      exception: { values: [{ type: 'TypeError', value: 'bad for ama@example.com', stacktrace: { frames: [{ function: 'f', lineno: 1, vars: { password: 'x' } }] } }] },
      breadcrumbs: [{ message: 'ama@example.com' }],
    }) as any

    expect(out.user).toEqual({ id: 'u1' })
    expect(out.request).toEqual({ method: 'GET', url: 'https://x/y' })
    expect(out.exception.values[0]).toMatchObject({ type: 'TypeError', value: 'bad for [email]' })
    expect(out.exception.values[0].stacktrace.frames[0]).toEqual({ function: 'f', lineno: 1 })
    expect(out.breadcrumbs).toBeUndefined()
    expect(JSON.stringify(out)).not.toMatch(/ama@example|1\.2\.3\.4|password/)
  })
})

describe('ErrorBoundary', () => {
  const Crash = () => {
    throw new Error('render crash for ama@example.com')
  }

  beforeEach(() => vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1'))

  it('shows the page normally when nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('replaces a crashed page with a plain way out, and reports the crash', async () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await startErrorReporting()

    render(
      <ErrorBoundary>
        <Crash />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
    expect(screen.getByRole('link', { name: /home page/i })).toHaveAttribute('href', '/')
    expect(sendError).toHaveBeenCalledTimes(1)
    expect((sendError.mock.calls[0][0] as Error).message).toMatch(/render crash/)
    silence.mockRestore()
  })

  it('offers to reload', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true })

    render(
      <ErrorBoundary>
        <Crash />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: /reload the page/i }))

    expect(reload).toHaveBeenCalled()
    silence.mockRestore()
  })
})
