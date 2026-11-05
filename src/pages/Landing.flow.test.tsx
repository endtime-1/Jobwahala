import { fireEvent, render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWhatsAppInvite, recentAge } from '../components/landing/types'
import Landing from './Landing'
import { setFeaturesForTests } from '../lib/features'

const apiGetJobsMock = vi.fn()
const apiGetPlatformStatsMock = vi.fn()
const apiGetHiringCompaniesMock = vi.fn()
const apiCreateInterestSignupMock = vi.fn()

vi.mock('../lib/api', () => ({
  apiGetJobs: (...args: unknown[]) => apiGetJobsMock(...args),
  apiGetPlatformStats: (...args: unknown[]) => apiGetPlatformStatsMock(...args),
  apiGetHiringCompanies: (...args: unknown[]) => apiGetHiringCompaniesMock(...args),
  apiCreateInterestSignup: (...args: unknown[]) => apiCreateInterestSignupMock(...args),
}))

const recent = new Date(Date.now() - 2 * 86_400_000).toISOString()

const renderLanding = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </HelmetProvider>,
  )

describe('Landing page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGetJobsMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-1',
          title: 'Hotel Receptionist',
          description: 'Front desk and customer service for guests',
          category: 'Hospitality',
          location: 'Kumasi',
          createdAt: recent,
          employer: { employerProfile: { companyName: 'Achiba Star Hotel' } },
        },
        {
          id: 'job-2',
          title: 'Financial Consultant',
          description: 'Accounting and Excel reporting',
          category: 'Finance',
          location: 'Accra',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    })
    apiGetHiringCompaniesMock.mockResolvedValue({ companies: [] })
    apiGetPlatformStatsMock.mockResolvedValue({
      success: true,
      stats: { counts: { openJobs: 2, freelancers: 1, seekers: 7, employers: 4, activeServices: 1, totalTalent: 8 } },
    })
  })

  it('leads with the job portal and two clear calls to action', () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/work without the wahala/i)
    expect(screen.getByText(/real jobs from employers you can check/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /find a job/i })[0]).toHaveAttribute('href', '/jobs')
    expect(screen.getAllByRole('link', { name: /post a job free/i })[0]).toHaveAttribute('href', '/onboarding?role=employer')
  })

  it('no longer promises escrow or mobile money payouts', () => {
    const { container } = renderLanding()

    expect(container.textContent).not.toMatch(/escrow|mobile money/i)
  })

  it('ranks real open jobs for the skills a visitor types, before signup', async () => {
    renderLanding()

    const input = await screen.findByLabelText(/add your skills/i)
    fireEvent.change(input, { target: { value: 'receptionist' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const result = await screen.findAllByRole('link', { name: /hotel receptionist/i })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveAttribute('href', '/jobs/job-1')
    expect(screen.getAllByText(/\d+%/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/matches: receptionist/i).length).toBeGreaterThan(0)
  })

  it('says so honestly when no open role matches', async () => {
    renderLanding()

    const input = await screen.findByLabelText(/add your skills/i)
    fireEvent.change(input, { target: { value: 'welding' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByText(/no open role matches that yet/i)).toBeInTheDocument()
  })

  it('shows real community numbers, and no age on stale roles', async () => {
    renderLanding()

    expect(await screen.findByText(/already here/i)).toHaveTextContent(/8 professionals/)
    expect(screen.getAllByText('2d ago').length).toBeGreaterThan(0)
    expect(screen.queryByText(/mo ago/)).not.toBeInTheDocument()
  })

  it('still renders useful content when the API is down', async () => {
    apiGetJobsMock.mockRejectedValue(new Error('offline'))
    apiGetPlatformStatsMock.mockRejectedValue(new Error('offline'))

    renderLanding()

    expect(await screen.findByText(/be the first employer people see/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /terms/i })).toHaveAttribute('href', '/terms')
  })
})

describe('landing helpers', () => {
  it('builds a WhatsApp invite with the site address', () => {
    const url = new URL(buildWhatsAppInvite('https://www.jobwahala.com'))

    expect(url.origin).toBe('https://wa.me')
    expect(url.searchParams.get('text')).toContain('https://www.jobwahala.com')
  })

  it('hides ages older than 45 days', () => {
    expect(recentAge(new Date(Date.now() - 10 * 86_400_000).toISOString())).toBe('10d ago')
    expect(recentAge(new Date(Date.now() - 200 * 86_400_000).toISOString())).toBe('')
    expect(recentAge(undefined)).toBe('')
  })
})

describe('Landing page quick wins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGetJobsMock.mockResolvedValue({ jobs: [] })
    apiGetHiringCompaniesMock.mockResolvedValue({ companies: [] })
    apiGetPlatformStatsMock.mockResolvedValue({ success: true, stats: { counts: {} } })
  })

  it('offers a plain keyword and town search in the hero', () => {
    renderLanding()

    expect(screen.getByRole('search', { name: /search jobs/i })).toBeInTheDocument()
  })

  it('gives the CV builder its own section that links to the tool', () => {
    renderLanding()

    expect(screen.getByRole('heading', { name: /no cv yet/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /build my cv/i })).toHaveAttribute('href', '/cv-generator')
    expect(screen.getByText(/example only/i)).toBeInTheDocument()
  })

  it('shows who is hiring, linking each company to its page', async () => {
    apiGetHiringCompaniesMock.mockResolvedValue({
      companies: [
        { id: 'emp-1', companyName: 'Achiba Star Hotel', logoUrl: '/api/uploads/logo/a.png', isVerified: true, openRoles: 2 },
        { id: 'emp-2', companyName: 'Kumasi Foods', logoUrl: null, isVerified: false, openRoles: 1 },
      ],
    })

    renderLanding()

    const hotel = await screen.findByRole('link', { name: /achiba star hotel/i })
    expect(hotel).toHaveAttribute('href', '/companies/emp-1')
    expect(hotel).toHaveTextContent('2 open roles')
    expect(screen.getByRole('link', { name: /kumasi foods/i })).toHaveTextContent('1 open role')
    expect(screen.getByRole('img', { name: 'Achiba Star Hotel logo' })).toBeInTheDocument()
  })

  it('shows no hiring strip when no company has open roles', async () => {
    renderLanding()

    await screen.findByText(/be the first employer people see/i)
    expect(screen.queryByText(/who is hiring/i)).not.toBeInTheDocument()
  })
})

describe('Freelance gigs sign-up', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGetJobsMock.mockResolvedValue({ jobs: [] })
    apiGetHiringCompaniesMock.mockResolvedValue({ companies: [] })
    apiGetPlatformStatsMock.mockResolvedValue({ success: true, stats: { counts: {} } })
    apiCreateInterestSignupMock.mockResolvedValue({ success: true })
  })

  const box = () => screen.getByLabelText(/email or phone number/i)
  const send = () => fireEvent.click(screen.getByRole('button', { name: /tell me when it opens/i }))

  it('says gigs are coming soon and saves an email with its source tag', async () => {
    renderLanding()

    expect(screen.getByRole('heading', { name: /freelance gigs/i })).toBeInTheDocument()
    expect(screen.getByText(/coming soon/i, { selector: 'p' })).toBeInTheDocument()

    fireEvent.change(box(), { target: { value: 'ama@example.com' } })
    send()

    expect(await screen.findByText(/you are on the list/i)).toBeInTheDocument()
    expect(apiCreateInterestSignupMock).toHaveBeenCalledWith({
      email: 'ama@example.com',
      source: 'landing_freelance_gigs',
      website: '',
    })
  })

  it('treats anything without an @ as a phone number', async () => {
    renderLanding()

    fireEvent.change(box(), { target: { value: '024 123 4567' } })
    send()

    await screen.findByText(/you are on the list/i)
    expect(apiCreateInterestSignupMock).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '024 123 4567', source: 'landing_freelance_gigs' }),
    )
  })

  it('asks for a real contact before sending, and shows server errors', async () => {
    renderLanding()

    fireEvent.change(box(), { target: { value: 'not-a-contact' } })
    send()
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email or phone/i)
    expect(apiCreateInterestSignupMock).not.toHaveBeenCalled()

    apiCreateInterestSignupMock.mockRejectedValue(new Error('Too many requests'))
    fireEvent.change(box(), { target: { value: 'ama@example.com' } })
    send()
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i)
  })
})

describe('Landing page and the freelance flag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGetJobsMock.mockResolvedValue({ jobs: [] })
    apiGetHiringCompaniesMock.mockResolvedValue({ companies: [] })
    apiGetPlatformStatsMock.mockResolvedValue({ success: true, stats: { counts: {} } })
  })

  it('shows the waitlist and no freelance links while the flag is off', () => {
    setFeaturesForTests({ freelanceEnabled: false })
    const { container } = renderLanding()

    expect(screen.getByRole('heading', { name: /freelance gigs/i })).toBeInTheDocument()
    expect(container.querySelector('a[href^="/freelancers"]')).toBeNull()
  })

  it('swaps the waitlist for a link to freelancers when the flag is on', () => {
    setFeaturesForTests({ freelanceEnabled: true })
    const { container } = renderLanding()

    expect(screen.queryByRole('button', { name: /tell me when it opens/i })).not.toBeInTheDocument()
    expect(container.querySelector('a[href="/freelancers"]')).not.toBeNull()
  })
})

describe('Landing page job rows and employer verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGetHiringCompaniesMock.mockResolvedValue({ companies: [] })
    apiGetPlatformStatsMock.mockResolvedValue({ success: true, stats: { counts: {} } })
  })

  it('labels recent jobs from unverified companies and leaves verified ones alone', async () => {
    const base = { description: 'Work', category: 'Hospitality', location: 'Accra', createdAt: recent }
    apiGetJobsMock.mockResolvedValue({
      jobs: [
        { ...base, id: 'j1', title: 'Cook', employer: { isVerified: true, employerProfile: { companyName: 'Verified Foods' } } },
        { ...base, id: 'j2', title: 'Driver', employer: { isVerified: false, employerProfile: { companyName: 'Unknown Ltd' } } },
      ],
    })

    renderLanding()

    await screen.findAllByText('Driver')
    expect(screen.getAllByText('Unverified employer')).toHaveLength(1)
  })
})
