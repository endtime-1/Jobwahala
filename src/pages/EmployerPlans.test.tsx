import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CompanyPageEditor from './CompanyPageEditor'
import CompanyProfile from './CompanyProfile'
import CvDatabase from './CvDatabase'
import HiringReports from './HiringReports'
import JoinTeam from './JoinTeam'
import Plans from './Plans'
import Team from './Team'
import CvVisibilityToggle from '../components/CvVisibilityToggle'
import PlanUsagePanel from '../components/PlanUsagePanel'
import { featureLines, planLevel, plansFor, yearlySavingPercent } from '../lib/plans'

const api = vi.hoisted(() => ({
  plans: vi.fn(),
  changePlan: vi.fn(),
  checkout: vi.fn(),
  team: vi.fn(),
  invite: vi.fn(),
  remove: vi.fn(),
  accept: vi.fn(),
  report: vi.fn(),
  cv: vi.fn(),
  company: vi.fn(),
  updateProfile: vi.fn(),
  upload: vi.fn(),
}))
const auth = vi.hoisted(() => ({ value: { user: { id: 'emp-1', role: 'EMPLOYER', jobSeekerProfile: {} } as Record<string, unknown> } }))
const refreshUser = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  apiGetPlans: (...a: unknown[]) => api.plans(...a),
  apiChangePlan: (...a: unknown[]) => api.changePlan(...a),
  apiStartCheckout: (...a: unknown[]) => api.checkout(...a),
  apiGetTeam: (...a: unknown[]) => api.team(...a),
  apiInviteTeamMember: (...a: unknown[]) => api.invite(...a),
  apiRemoveTeamMember: (...a: unknown[]) => api.remove(...a),
  apiAcceptTeamInvite: (...a: unknown[]) => api.accept(...a),
  apiGetHiringReport: (...a: unknown[]) => api.report(...a),
  apiSearchCvDatabase: (...a: unknown[]) => api.cv(...a),
  apiGetCompany: (...a: unknown[]) => api.company(...a),
  apiUpdateProfile: (...a: unknown[]) => api.updateProfile(...a),
}))
vi.mock('../lib/evidenceUpload', () => ({ uploadLogoFile: (...a: unknown[]) => api.upload(...a), maxLogoFileBytes: 1024 * 1024 }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ ...auth.value, refreshUser }) }))

const plan = (overrides: Record<string, unknown> = {}) => ({
  id: 'free',
  kind: 'SUBSCRIPTION',
  slug: 'free',
  name: 'Free',
  description: 'Post and hire.',
  audience: 'EMPLOYER',
  durationDays: null,
  featuredCredits: 0,
  boostCredits: 0,
  interval: null,
  includes: [],
  active: true,
  sortOrder: 0,
  priceGhs: 0,
  totalPesewas: 0,
  totalLabel: 'GHS 0.00',
  vatPesewas: 0,
  pricesIncludeVat: true,
  vatRatePercent: 15,
  planTier: 'FREE',
  teamLimit: 1,
  cvDatabase: false,
  brandedPage: false,
  hiringReports: false,
  topEmployers: false,
  ...overrides,
})
const catalogue = [
  plan(),
  plan({ id: 'st-m', name: 'Starter (monthly)', planTier: 'STARTER', interval: 'MONTHLY', totalPesewas: 15000, totalLabel: 'GHS 150.00', teamLimit: 3, brandedPage: true, featuredCredits: 2, boostCredits: 1 }),
  plan({ id: 'st-y', name: 'Starter (yearly)', planTier: 'STARTER', interval: 'YEARLY', totalPesewas: 150000, totalLabel: 'GHS 1,500.00', teamLimit: 3, brandedPage: true, featuredCredits: 2, boostCredits: 1 }),
  plan({ id: 'bz-m', name: 'Business (monthly)', planTier: 'BUSINESS', interval: 'MONTHLY', totalPesewas: 45000, totalLabel: 'GHS 450.00', teamLimit: 10, brandedPage: true, cvDatabase: true, hiringReports: true, topEmployers: true, featuredCredits: 6, boostCredits: 3 }),
  plan({ id: 'bz-y', name: 'Business (yearly)', planTier: 'BUSINESS', interval: 'YEARLY', totalPesewas: 450000, totalLabel: 'GHS 4,500.00', teamLimit: 10, brandedPage: true, cvDatabase: true, hiringReports: true, topEmployers: true, featuredCredits: 6, boostCredits: 3 }),
]
const usage = { featuredCredits: 5, boostCredits: 1, planCredits: { featured: 2, boost: 1 }, purchasedCredits: { featured: 3, boost: 0 }, monthlyFeaturedCredits: 2, monthlyBoostCredits: 1, teamSeatsUsed: 2, teamLimit: 3 }
const plansResponse = (current: Record<string, unknown> = {}) => ({
  mode: 'test',
  plans: catalogue,
  current: { tier: 'FREE', planName: 'Free', productId: null, interval: null, subscription: null, features: { teamLimit: 1, cvDatabase: false, brandedPage: false, hiringReports: false, topEmployers: false }, ...current },
  usage,
})
const onStarter = () =>
  plansResponse({
    tier: 'STARTER',
    planName: 'Starter (monthly)',
    productId: 'st-m',
    interval: 'MONTHLY',
    subscription: { id: 'sub-1', status: 'ACTIVE', currentPeriodEnd: '2026-12-10T10:00:00.000Z', graceEndsAt: null, cancelAtPeriodEnd: false, pendingPlanName: null },
    features: { teamLimit: 3, cvDatabase: false, brandedPage: true, hiringReports: false, topEmployers: false },
  })

const renderAt = (path: string, element: React.ReactNode, route = path) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  auth.value = { user: { id: 'emp-1', role: 'EMPLOYER', jobSeekerProfile: {} } }
  refreshUser.mockResolvedValue(undefined)
  api.plans.mockResolvedValue(plansResponse())
})
afterEach(() => vi.restoreAllMocks())

describe('plan helpers', () => {
  it('rank plans the way the server does, and show one billing period at a time with Free always there', () => {
    expect(planLevel({ planTier: 'STARTER', interval: 'YEARLY' })).toBeGreaterThan(planLevel({ planTier: 'STARTER', interval: 'MONTHLY' }))
    expect(planLevel({ planTier: 'BUSINESS', interval: 'MONTHLY' })).toBeGreaterThan(planLevel({ planTier: 'STARTER', interval: 'YEARLY' }))
    expect(plansFor(catalogue as never, 'MONTHLY').map((item) => item.id)).toEqual(['free', 'st-m', 'bz-m'])
    expect(plansFor(catalogue as never, 'YEARLY').map((item) => item.id)).toEqual(['free', 'st-y', 'bz-y'])
  })

  it('works out the yearly saving, and lists what a plan includes', () => {
    expect(yearlySavingPercent(catalogue as never, 'STARTER')).toBe(17)
    expect(yearlySavingPercent(catalogue as never, 'FREE')).toBe(0)
    expect(featureLines(catalogue[3] as never)).toEqual(expect.arrayContaining(['CV database access', 'Hiring reports', 'Up to 10 team members', 'Priority in "Top employers"']))
    expect(featureLines(catalogue[0] as never)).toEqual(['Unlimited standard job posts', 'Applicant board', '1 team member (you)'])
  })
})

describe('the plan comparison page', () => {
  it('compares Free, Starter and Business, and switches to the yearly prices', async () => {
    renderAt('/plans', <Plans />)

    expect(await screen.findByRole('heading', { name: 'Starter (monthly)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Business (monthly)' })).toBeInTheDocument()
    expect(screen.getByText('Up to 10 team members')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }))

    expect(screen.getByRole('heading', { name: 'Starter (yearly)' })).toBeInTheDocument()
    expect(screen.getAllByText('Save 17% against paying monthly')).toHaveLength(2)
    expect(screen.queryByRole('heading', { name: 'Starter (monthly)' })).not.toBeInTheDocument()
  })

  it('says it never touches verification', async () => {
    renderAt('/plans', <Plans />)

    expect(await screen.findByText(/never ranks an unverified employer above a verified one/i)).toBeInTheDocument()
  })

  it('buys a bigger plan now, through Paystack', async () => {
    api.checkout.mockResolvedValue({ authorizationUrl: 'https://checkout.paystack.com/abc' })
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    renderAt('/plans', <Plans />)

    fireEvent.click(await screen.findByRole('button', { name: 'Upgrade to Business (monthly)' }))

    await waitFor(() => expect(api.checkout).toHaveBeenCalledWith('bz-m'))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.paystack.com/abc'))
    vi.unstubAllGlobals()
  })

  it('marks the current plan, and moves to a smaller plan at the end of the period after asking', async () => {
    api.plans.mockResolvedValue(onStarter())
    api.changePlan.mockResolvedValue({ scheduled: true, effectiveOn: '2026-12-10T10:00:00.000Z' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/plans', <Plans />)

    const starter = await screen.findByRole('listitem', { name: 'Starter (monthly)' })
    expect(within(starter).getByText('Your plan')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Move to Free' }))

    await waitFor(() => expect(api.changePlan).toHaveBeenCalledWith('free'))
    expect(await screen.findByText(/Free starts on/)).toBeInTheDocument()
    expect(api.checkout).not.toHaveBeenCalled()
  })

  it('does nothing when the move to a smaller plan is not confirmed', async () => {
    api.plans.mockResolvedValue(onStarter())
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt('/plans', <Plans />)

    fireEvent.click(await screen.findByRole('button', { name: 'Move to Free' }))

    expect(api.changePlan).not.toHaveBeenCalled()
  })

  it('tells someone with a failed payment how long the plan keeps working', async () => {
    api.plans.mockResolvedValue(
      plansResponse({ tier: 'BUSINESS', planName: 'Business (monthly)', productId: 'bz-m', interval: 'MONTHLY', subscription: { id: 's', status: 'PAST_DUE', currentPeriodEnd: '2026-11-01T00:00:00.000Z', graceEndsAt: '2026-11-08T00:00:00.000Z', cancelAtPeriodEnd: false, pendingPlanName: null } }),
    )
    renderAt('/plans', <Plans />)

    expect(await screen.findByText(/We could not take your last payment/)).toBeInTheDocument()
    expect(screen.getByText(/nothing is deleted/)).toBeInTheDocument()
  })

  it('cannot buy while payments are off', async () => {
    api.plans.mockResolvedValue({ ...plansResponse(), mode: 'off' })
    renderAt('/plans', <Plans />)

    expect(await screen.findByRole('button', { name: 'Upgrade to Starter (monthly)' })).toBeDisabled()
    expect(screen.getByText(/Payments are not switched on yet/)).toBeInTheDocument()
  })

  it('shows a plain message when the plans cannot be loaded', async () => {
    api.plans.mockRejectedValue(new Error('Server down'))
    renderAt('/plans', <Plans />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Server down')
  })
})

describe('current plan and usage on the dashboard', () => {
  it('shows the plan, renewal date, credits split into plan and bought, and team seats', async () => {
    api.plans.mockResolvedValue(onStarter())
    renderAt('/dashboard', <PlanUsagePanel />)

    const panel = await screen.findByRole('region', { name: 'Current plan and usage' })
    expect(within(panel).getByText('Starter (monthly)')).toBeInTheDocument()
    expect(within(panel).getByText(/Renews on/)).toBeInTheDocument()
    expect(within(panel).getByText('2 from your plan this month, 3 bought')).toBeInTheDocument()
    expect(within(panel).getByText('2 of 3')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Branded company page' })).toHaveAttribute('href', '/company-page')
    expect(within(panel).queryByRole('link', { name: 'CV database' })).not.toBeInTheDocument()
  })

  it('on Free offers the plans, and renders nothing if it cannot load', async () => {
    renderAt('/dashboard', <PlanUsagePanel />)
    expect(await screen.findByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/plans')
  })

  it('stays out of the way when the plans cannot be loaded', async () => {
    api.plans.mockRejectedValue(new Error('x'))
    renderAt('/dashboard', <PlanUsagePanel />)

    await waitFor(() => expect(api.plans).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: 'Current plan and usage' })).not.toBeInTheDocument()
  })
})

describe('the team page', () => {
  const team = (overrides: Record<string, unknown> = {}) => ({ limit: 3, used: 2, planName: 'Starter (monthly)', members: [{ id: 'tm-1', email: 'a@acme.example', status: 'ACTIVE', invitedAt: '2026-11-01T00:00:00.000Z', joinedAt: '2026-11-02T00:00:00.000Z' }], ...overrides })

  it('lists the team and the seats used, and sends an invitation', async () => {
    api.team.mockResolvedValue(team())
    api.invite.mockResolvedValue({ success: true })
    renderAt('/team', <Team />)

    expect(await screen.findByText('a@acme.example')).toBeInTheDocument()
    expect(screen.getByText(/Seats used: 2 of 3 on Starter/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/email of the person/i), { target: { value: 'new@acme.example' } })
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }))

    await waitFor(() => expect(api.invite).toHaveBeenCalledWith('new@acme.example'))
    expect(await screen.findByText('We sent an invitation to new@acme.example.')).toBeInTheDocument()
  })

  it('when the plan has no more seats, blocks inviting and points at the plans', async () => {
    api.team.mockResolvedValue(team({ used: 3 }))
    renderAt('/team', <Team />)

    expect(await screen.findByLabelText(/email of the person/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /send invitation/i })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/plans')
  })

  it('shows the server message when it refuses an invitation', async () => {
    api.team.mockResolvedValue(team())
    api.invite.mockRejectedValue(new Error('Your plan has no more team seats. Upgrade for more.'))
    renderAt('/team', <Team />)

    fireEvent.change(await screen.findByLabelText(/email of the person/i), { target: { value: 'x@acme.example' } })
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('no more team seats')
  })

  it('removes a person after asking, and says when someone is paused for the plan', async () => {
    api.team.mockResolvedValue(team({ members: [{ id: 'tm-2', email: 'b@acme.example', status: 'SUSPENDED', invitedAt: '2026-11-01T00:00:00.000Z', joinedAt: null }] }))
    api.remove.mockResolvedValue({ success: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/team', <Team />)

    expect(await screen.findByText(/Paused: over your plan limit/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove b@acme.example' }))

    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('tm-2'))
  })
})

describe('joining a team', () => {
  it('accepts the invitation from the emailed link', async () => {
    api.accept.mockResolvedValue({ success: true, company: 'Acme Ltd' })
    renderAt('/join-team?token=abc123', <JoinTeam />, '/join-team')

    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }))

    await waitFor(() => expect(api.accept).toHaveBeenCalledWith('abc123'))
    expect(await screen.findByText('You now work with Acme Ltd.')).toBeInTheDocument()
  })

  it('shows why an invitation did not work, and a missing code', async () => {
    api.accept.mockRejectedValue(new Error('That invitation was sent to a different email address.'))
    renderAt('/join-team?token=abc123', <JoinTeam />, '/join-team')
    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('different email')
  })

  it('has nothing to accept without a code', () => {
    renderAt('/join-team', <JoinTeam />)

    expect(screen.getByRole('alert')).toHaveTextContent('missing its invitation code')
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument()
  })
})

describe('the CV database', () => {
  const entry = { id: 'p1', name: 'Ama Mensah', skills: 'Excel', experience: 'Accounts', careerStage: 'GRADUATE', institution: 'University of Ghana', programme: 'BSc Accounting', cv: { url: '/api/uploads/cv/a.pdf', fileName: 'cv.pdf' } }

  it('searches opted-in people with the words and the group chosen', async () => {
    api.cv.mockResolvedValue({ total: 1, page: 1, entries: [entry] })
    renderAt('/cv-database', <CvDatabase />)

    expect(await screen.findByText('Ama Mensah')).toBeInTheDocument()
    expect(screen.getByText('BSc Accounting · University of Ghana')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/skills, course or experience/i), { target: { value: 'excel' } })
    fireEvent.change(screen.getByLabelText('Who'), { target: { value: 'nss' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(api.cv).toHaveBeenLastCalledWith({ page: '1', q: 'excel', stage: 'nss' }))
  })

  it('never shows contact details', async () => {
    api.cv.mockResolvedValue({ total: 1, page: 1, entries: [entry] })
    renderAt('/cv-database', <CvDatabase />)

    await screen.findByText('Ama Mensah')
    expect(document.body.textContent).not.toMatch(/@|\+233|phone|email/i)
  })

  it('without the Business plan, explains and links to the plans (the server refused it)', async () => {
    api.cv.mockRejectedValue(Object.assign(new Error('The CV database is part of the Business plan.'), { code: 'PLAN_REQUIRED' }))
    renderAt('/cv-database', <CvDatabase />)

    expect(await screen.findByText('The CV database is part of the Business plan.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/plans')
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument()
  })
})

describe('the seeker opt-in', () => {
  it('is off by default, saves the choice when switched on, and can be switched off', async () => {
    auth.value = { user: { id: 's1', role: 'SEEKER', jobSeekerProfile: {} } }
    api.updateProfile.mockResolvedValue({ success: true })
    const { unmount } = renderAt('/', <CvVisibilityToggle />)

    const box = screen.getByRole('checkbox', { name: /let employers find my cv/i })
    expect(box).not.toBeChecked()
    expect(screen.getByText(/Your email and phone number stay private/)).toBeInTheDocument()

    fireEvent.click(box)
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ visibleToEmployers: true }))
    expect(refreshUser).toHaveBeenCalled()
    unmount()

    auth.value = { user: { id: 's1', role: 'SEEKER', jobSeekerProfile: { visibleToEmployers: true } } }
    renderAt('/', <CvVisibilityToggle />)
    const on = screen.getByRole('checkbox', { name: /let employers find my cv/i })
    expect(on).toBeChecked()
    fireEvent.click(on)
    await waitFor(() => expect(api.updateProfile).toHaveBeenLastCalledWith({ visibleToEmployers: false }))
  })
})

describe('hiring reports', () => {
  const report = {
    months: 6,
    totals: { jobsPosted: 2, views: 40, applications: 9, hires: 1, avgFirstResponseHours: 30 },
    byMonth: [{ month: '2026-10', jobsPosted: 2, views: 40, applications: 9, hires: 1, avgFirstResponseHours: 72 }],
    byJob: [{ id: 'j1', title: 'Hotel Receptionist', status: 'ACTIVE', views: 30, applications: 6, hires: 1, avgFirstResponseHours: null }],
  }

  it('shows the totals, by month and by job, and changes the period', async () => {
    api.report.mockResolvedValue(report)
    renderAt('/hiring-reports', <HiringReports />)

    expect(await screen.findByText('Hotel Receptionist')).toBeInTheDocument()
    expect(screen.getByText('30 hours')).toBeInTheDocument()
    expect(screen.getByText('3 days')).toBeInTheDocument()
    expect(screen.getByText('No replies yet')).toBeInTheDocument()
    expect(screen.getByText('2026-10')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '12' } })

    await waitFor(() => expect(api.report).toHaveBeenLastCalledWith(12))
  })

  it('is for Business plans: others are pointed to the plans', async () => {
    api.report.mockRejectedValue(Object.assign(new Error('Hiring reports are part of the Business plan.'), { code: 'PLAN_REQUIRED' }))
    renderAt('/hiring-reports', <HiringReports />)

    expect(await screen.findByText('Hiring reports are part of the Business plan.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Period')).not.toBeInTheDocument()
  })
})

describe('the branded company page', () => {
  const company = {
    id: 'emp-1',
    companyName: 'Acme Ltd',
    isVerified: false,
    memberSince: '2026-03-01T00:00:00.000Z',
    description: 'We sell things.',
    jobs: [],
  }

  it('shows the cover, "Why work with us" and gallery on the public page for a branded company', async () => {
    api.company.mockResolvedValue({ company: { ...company, isBranded: true, coverImageUrl: '/api/uploads/logo/c.jpg', whyWorkWithUs: 'Great people.', gallery: ['/api/uploads/logo/g1.jpg', '/api/uploads/logo/g2.jpg'] } })
    renderAt('/companies/emp-1', <CompanyProfile />, '/companies/:id')

    expect(await screen.findByRole('heading', { name: 'Why work with us' })).toBeInTheDocument()
    expect(screen.getByText('Great people.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Acme Ltd photo 2' })).toHaveAttribute('src', '/api/uploads/logo/g2.jpg')
  })

  it('shows none of it for a company that is not on a plan with it', async () => {
    api.company.mockResolvedValue({ company: { ...company, isBranded: false } })
    renderAt('/companies/emp-1', <CompanyProfile />, '/companies/:id')

    await screen.findByRole('heading', { level: 1, name: 'Acme Ltd' })
    expect(screen.queryByRole('heading', { name: 'Why work with us' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Gallery' })).not.toBeInTheDocument()
  })

  it('the editor saves the cover, gallery and text', async () => {
    api.company.mockResolvedValue({ company: { ...company, isBranded: true, coverImageUrl: '/api/uploads/logo/c.jpg', gallery: ['/api/uploads/logo/g1.jpg'], whyWorkWithUs: 'Great people.' } })
    api.updateProfile.mockResolvedValue({ success: true })
    renderAt('/company-page', <CompanyPageEditor />)

    const text = await screen.findByLabelText('Why work with us')
    await waitFor(() => expect(text).toHaveValue('Great people.'))
    fireEvent.change(text, { target: { value: 'Great people and snacks.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save company page' }))

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ coverImageUrl: '/api/uploads/logo/c.jpg', gallery: ['/api/uploads/logo/g1.jpg'], whyWorkWithUs: 'Great people and snacks.' }))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('on Free it says the page needs a plan, and the server refusal is shown', async () => {
    api.company.mockResolvedValue({ company: { ...company, isBranded: false } })
    api.updateProfile.mockRejectedValue(Object.assign(new Error('A branded company page is part of the Starter and Business plans.'), { code: 'PLAN_REQUIRED' }))
    renderAt('/company-page', <CompanyPageEditor />)

    expect(await screen.findByText(/only shows on your page once you are on one of them/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Why work with us'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save company page' }))

    expect(await screen.findByText('A branded company page is part of the Starter and Business plans.')).toBeInTheDocument()
  })

  it('adds a gallery picture from an upload, up to six', async () => {
    api.company.mockResolvedValue({ company: { ...company, isBranded: true, gallery: [] } })
    api.upload.mockResolvedValue({ file: { url: '/api/uploads/logo/new.jpg' } })
    renderAt('/company-page', <CompanyPageEditor />)

    const input = await screen.findByLabelText('Add gallery picture')
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })

    expect(await screen.findByRole('img', { name: 'Gallery 1' })).toHaveAttribute('src', '/api/uploads/logo/new.jpg')
    expect(screen.getByText('Gallery (1 of 6)')).toBeInTheDocument()
  })
})
