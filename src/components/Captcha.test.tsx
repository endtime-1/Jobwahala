import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FreelanceWaitlist from './landing/FreelanceWaitlist'
import PhoneCodeFlow from './PhoneCodeFlow'
import ReportModal from './ReportModal'
import TurnstileWidget from './TurnstileWidget'
import Signup from '../pages/Signup'
import { setFeaturesForTests } from '../lib/features'

const SITE_KEY = '1x00000000000000000000AA'

const apiSendPhoneCodeMock = vi.fn()
const apiCreateInterestSignupMock = vi.fn()
const apiCreateReportMock = vi.fn()
const signupMock = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signup: (...args: unknown[]) => signupMock(...args), login: vi.fn(), loginWithPhone: vi.fn(), signupWithPhone: vi.fn() }),
}))

vi.mock('../lib/api', () => ({
  apiSendPhoneCode: (...args: unknown[]) => apiSendPhoneCodeMock(...args),
  apiCreateInterestSignup: (...args: unknown[]) => apiCreateInterestSignupMock(...args),
  apiCreateReport: (...args: unknown[]) => apiCreateReportMock(...args),
}))

type RenderOptions = {
  sitekey: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

// A stand-in for Cloudflare's script: it remembers each widget so a test can "solve" it.
const widgets: RenderOptions[] = []
const turnstile = {
  render: vi.fn((_element: HTMLElement, options: RenderOptions) => {
    widgets.push(options)
    return `widget-${widgets.length}`
  }),
  reset: vi.fn(),
  remove: vi.fn(),
}
const solve = async (token = 'good-token') => {
  await waitFor(() => expect(widgets.length).toBeGreaterThan(0))
  act(() => widgets[widgets.length - 1].callback(token))
}

beforeEach(() => {
  vi.clearAllMocks()
  widgets.length = 0
  ;(window as unknown as { turnstile: typeof turnstile }).turnstile = turnstile
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', SITE_KEY)
  apiSendPhoneCodeMock.mockResolvedValue({ success: true })
  apiCreateInterestSignupMock.mockResolvedValue({ success: true })
  apiCreateReportMock.mockResolvedValue({ success: true })
  signupMock.mockResolvedValue(undefined)
  setFeaturesForTests({ freelanceEnabled: false })
})

afterEach(() => {
  vi.unstubAllEnvs()
  delete (window as unknown as { turnstile?: unknown }).turnstile
})

describe('TurnstileWidget', () => {
  it('draws the Cloudflare check with the site key', async () => {
    render(<TurnstileWidget onToken={vi.fn()} />)

    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1))
    expect(turnstile.render.mock.calls[0][1].sitekey).toBe(SITE_KEY)
    expect(screen.getByTestId('turnstile')).toBeInTheDocument()
  })

  it('passes the token up when solved, and clears it when it expires', async () => {
    const onToken = vi.fn()
    render(<TurnstileWidget onToken={onToken} />)
    await solve('abc')

    expect(onToken).toHaveBeenLastCalledWith('abc')
    act(() => widgets[0]['expired-callback']())
    expect(onToken).toHaveBeenLastCalledWith('')
  })

  it('asks Cloudflare for a fresh check when told to reset', async () => {
    const onToken = vi.fn()
    const { rerender } = render(<TurnstileWidget onToken={onToken} resetSignal={0} />)
    await waitFor(() => expect(turnstile.render).toHaveBeenCalled())

    rerender(<TurnstileWidget onToken={onToken} resetSignal={1} />)

    expect(turnstile.reset).toHaveBeenCalledWith('widget-1')
    expect(onToken).toHaveBeenLastCalledWith('')
  })

  it('cleans up when the form goes away', async () => {
    const { unmount } = render(<TurnstileWidget onToken={vi.fn()} />)
    await waitFor(() => expect(turnstile.render).toHaveBeenCalled())

    unmount()

    expect(turnstile.remove).toHaveBeenCalledWith('widget-1')
  })

  it('says so when the check cannot work', async () => {
    render(<TurnstileWidget onToken={vi.fn()} />)
    await waitFor(() => expect(turnstile.render).toHaveBeenCalled())

    act(() => widgets[0]['error-callback']())

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the security check/i)
  })

  it('draws nothing at all when no site key is set', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')

    const { container } = render(<TurnstileWidget onToken={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
    expect(turnstile.render).not.toHaveBeenCalled()
  })
})

describe('freelance waitlist', () => {
  const fill = () => fireEvent.change(screen.getByLabelText(/email or phone number/i), { target: { value: 'ama@example.com' } })
  const submit = () => screen.getByRole('button', { name: /tell me when it opens/i })

  it('cannot be sent until the check is solved, then sends the token with the sign-up', async () => {
    render(<FreelanceWaitlist />)
    fill()
    expect(submit()).toBeDisabled()

    await solve('waitlist-token')
    expect(submit()).toBeEnabled()
    fireEvent.click(submit())

    await waitFor(() =>
      expect(apiCreateInterestSignupMock).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ama@example.com', source: 'landing_freelance_gigs', captchaToken: 'waitlist-token' }),
      ),
    )
  })

  it('asks for a fresh check after a failure, because a token works once', async () => {
    apiCreateInterestSignupMock.mockRejectedValue(new Error('The security check did not pass. Please try again.'))
    render(<FreelanceWaitlist />)
    fill()
    await solve()

    fireEvent.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent(/security check did not pass/i)
    await waitFor(() => expect(turnstile.reset).toHaveBeenCalled())
    expect(submit()).toBeDisabled()
  })

  it('works as before when the check is switched off', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    render(<FreelanceWaitlist />)
    fill()

    fireEvent.click(submit())

    await waitFor(() => expect(apiCreateInterestSignupMock).toHaveBeenCalled())
    expect(apiCreateInterestSignupMock.mock.calls[0][0]).not.toHaveProperty('captchaToken')
  })
})

describe('phone sign-up and log-in', () => {
  const askForCode = () => fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))

  it('will not text a code until the check is solved, and sends the token with the request', async () => {
    render(<PhoneCodeFlow mode="signup" onDone={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '024 123 4567' } })
    expect(screen.getByRole('button', { name: /text me a code/i })).toBeDisabled()

    await solve('sms-token')
    askForCode()

    await waitFor(() => expect(apiSendPhoneCodeMock).toHaveBeenCalledWith('024 123 4567', 'SIGNUP', 'sms-token'))
  })

  it('needs a new check for every text, including a re-send', async () => {
    render(<PhoneCodeFlow mode="login" onDone={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '024 123 4567' } })
    await solve('first')
    askForCode()
    await waitFor(() => expect(apiSendPhoneCodeMock).toHaveBeenCalledTimes(1))

    // The code step gets a fresh check, and the used token is gone: sending again is locked until it is solved.
    await screen.findByLabelText(/6-digit code/i)
    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: /send a new code|new code in/i })).toBeDisabled()

    await solve('second')
  })
})

describe('reporting a job', () => {
  const openForm = () => {
    render(<ReportModal isOpen onClose={vi.fn()} type="job" targetId="job-1" targetName="Cook at Achiba" />)
    fireEvent.click(screen.getByLabelText('Spam'))
  }
  const submit = () => screen.getByRole('button', { name: /submit report/i })

  it('cannot be submitted until the check is solved, then sends the token', async () => {
    openForm()
    expect(submit()).toBeDisabled()

    await solve('report-token')
    fireEvent.click(submit())

    await waitFor(() => expect(apiCreateReportMock).toHaveBeenCalledWith('job', 'job-1', 'Spam', '', 'report-token'))
  })

  it('works as before when the check is switched off', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    openForm()

    fireEvent.click(submit())

    await waitFor(() => expect(apiCreateReportMock).toHaveBeenCalledWith('job', 'job-1', 'Spam', ''))
  })
})

describe('email sign-up', () => {
  const renderSignup = () =>
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>,
    )
  const fill = () => {
    fireEvent.change(screen.getByPlaceholderText('Kwame Mensah'), { target: { value: 'Ama Mensah' } })
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ama@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'Passw0rd!Passw0rd' } })
  }
  const submit = () => screen.getByRole('button', { name: /create account/i })

  it('cannot be submitted until the check is solved, then sends the token', async () => {
    renderSignup()
    fill()
    expect(submit()).toBeDisabled()

    await solve('signup-token')
    fireEvent.click(submit())

    await waitFor(() => expect(signupMock).toHaveBeenCalledWith('ama@example.com', 'Passw0rd!Passw0rd', 'SEEKER', 'signup-token'))
  })

  it('asks for a fresh check when sign-up fails', async () => {
    signupMock.mockRejectedValue(new Error('The security check did not pass. Please try again.'))
    renderSignup()
    fill()
    await solve()

    fireEvent.click(submit())

    await waitFor(() => expect(turnstile.reset).toHaveBeenCalled())
    expect(await screen.findByText(/security check did not pass/i)).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('works as before when the check is switched off', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    renderSignup()
    fill()

    fireEvent.click(submit())

    await waitFor(() => expect(signupMock).toHaveBeenCalledWith('ama@example.com', 'Passw0rd!Passw0rd', 'SEEKER'))
  })
})
