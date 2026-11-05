import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTestQueryClient } from '../../test/queryClient'
import { setFeaturesForTests } from '../../lib/features'
import EmployerDashboard from './EmployerDashboard'

// Freelance is switched off (the default): /api/services/* answers 404.
setFeaturesForTests({ freelanceEnabled: false })

const api = vi.hoisted(() => ({ dashboard: vi.fn(), sent: vi.fn(), applicants: vi.fn() }))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'akoko', role: 'EMPLOYER', employerProfile: { companyName: 'Akoko Solutions LTD' } }, refreshUser: vi.fn() }),
}))
vi.mock('../../lib/api', () => ({
  apiGetDashboard: (...a: unknown[]) => api.dashboard(...a),
  apiGetSentServiceRequests: (...a: unknown[]) => api.sent(...a),
  apiGetJobApplicants: (...a: unknown[]) => api.applicants(...a),
}))
vi.mock('../../lib/realtime', () => ({ subscribeToRealtimeEvents: () => () => undefined }))

const dashboard = (verification: Record<string, unknown>) => ({
  jobs: [{ id: 'job-1', title: 'B2B SALES EXECUTIVE', status: 'ACTIVE', createdAt: '2026-11-05T12:43:44.000Z', closesAt: '2026-12-05T12:22:00.000Z', _count: { applications: 0 } }],
  recentApplications: [],
  unreadMessages: 0,
  verification,
})

const renderDashboard = () =>
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  api.applicants.mockResolvedValue({ applications: [] })
  api.sent.mockRejectedValue(Object.assign(new Error('Freelance gigs are not open yet.'), { code: 'FREELANCE_DISABLED' }))
})

describe('the employer dashboard when freelance is switched off', () => {
  it('still shows the jobs the company posted, because the freelance request list failing does not take the dashboard down', async () => {
    api.dashboard.mockResolvedValue(dashboard({ requiredType: 'BUSINESS', isVerified: false, verificationStatus: 'UNVERIFIED' }))
    renderDashboard()

    expect(await screen.findByText('B2B SALES EXECUTIVE')).toBeInTheDocument()
    expect(screen.queryByText(/Freelance gigs are not open yet/)).not.toBeInTheDocument()
    expect(screen.queryByText('No jobs posted yet.')).not.toBeInTheDocument()
  })

  it('says "Verified Business" only for a company that really is verified', async () => {
    api.dashboard.mockResolvedValue(dashboard({ requiredType: 'BUSINESS', isVerified: false, verificationStatus: 'UNVERIFIED' }))
    const unverified = renderDashboard()
    await screen.findByText('B2B SALES EXECUTIVE')
    expect(screen.queryAllByText('Verified Business')).toHaveLength(0)
    unverified.unmount()

    api.dashboard.mockResolvedValue(dashboard({ requiredType: 'BUSINESS', isVerified: true, verificationStatus: 'APPROVED' }))
    renderDashboard()
    await waitFor(() => expect(screen.getAllByText('Verified Business').length).toBeGreaterThan(0))
  })
})
