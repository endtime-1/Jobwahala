import { render, screen, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyApplications from './MyApplications'

const apiGetMyApplicationsMock = vi.fn()

vi.mock('../lib/api', () => ({
  apiGetMyApplications: (...args: unknown[]) => apiGetMyApplicationsMock(...args),
}))

const application = (overrides: Record<string, unknown> = {}) => ({
  id: 'app-1',
  status: 'INTERVIEW',
  statusLabel: 'Interview',
  appliedAt: '2026-10-01T09:00:00.000Z',
  lastChangedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  job: { id: 'job-1', title: 'Hotel Receptionist', location: 'Kumasi', type: 'Full-time', isOpen: true },
  company: { id: 'emp-1', name: 'Achiba Star Hotel', logoUrl: null },
  ...overrides,
})

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <MyApplications />
      </MemoryRouter>
    </HelmetProvider>,
  )

describe('My applications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists each application with job, company, date applied, status and last change', async () => {
    apiGetMyApplicationsMock.mockResolvedValue({ applications: [application()] })

    renderPage()

    const row = within(await screen.findByRole('listitem'))
    expect(row.getByRole('link', { name: 'Hotel Receptionist' })).toHaveAttribute('href', '/jobs/job-1')
    expect(row.getByRole('link', { name: 'Achiba Star Hotel' })).toHaveAttribute('href', '/companies/emp-1')
    expect(row.getByText('Interview')).toBeInTheDocument()
    expect(row.getByText('Applied 1 Oct 2026')).toBeInTheDocument()
    expect(row.getByText(/updated 2h ago/i)).toBeInTheDocument()
    expect(row.getByText(/would like to talk to you/i)).toBeInTheDocument()
  })

  it('shows every stage in plain words, calling a rejection "Not selected"', async () => {
    apiGetMyApplicationsMock.mockResolvedValue({
      applications: [
        application({ id: 'a', status: 'SUBMITTED', statusLabel: 'New' }),
        application({ id: 'b', status: 'OFFERED', statusLabel: 'Offered' }),
        application({ id: 'c', status: 'REJECTED', statusLabel: 'Not selected' }),
      ],
    })

    renderPage()

    expect(await screen.findAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('Offered')).toBeInTheDocument()
    expect(screen.getByText('Not selected')).toBeInTheDocument()
    expect(screen.queryByText(/reject/i)).not.toBeInTheDocument()
    expect(screen.getByText(/new roles are added every day/i)).toBeInTheDocument()
  })

  it('keeps a job you applied to even after it closed, without linking to it', async () => {
    apiGetMyApplicationsMock.mockResolvedValue({
      applications: [application({ job: { id: 'job-1', title: 'Hotel Receptionist', isOpen: false } })],
    })

    renderPage()

    expect(await screen.findByText('Hotel Receptionist')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Hotel Receptionist' })).not.toBeInTheDocument()
    expect(screen.getByText(/no longer taking applications/i)).toBeInTheDocument()
  })

  it('invites you to find a job when there are none', async () => {
    apiGetMyApplicationsMock.mockResolvedValue({ applications: [] })

    renderPage()

    expect(await screen.findByText(/have not applied for anything yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find a job/i })).toHaveAttribute('href', '/jobs')
  })

  it('says so when the list cannot be loaded', async () => {
    apiGetMyApplicationsMock.mockRejectedValue(new Error('offline'))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/offline/i)
  })
})
