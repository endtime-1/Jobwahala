import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CvVisibilityToggle from '../components/CvVisibilityToggle'
import CvDatabase from './CvDatabase'
import Privacy from './Privacy'
import Signup from './Signup'
import { compactFilters } from '../lib/cvDatabase'

const api = vi.hoisted(() => ({
  search: vi.fn(),
  candidate: vi.fn(),
  unlock: vi.fn(),
  invite: vi.fn(),
  billing: vi.fn(),
  saved: vi.fn(),
  saveSearch: vi.fn(),
  setAlerts: vi.fn(),
  deleteSaved: vi.fn(),
  activity: vi.fn(),
  block: vi.fn(),
  unblock: vi.fn(),
  update: vi.fn(),
  catalogue: vi.fn(),
  checkout: vi.fn(),
}))
const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
const refreshUser = vi.hoisted(() => vi.fn())
const signup = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  apiSearchCvDatabase: (...a: unknown[]) => api.search(...a),
  apiGetCandidate: (...a: unknown[]) => api.candidate(...a),
  apiUnlockCandidate: (...a: unknown[]) => api.unlock(...a),
  apiInviteCandidate: (...a: unknown[]) => api.invite(...a),
  apiGetMyBilling: (...a: unknown[]) => api.billing(...a),
  apiGetSavedCandidateSearches: (...a: unknown[]) => api.saved(...a),
  apiSaveCandidateSearch: (...a: unknown[]) => api.saveSearch(...a),
  apiSetSavedSearchAlerts: (...a: unknown[]) => api.setAlerts(...a),
  apiDeleteSavedCandidateSearch: (...a: unknown[]) => api.deleteSaved(...a),
  apiGetCvActivity: (...a: unknown[]) => api.activity(...a),
  apiBlockCompany: (...a: unknown[]) => api.block(...a),
  apiUnblockCompany: (...a: unknown[]) => api.unblock(...a),
  apiUpdateProfile: (...a: unknown[]) => api.update(...a),
  apiGetBillingCatalogue: (...a: unknown[]) => api.catalogue(...a),
  apiStartCheckout: (...a: unknown[]) => api.checkout(...a),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ ...auth.value, refreshUser, signup }) }))
vi.mock('../lib/features', () => ({ useFeatures: () => ({ freelanceEnabled: false }) }))
vi.mock('../lib/captcha', () => ({ useCaptcha: () => ({ token: '', setToken: vi.fn(), reset: vi.fn(), ready: true, resetSignal: 0 }) }))
vi.mock('../components/TurnstileWidget', () => ({ default: () => null }))

const candidate = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  headline: 'Accountant with 3 years in retail',
  skills: 'Excel, bookkeeping',
  experienceSummary: 'Three years in accounts.',
  location: 'Accra',
  educationLevel: 'BACHELORS',
  availability: 'IMMEDIATELY',
  yearsExperience: 3,
  jobCategory: 'Finance',
  hasVerifiedCertificate: true,
  lastActiveAt: '2026-11-04T10:00:00.000Z',
  boosted: false,
  unlocked: false,
  ...overrides,
})
const allowance = { limit: 50, used: 4, remaining: 46, resetsOn: '2026-12-01T00:00:00.000Z' }
const results = (entries = [candidate()]) => ({ total: entries.length, matching: entries.length, page: 1, pageSize: 20, entries, allowance })

const wrap = (node: React.ReactNode) => (
  <HelmetProvider>
    <MemoryRouter>{node}</MemoryRouter>
  </HelmetProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  api.search.mockResolvedValue(results())
  api.saved.mockResolvedValue({ searches: [] })
  refreshUser.mockResolvedValue(undefined)
  api.activity.mockResolvedValue({ activity: [], blocked: [] })
  api.catalogue.mockResolvedValue({ products: [] })
})

describe('the CV database search page', () => {
  it('shows a limited profile with the badges, and no name, phone or email', async () => {
    api.search.mockResolvedValue(results([candidate({ boosted: true })]))
    render(wrap(<CvDatabase />))

    expect(await screen.findByText('Accountant with 3 years in retail')).toBeInTheDocument()
    expect(screen.getByText('Boosted')).toBeInTheDocument()
    expect(screen.getByText('Verified certificate')).toBeInTheDocument()
    expect(screen.getByText(/Accra · Bachelor's degree · Available immediately · 3 yrs experience/)).toBeInTheDocument()
    expect(screen.getByText('Unlocks this month: 4 of 50 used', { exact: false })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/@|\+233/)
  })

  it('searches with every filter the employer set', async () => {
    render(wrap(<CvDatabase />))
    await screen.findByText('Accountant with 3 years in retail')

    fireEvent.change(screen.getByLabelText('Skills'), { target: { value: 'excel' } })
    fireEvent.change(screen.getByLabelText('Job category'), { target: { value: 'Finance' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Accra' } })
    fireEvent.change(screen.getByLabelText(/years of experience/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/education level/i), { target: { value: 'DIPLOMA' } })
    fireEvent.change(screen.getByLabelText('Availability'), { target: { value: 'NSS' } })
    fireEvent.change(screen.getByLabelText('Last active'), { target: { value: '30' } })
    fireEvent.click(screen.getByLabelText('Has a verified certificate'))
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() =>
      expect(api.search).toHaveBeenLastCalledWith({ skills: 'excel', category: 'Finance', location: 'Accra', minYears: '2', education: 'DIPLOMA', availability: 'NSS', activeWithinDays: '30', certificate: 'true', page: '1' }),
    )
  })

  it('opening a profile does not reveal contact details; unlocking does, and refreshes the allowance', async () => {
    api.candidate.mockResolvedValue({ profile: candidate(), contact: null, allowance })
    api.unlock.mockResolvedValue({ alreadyUnlocked: false, contact: { name: 'Ama Mensah', email: 'ama@example.com', phone: '+233244123456', cv: { url: '/api/uploads/cv/a.pdf', fileName: 'cv.pdf' } }, allowance })
    render(wrap(<CvDatabase />))

    fireEvent.click(await screen.findByRole('button', { name: /View profile/ }))
    expect(await screen.findByRole('button', { name: /Unlock profile/ })).toBeInTheDocument()
    expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Unlock profile/ }))

    const contact = await screen.findByLabelText('Unlocked contact details')
    expect(within(contact).getByText('Ama Mensah')).toBeInTheDocument()
    expect(within(contact).getByText('ama@example.com')).toBeInTheDocument()
    expect(within(contact).getByText('Open CV (cv.pdf)')).toBeInTheDocument()
    expect(api.unlock).toHaveBeenCalledWith('p1')
    await waitFor(() => expect(api.search.mock.calls.length).toBeGreaterThan(1))
  })

  it('says plainly when the monthly unlocks are used up', async () => {
    api.candidate.mockResolvedValue({ profile: candidate(), contact: null, allowance })
    api.unlock.mockRejectedValue(new Error('You have used all 50 profile unlocks in your plan this month.'))
    render(wrap(<CvDatabase />))

    fireEvent.click(await screen.findByRole('button', { name: /View profile/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Unlock profile/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('used all 50 profile unlocks')
  })

  it('invites a candidate to one of the open jobs', async () => {
    api.candidate.mockResolvedValue({ profile: candidate(), contact: null, allowance })
    api.billing.mockResolvedValue({ jobs: [{ id: 'job-1', title: 'Accountant' }] })
    api.invite.mockResolvedValue({ success: true, invited: true })
    render(wrap(<CvDatabase />))

    fireEvent.click(await screen.findByRole('button', { name: /View profile/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Invite to apply/ }))
    fireEvent.change(await screen.findByLabelText('Job to invite them to'), { target: { value: 'job-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))

    await waitFor(() => expect(api.invite).toHaveBeenCalledWith('p1', 'job-1'))
    expect(await screen.findByText('Invitation sent. They have been notified.')).toBeInTheDocument()
  })

  it('saves a search with email alerts, runs it again, turns alerts off and deletes it', async () => {
    api.saveSearch.mockResolvedValue({ search: { id: 's1', name: 'Accra accountants', alertsEnabled: true, filters: { location: 'Accra' } } })
    api.setAlerts.mockResolvedValue({ success: true })
    api.deleteSaved.mockResolvedValue({ success: true })
    render(wrap(<CvDatabase />))
    await screen.findByText('Accountant with 3 years in retail')

    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Accra' } })
    fireEvent.change(screen.getByLabelText('Name this search'), { target: { value: 'Accra accountants' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save search' }))

    await waitFor(() => expect(api.saveSearch).toHaveBeenCalledWith({ name: 'Accra accountants', filters: { location: 'Accra' }, alertsEnabled: true }))
    fireEvent.click(await screen.findByRole('button', { name: 'Accra accountants' }))
    await waitFor(() => expect(api.search).toHaveBeenLastCalledWith({ location: 'Accra', page: '1' }))

    fireEvent.click(screen.getByLabelText('Email alerts for Accra accountants'))
    await waitFor(() => expect(api.setAlerts).toHaveBeenCalledWith('s1', false))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Accra accountants' }))
    await waitFor(() => expect(api.deleteSaved).toHaveBeenCalledWith('s1'))
  })

  it('explains what is missing: a plan, or business verification', async () => {
    api.search.mockRejectedValue(Object.assign(new Error('The CV database is part of the Business plan.'), { code: 'PLAN_REQUIRED' }))
    const { unmount } = render(wrap(<CvDatabase />))
    expect(await screen.findByText('The CV database is part of the Business plan.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/plans')
    unmount()

    api.search.mockRejectedValue(Object.assign(new Error('Only verified employers can search the CV database. Verify your business first.'), { code: 'VERIFICATION_REQUIRED' }))
    render(wrap(<CvDatabase />))
    expect(await screen.findByText(/Only verified employers can search/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Verify your business' })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument()
  })

  it('drops empty filters', () => {
    expect(compactFilters({ skills: 'excel', location: '', certificate: 'false', minYears: '0' })).toEqual({ skills: 'excel', minYears: '0' })
  })
})

describe('the job seeker privacy panel', () => {
  const seeker = (profile: Record<string, unknown> = {}) => ({ user: { id: 's1', role: 'SEEKER', jobSeekerProfile: profile } })

  it('is Hidden by default, and switching to visible is one clear choice that is saved', async () => {
    auth.value = seeker({})
    api.update.mockResolvedValue({ success: true })
    render(wrap(<CvVisibilityToggle />))

    expect(screen.getByRole('radio', { name: /Hidden/ })).toBeChecked()
    expect(screen.getByText(/Your name, phone, email and CV stay hidden until an employer unlocks your profile/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Headline')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Visible to verified employers/ }))

    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ cvVisibility: 'VERIFIED_EMPLOYERS' }))
    expect(refreshUser).toHaveBeenCalled()
  })

  it('when visible, saves what employers filter by', async () => {
    auth.value = seeker({ cvVisibility: 'VERIFIED_EMPLOYERS', headline: 'Accountant' })
    api.update.mockResolvedValue({ success: true })
    render(wrap(<CvVisibilityToggle />))

    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Kumasi' } })
    fireEvent.change(screen.getByLabelText('Education level'), { target: { value: 'DIPLOMA' } })
    fireEvent.change(screen.getByLabelText('Availability'), { target: { value: 'NSS' } })
    fireEvent.change(screen.getByLabelText('Years of experience'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save these details' }))

    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ headline: 'Accountant', location: 'Kumasi', educationLevel: 'DIPLOMA', availability: 'NSS', yearsExperience: 4, jobCategory: '' }))
  })

  it('shows who looked or unlocked, lets the person block a company, and unblock it again', async () => {
    auth.value = seeker({ cvVisibility: 'VERIFIED_EMPLOYERS' })
    api.activity.mockResolvedValue({
      activity: [
        { kind: 'UNLOCKED', employerId: 'e1', company: 'Acme Ltd', at: '2026-11-03T10:00:00.000Z' },
        { kind: 'VIEWED', employerId: 'e2', company: 'Beta Co', at: '2026-11-02T10:00:00.000Z' },
      ],
      blocked: [{ employerId: 'e3', company: 'Gamma Ltd', at: '2026-11-01T10:00:00.000Z' }],
    })
    api.block.mockResolvedValue({ success: true })
    api.unblock.mockResolvedValue({ success: true })
    render(wrap(<CvVisibilityToggle />))

    expect(await screen.findByText(/Acme Ltd/)).toBeInTheDocument()
    expect(screen.getByText(/unlocked your profile on/)).toBeInTheDocument()
    expect(screen.getByText(/viewed your profile on/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Block Acme Ltd' }))
    await waitFor(() => expect(api.block).toHaveBeenCalledWith('e1'))

    fireEvent.click(screen.getByRole('button', { name: 'Unblock Gamma Ltd' }))
    await waitFor(() => expect(api.unblock).toHaveBeenCalledWith('e3'))
  })

  it('offers the paid boost only to visible profiles, and sends the person to Paystack', async () => {
    api.catalogue.mockResolvedValue({ products: [{ id: 'boost-1', kind: 'PROFILE_BOOST', durationDays: 30, totalLabel: 'GHS 20.00' }] })
    api.checkout.mockResolvedValue({ authorizationUrl: 'https://checkout.paystack.com/boost' })
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })

    auth.value = seeker({})
    const hidden = render(wrap(<CvVisibilityToggle />))
    await waitFor(() => expect(api.catalogue).toHaveBeenCalled())
    expect(screen.queryByText('Profile boost')).not.toBeInTheDocument()
    hidden.unmount()

    auth.value = seeker({ cvVisibility: 'VERIFIED_EMPLOYERS' })
    render(wrap(<CvVisibilityToggle />))
    fireEvent.click(await screen.findByRole('button', { name: 'Boost for GHS 20.00' }))

    await waitFor(() => expect(api.checkout).toHaveBeenCalledWith('boost-1'))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.paystack.com/boost'))
    vi.unstubAllGlobals()
  })

  it('shows when a boost runs until, and offers to extend it', async () => {
    api.catalogue.mockResolvedValue({ products: [{ id: 'boost-1', kind: 'PROFILE_BOOST', durationDays: 30, totalLabel: 'GHS 20.00' }] })
    auth.value = seeker({ cvVisibility: 'VERIFIED_EMPLOYERS', profileBoostedUntil: new Date(Date.now() + 5 * 86_400_000).toISOString() })
    render(wrap(<CvVisibilityToggle />))

    expect(await screen.findByText(/Your profile is boosted until/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Extend for GHS 20.00' })).toBeInTheDocument()
  })
})

describe('asked at sign-up', () => {
  const fill = () => {
    fireEvent.change(screen.getByPlaceholderText('Kwame Mensah'), { target: { value: 'Ama Mensah' } })
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ama@example.com' } })
    const password = document.querySelector('input[type="password"]') as HTMLInputElement
    fireEvent.change(password, { target: { value: 'Passw0rd!xyz' } })
  }

  beforeEach(() => signup.mockResolvedValue(undefined))

  it('job seekers are asked, with a clear explanation, and Hidden is the default', async () => {
    render(wrap(<Signup />))

    expect(screen.getByText('Can employers find your profile?')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Hidden/ })).toBeChecked()
    expect(screen.getByText(/Your name, phone, email and CV stay hidden until an employer unlocks your profile/)).toBeInTheDocument()

    fill()
    fireEvent.click(screen.getByRole('button', { name: /create account|sign up|get started/i }))

    await waitFor(() => expect(signup).toHaveBeenCalledWith('ama@example.com', 'Passw0rd!xyz', 'SEEKER'))
  })

  it('choosing visible sends that choice with the sign-up', async () => {
    render(wrap(<Signup />))
    fill()
    fireEvent.click(screen.getByRole('radio', { name: /Visible to verified employers/ }))
    fireEvent.click(screen.getByRole('button', { name: /create account|sign up|get started/i }))

    await waitFor(() => expect(signup).toHaveBeenCalledWith('ama@example.com', 'Passw0rd!xyz', 'SEEKER', undefined, { cvVisibility: 'VERIFIED_EMPLOYERS' }))
  })
})

describe('the privacy policy draft', () => {
  it('explains the CV database: who can search, what is seen before and after unlocking, blocking and boosts', () => {
    render(wrap(<Privacy />))

    expect(screen.getByRole('heading', { name: /The CV database: who can see what/ })).toBeInTheDocument()
    expect(screen.getByText(/only employers whose business we have verified and who are on a paid plan/)).toBeInTheDocument()
    expect(screen.getByText(/your name, phone number, email address and CV file/)).toBeInTheDocument()
    expect(screen.getByText(/you can block any company/)).toBeInTheDocument()
    expect(screen.getByText(/there is no way to export contact details in bulk/)).toBeInTheDocument()
    expect(screen.getByText(/marked "Boosted" to/)).toBeInTheDocument()
  })
})
