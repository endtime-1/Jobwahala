import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTestQueryClient } from '../../test/queryClient'
import { changePercent, totalWaiting, type AdminHealth, type AdminOverview } from '../../lib/adminOverview'
import AdminDashboard from './AdminDashboard'

const api = vi.hoisted(() => ({ overview: vi.fn(), health: vi.fn(), reports: vi.fn(), users: vi.fn(), jobs: vi.fn(), services: vi.fn(), verifications: vi.fn(), disputes: vi.fn() }))

vi.mock('../../lib/api', () => ({
  apiGetAdminOverview: (...a: unknown[]) => api.overview(...a),
  apiGetAdminHealth: (...a: unknown[]) => api.health(...a),
  apiGetAdminReports: (...a: unknown[]) => api.reports(...a),
  apiGetAdminUsers: (...a: unknown[]) => api.users(...a),
  apiGetAdminJobs: (...a: unknown[]) => api.jobs(...a),
  apiGetAdminServices: (...a: unknown[]) => api.services(...a),
  apiGetAdminVerifications: (...a: unknown[]) => api.verifications(...a),
  apiGetAdminDisputes: (...a: unknown[]) => api.disputes(...a),
}))

const days = (n: number) => Array.from({ length: 14 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, count: i === 13 ? n : 0 }))
const overview = (overrides: Partial<AdminOverview> = {}): AdminOverview => ({
  generatedAt: new Date().toISOString(),
  users: { total: 101, seekers: 90, employers: 8, freelancers: 2, admins: 1, new7: 12, new30: 40 },
  employers: { total: 8, verified: 3, unverified: 5 },
  jobs: { active: 5, new7: 2 },
  applications: { total: 300, new7: 25 },
  revenue: { thisMonthPesewas: 45000, lastMonthPesewas: 30000, paymentsThisMonth: 3, mode: 'live' },
  queues: { verifications: 4, reports: 6, courses: 2, providers: 0, disputes: 0 },
  series: { signups: days(3), applications: days(0), jobs: days(1) },
  ...overrides,
})

const health = (items: AdminHealth['items']): AdminHealth => ({ checkedAt: new Date().toISOString(), summary: { errors: items.filter((i) => i.status === 'error').length, warnings: items.filter((i) => i.status === 'warn').length }, items })

const verification = (id: string, status: string, company: string) => ({
  id, type: 'BUSINESS', status, details: 'Registration number CS1.', registrationNumber: 'CS1', documentUrl: 'https://x/c.pdf', address: 'Accra', contactEmail: 'hr@x.example', contactPhone: '+233241234567', contactVerifiedAt: '2026-03-21T00:00:00.000Z', createdAt: '2026-03-20T00:00:00.000Z',
  user: { id: `u-${id}`, email: `${id}@x.example`, role: 'EMPLOYER', employerProfile: { companyName: company } },
})

const open = (initialTab?: 'reports') =>
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <MemoryRouter>
        <AdminDashboard initialTab={initialTab} />
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  api.overview.mockResolvedValue(overview())
  api.health.mockResolvedValue(health([{ key: 'database', label: 'Database', status: 'ok', detail: 'Connected.' }]))
  for (const key of ['reports', 'users', 'jobs', 'services', 'disputes'] as const) api[key].mockResolvedValue({ [key]: [] })
  api.verifications.mockResolvedValue({ verifications: [verification('v1', 'PENDING', 'Waiting Ltd'), verification('v2', 'APPROVED', 'Decided Ltd')] })
})

describe('the numbers behind the overview', () => {
  it('adds up what is waiting, and works out the change since last month', () => {
    expect(totalWaiting(overview().queues)).toBe(12)
    expect(changePercent(45000, 30000)).toBe(50)
    expect(changePercent(15000, 30000)).toBe(-50)
    expect(changePercent(1000, 0)).toBeNull()
  })
})

describe('the admin overview', () => {
  it('is the page the admin lands on', async () => {
    open()

    expect(await screen.findByRole('region', { name: 'Needs your attention' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'The platform in numbers' })).toBeInTheDocument()
  })

  it('lists what is waiting with counts, and each row opens the right tab', async () => {
    open()
    const attention = await screen.findByRole('region', { name: 'Needs your attention' })

    expect(within(attention).getByText('Business verifications to review')).toBeInTheDocument()
    expect(within(attention).getByText('Reports to look at')).toBeInTheDocument()
    expect(within(attention).queryByText('Open disputes')).not.toBeInTheDocument()

    fireEvent.click(within(attention).getByRole('button', { name: 'Open: Business verifications to review' }))

    expect(await screen.findByText('Waiting Ltd')).toBeInTheDocument()
  })

  it('says so when nothing is waiting', async () => {
    api.overview.mockResolvedValue(overview({ queues: { verifications: 0, reports: 0, courses: 0, providers: 0, disputes: 0 } }))
    open()

    expect(await screen.findByText('Nothing is waiting for you.')).toBeInTheDocument()
  })

  it('shows people, jobs, applications, verified employers and revenue with the change on last month', async () => {
    open()
    const numbers = await screen.findByRole('region', { name: 'The platform in numbers' })

    expect(within(numbers).getByText('101')).toBeInTheDocument()
    expect(within(numbers).getByText('12 new this week, 40 this month')).toBeInTheDocument()
    expect(within(numbers).getByText('3 of 8')).toBeInTheDocument()
    expect(within(numbers).getByText('5 not verified yet')).toBeInTheDocument()
    expect(within(numbers).getByText('GHS 450.00')).toBeInTheDocument()
    expect(within(numbers).getByText(/3 payments, \+50% vs last month/)).toBeInTheDocument()
  })

  it('marks revenue taken in test mode, and shows the 14-day charts', async () => {
    api.overview.mockResolvedValue(overview({ revenue: { thisMonthPesewas: 20000, lastMonthPesewas: 0, paymentsThisMonth: 1, mode: 'test' } }))
    open()

    expect(await screen.findByText(/1 payment \(test mode\)/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Sign-ups: 3 in the last 14 days' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Applications: 0 in the last 14 days' })).toBeInTheDocument()
  })

  it('shows a plain message if the overview cannot load', async () => {
    api.overview.mockRejectedValue(new Error('down'))
    open()

    expect(await screen.findByRole('alert')).toHaveTextContent('could not load the overview')
  })
})

describe('the system health tab', () => {
  it('shows broken things first, with a plain sentence for each', async () => {
    api.health.mockResolvedValue(
      health([
        { key: 'database', label: 'Database', status: 'ok', detail: 'Connected.' },
        { key: 'email', label: 'Email', status: 'error', detail: 'No email service is set up.' },
        { key: 'payments', label: 'Payments', status: 'warn', detail: 'Paystack is in test mode.' },
        { key: 'google', label: 'Google sign-in', status: 'off', detail: 'Not set up (optional).' },
      ]),
    )
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'System' }))

    expect(await screen.findByText('1 to fix, 1 to look at.', { exact: false })).toBeInTheDocument()
    const names = screen.getAllByRole('listitem').map((item) => item.textContent ?? '')
    expect(names[0]).toContain('Email')
    expect(names[0]).toContain('Broken or missing')
    expect(names[1]).toContain('Payments')
    expect(names[names.length - 1]).toContain('Google sign-in')
  })

  it('says everything is set up when it is, and can check again', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'System' }))

    expect(await screen.findByText('Everything is set up.', { exact: false })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /check again/i }))
    await waitFor(() => expect(api.health.mock.calls.length).toBeGreaterThan(1))
  })
})

describe('the verification queue', () => {
  it('starts with the requests waiting for review, and All shows the decided ones too', async () => {
    open('reports')
    fireEvent.click(await screen.findByRole('button', { name: 'Verifications' }))

    expect(await screen.findByText('Waiting Ltd')).toBeInTheDocument()
    expect(screen.queryByText('Decided Ltd')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Waiting for review \(1\)/ })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /^All [(]2[)]/ }))

    expect(await screen.findByText('Decided Ltd')).toBeInTheDocument()
    const cards = screen.getAllByText(/Ltd$/).map((el) => el.textContent)
    expect(cards.indexOf('Waiting Ltd')).toBeLessThan(cards.indexOf('Decided Ltd'))
  })

  it('says so when nothing is waiting', async () => {
    api.verifications.mockResolvedValue({ verifications: [verification('v2', 'APPROVED', 'Decided Ltd')] })
    open('reports')
    fireEvent.click(await screen.findByRole('button', { name: 'Verifications' }))

    expect(await screen.findByText('Nothing is waiting for review.')).toBeInTheDocument()
  })
})
