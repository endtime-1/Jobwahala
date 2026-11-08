import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { whatsappContactLink } from '../lib/flyer'
import { rememberReferral, takeReferral, weekRangeLabel } from '../lib/growth'

const api = vi.hoisted(() => ({
  getClaim: vi.fn(),
  acceptClaim: vi.fn(),
  referral: vi.fn(),
  attachReferral: vi.fn(),
  weekly: vi.fn(),
  getCompany: vi.fn(),
  updateProfile: vi.fn(),
}))
const auth = vi.hoisted(() => ({ login: vi.fn(), refreshUser: vi.fn(), user: { id: 'emp-1', role: 'EMPLOYER', email: 'a@b.com' } as Record<string, unknown> }))

vi.mock('../lib/api', () => ({
  apiGetClaim: (...a: unknown[]) => api.getClaim(...a),
  apiAcceptClaim: (...a: unknown[]) => api.acceptClaim(...a),
  apiGetMyReferral: (...a: unknown[]) => api.referral(...a),
  apiAttachReferral: (...a: unknown[]) => api.attachReferral(...a),
  apiGetWeeklyReport: (...a: unknown[]) => api.weekly(...a),
  apiGetCompany: (...a: unknown[]) => api.getCompany(...a),
  apiUpdateProfile: (...a: unknown[]) => api.updateProfile(...a),
}))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: auth.login, refreshUser: auth.refreshUser, user: auth.user, role: auth.user.role, signup: vi.fn() }),
}))

import ClaimCompany from './ClaimCompany'
import CompanyProfile from './CompanyProfile'
import EmployerFlyer from './EmployerFlyer'
import Onboarding from './Onboarding'
import Signup from './Signup'
import ReferralPanel from '../components/ReferralPanel'
import WeeklyReportPanel from '../components/WeeklyReportPanel'

vi.mock('../components/GoogleSignIn', () => ({ default: () => null }))
vi.mock('../components/TurnstileWidget', () => ({ default: () => null }))
vi.mock('../components/PhoneCodeFlow', () => ({ default: () => null }))

const wrap = (ui: React.ReactElement, path = '/', route = '/') =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={ui} />
          <Route path="/dashboard" element={<p>Dashboard page</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
afterEach(() => vi.unstubAllEnvs())

describe('the claim page', () => {
  const preview = { company: { name: 'Akoko Solutions', industry: 'Production' }, openJobs: 2, applicants: 7, emailHint: 'owner@akoko.com' }

  it('shows the company and what is waiting, with the email the link was sent to filled in', async () => {
    api.getClaim.mockResolvedValue(preview)
    wrap(<ClaimCompany />, '/claim/' + 't'.repeat(64), '/claim/:token')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Take over Akoko Solutions')
    expect(screen.getByText('2 open jobs')).toBeInTheDocument()
    expect(screen.getByText('7 applicants waiting')).toBeInTheDocument()
    expect(screen.getByLabelText('Your email')).toHaveValue('owner@akoko.com')
    expect(api.getClaim).toHaveBeenCalledWith('t'.repeat(64))
  })

  it('takes the company over with the chosen email and password, then signs the owner in', async () => {
    api.getClaim.mockResolvedValue(preview)
    api.acceptClaim.mockResolvedValue({ token: 'jwt' })
    auth.login.mockResolvedValue(undefined)
    wrap(<ClaimCompany />, '/claim/abc-claim-token-1234567890', '/claim/:token')

    await screen.findByLabelText('Your email')
    fireEvent.change(screen.getByLabelText('Choose a password'), { target: { value: 'a-strong-password' } })
    fireEvent.click(screen.getByRole('button', { name: /take over akoko solutions/i }))

    await waitFor(() => expect(api.acceptClaim).toHaveBeenCalledWith('abc-claim-token-1234567890', { email: 'owner@akoko.com', password: 'a-strong-password' }))
    expect(auth.login).toHaveBeenCalledWith('owner@akoko.com', 'a-strong-password')
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument()
  })

  it('shows the reason when the link is expired, cancelled or already used, and no form', async () => {
    api.getClaim.mockRejectedValue(new Error('This link has expired. Ask JobWahala to send you a new one.'))
    wrap(<ClaimCompany />, '/claim/abc-claim-token-1234567890', '/claim/:token')

    expect(await screen.findByRole('alert')).toHaveTextContent('This link has expired.')
    expect(screen.queryByLabelText('Choose a password')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })

  it('shows a problem from the server, such as an email already in use, and stays on the page', async () => {
    api.getClaim.mockResolvedValue(preview)
    api.acceptClaim.mockRejectedValue(new Error('There is already an account with that email.'))
    wrap(<ClaimCompany />, '/claim/abc-claim-token-1234567890', '/claim/:token')

    await screen.findByLabelText('Your email')
    fireEvent.change(screen.getByLabelText('Choose a password'), { target: { value: 'a-strong-password' } })
    fireEvent.click(screen.getByRole('button', { name: /take over akoko solutions/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('There is already an account with that email.')
    expect(auth.login).not.toHaveBeenCalled()
  })
})

describe('the printable employer flyer', () => {
  it('has a headline, the benefits, and two QR codes: post a job, and WhatsApp', async () => {
    vi.stubEnv('VITE_WHATSAPP_CONTACT_NUMBER', '+233 24 123 4567')
    wrap(<EmployerFlyer />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hiring? Post your job free.')
    expect(screen.getByText(/Posting a job is free/)).toBeInTheDocument()

    const post = await screen.findByRole('img', { name: 'Scan to post a job on JobWahala' })
    expect(post.getAttribute('data-qr-value')).toBe('https://www.jobwahala.com/signup?role=employer&utm_source=flyer&utm_medium=print&utm_campaign=employer_flyer')
    const chat = await screen.findByRole('img', { name: 'Message us on WhatsApp' })
    expect(chat.getAttribute('data-qr-value')).toMatch(/^https:\/\/wa\.me\/233241234567\?text=/)
    expect(post.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
  })

  it('falls back to the WhatsApp channel when no WhatsApp number is set, so no code is missing', async () => {
    vi.stubEnv('VITE_WHATSAPP_CONTACT_NUMBER', '')
    wrap(<EmployerFlyer />)

    const channel = await screen.findByRole('img', { name: 'Follow our WhatsApp channel' })
    expect(channel.getAttribute('data-qr-value')).toContain('whatsapp.com/channel/')
  })

  it('prints the page from the button', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    wrap(<EmployerFlyer />)

    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    expect(print).toHaveBeenCalled()
    print.mockRestore()
  })

  it('makes a WhatsApp link only from a real number', () => {
    expect(whatsappContactLink('+233 24 123 4567')).toMatch(/^https:\/\/wa\.me\/233241234567\?text=Hello/)
    expect(whatsappContactLink('')).toBeNull()
    expect(whatsappContactLink(undefined)).toBeNull()
    expect(whatsappContactLink('12345')).toBeNull()
  })
})

describe('the weekly report on the employer dashboard', () => {
  const report = {
    weekStart: '2026-11-02T00:00:00.000Z',
    weekEnd: '2026-11-09T00:00:00.000Z',
    jobs: [
      { jobId: 'j1', title: 'Hotel Receptionist', views: 40, newApplicants: 5, totalApplicants: 9, awaitingReview: 4 },
      { jobId: 'j2', title: 'Cook', views: 12, newApplicants: 0, totalApplicants: 1, awaitingReview: 1 },
    ],
    totals: { views: 52, newApplicants: 5, totalApplicants: 10, awaitingReview: 5, activeJobs: 2 },
  }

  it('shows views, new applicants and what waits for review, per job, with a WhatsApp share link', async () => {
    api.weekly.mockResolvedValue({ report, whatsappUrl: 'https://wa.me/?text=Hi' })
    render(<WeeklyReportPanel />)

    const panel = await screen.findByRole('region', { name: 'Weekly report' })
    expect(within(panel).getByText('2 Nov to 8 Nov. We also email this every Monday.')).toBeInTheDocument()
    expect(within(panel).getByText('52')).toBeInTheDocument()
    const row = within(panel).getByRole('row', { name: /hotel receptionist/i })
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Hotel Receptionist', '40', '5', '4'])
    expect(within(panel).getByRole('link', { name: /share on whatsapp/i })).toHaveAttribute('href', 'https://wa.me/?text=Hi')
  })

  it('shows nothing when there is no active job, or when the report cannot load', async () => {
    api.weekly.mockResolvedValue({ report: { ...report, jobs: [] }, whatsappUrl: '' })
    const { container, unmount } = render(<WeeklyReportPanel />)
    await waitFor(() => expect(api.weekly).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
    unmount()

    api.weekly.mockRejectedValue(new Error('offline'))
    const second = render(<WeeklyReportPanel />)
    await waitFor(() => expect(api.weekly).toHaveBeenCalledTimes(2))
    expect(second.container).toBeEmptyDOMElement()
  })

  it('labels the week by its last day, not the Monday after', () => {
    expect(weekRangeLabel(report)).toBe('2 Nov to 8 Nov')
  })
})

describe('the referral panel', () => {
  it('shows the employer their link, the results, and a WhatsApp share', async () => {
    api.referral.mockResolvedValue({ referral: { code: 'JW-ABC234', url: 'https://www.jobwahala.com/signup?role=employer&ref=JW-ABC234', referred: 3, rewarded: 2, creditsEarned: 2, whatsappUrl: 'https://wa.me/?text=Join' } })
    render(<ReferralPanel />)

    const panel = await screen.findByRole('region', { name: 'Refer an employer' })
    expect(within(panel).getByLabelText('Your referral link')).toHaveValue('https://www.jobwahala.com/signup?role=employer&ref=JW-ABC234')
    expect(within(panel).getByText('3 companies joined with your link · 2 posted a job · 2 free featured credits earned')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: /whatsapp/i })).toHaveAttribute('href', 'https://wa.me/?text=Join')
  })

  it('copies the link', async () => {
    api.referral.mockResolvedValue({ referral: { code: 'JW-ABC234', url: 'https://www.jobwahala.com/signup?ref=JW-ABC234', referred: 0, rewarded: 0, creditsEarned: 0, whatsappUrl: 'x' } })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<ReferralPanel />)

    fireEvent.click(await screen.findByRole('button', { name: /copy link/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://www.jobwahala.com/signup?ref=JW-ABC234'))
    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument()
  })
})

describe('referral links', () => {
  it('keeps a valid code from the link until the account exists, and ignores a bad one', () => {
    rememberReferral('jw-abc234')
    expect(takeReferral()).toBe('JW-ABC234')
    expect(takeReferral()).toBeNull() // used once
    rememberReferral('hello')
    rememberReferral('JW-0OIl11')
    expect(takeReferral()).toBeNull()
  })

  it('opens sign-up on the employer tab for a link with role=employer, and remembers the code', () => {
    wrap(<Signup />, '/signup?role=employer&ref=JW-ABC234', '/signup')

    expect(screen.getByRole('button', { name: /employer/i, pressed: true })).toBeInTheDocument()
    expect(localStorage.getItem('jobwahala_ref')).toBe('JW-ABC234')
  })

  it('opens sign-up on the job seeker tab otherwise', () => {
    wrap(<Signup />, '/signup', '/signup')
    expect(screen.getByRole('button', { name: /job seeker/i, pressed: true })).toBeInTheDocument()
  })

  it('tells the server who referred a new employer, once, and carries on if that fails', async () => {
    api.attachReferral.mockRejectedValue(new Error('That referral code is not valid.'))
    rememberReferral('JW-ABC234')
    wrap(<Onboarding />, '/onboarding', '/onboarding')

    await waitFor(() => expect(api.attachReferral).toHaveBeenCalledWith('JW-ABC234'))
    expect(localStorage.getItem('jobwahala_ref')).toBeNull()
    expect(screen.getByRole('button', { name: /continue|finish|save|launch/i })).toBeInTheDocument()
  })

  it('does not look for a referral for a job seeker', async () => {
    const seeker = { ...auth.user }
    auth.user = { id: 's-1', role: 'SEEKER', email: 's@b.com' }
    rememberReferral('JW-ABC234')
    wrap(<Onboarding />, '/onboarding', '/onboarding')

    await screen.findAllByRole('heading')
    expect(api.attachReferral).not.toHaveBeenCalled()
    auth.user = seeker
  })
})

describe('the Founding Employer badge', () => {
  const company = {
    id: 'emp-1',
    companyName: 'Early Bird Ltd',
    isVerified: false,
    memberSince: '2026-03-01T00:00:00.000Z',
    jobs: [],
  }

  it('shows on the company page with its number, and only for a Founding Employer', async () => {
    api.getCompany.mockResolvedValue({ company: { ...company, isFoundingEmployer: true, foundingNumber: 7 } })
    const first = wrap(<CompanyProfile />, '/companies/emp-1', '/companies/:id')
    expect(await screen.findByText('Founding Employer #7')).toBeInTheDocument()
    first.unmount()

    api.getCompany.mockResolvedValue({ company })
    wrap(<CompanyProfile />, '/companies/emp-1', '/companies/:id')
    await screen.findByRole('heading', { level: 1, name: 'Early Bird Ltd' })
    expect(screen.queryByText(/Founding Employer/)).not.toBeInTheDocument()
  })
})
