import { fireEvent, render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWhatsAppInvite, recentAge } from '../components/landing/types'
import Landing from './Landing'

const apiGetJobsMock = vi.fn()
const apiGetPlatformStatsMock = vi.fn()

vi.mock('../lib/api', () => ({
  apiGetJobs: (...args: unknown[]) => apiGetJobsMock(...args),
  apiGetPlatformStats: (...args: unknown[]) => apiGetPlatformStatsMock(...args),
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
    apiGetPlatformStatsMock.mockResolvedValue({
      success: true,
      stats: { counts: { openJobs: 2, freelancers: 1, seekers: 7, employers: 4, activeServices: 1, totalTalent: 8 } },
    })
  })

  it('leads with the promise and switches copy for employers', async () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/work without the wahala/i)
    expect(screen.getByRole('link', { name: /create my free profile/i })).toHaveAttribute('href', '/onboarding?role=seeker')

    fireEvent.click(screen.getByRole('tab', { name: /i want to hire/i }))

    expect(screen.getByRole('link', { name: /post a job for free/i })).toHaveAttribute('href', '/onboarding?role=employer')
    expect(screen.getByText(/hiring on jobwahala/i)).toBeInTheDocument()
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
    apiGetPlatformStatsMock.mockResolvedValue({ success: true, stats: { counts: {} } })
  })

  it('offers a plain keyword and town search to people looking for work, but not to employers', () => {
    renderLanding()

    expect(screen.getByRole('search', { name: /search jobs/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /i want to hire/i }))

    expect(screen.queryByRole('search', { name: /search jobs/i })).not.toBeInTheDocument()
  })

  it('gives the CV builder its own section that links to the tool', () => {
    renderLanding()

    expect(screen.getByRole('heading', { name: /no cv yet/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /build my cv/i })).toHaveAttribute('href', '/cv-generator')
    expect(screen.getByText(/example only/i)).toBeInTheDocument()
  })
})
