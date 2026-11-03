import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobListings from './JobListings'

const apiGetJobsMock = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('../components/VerifiedBadge', () => ({ default: () => null }))
vi.mock('../components/ReportModal', () => ({ default: () => null }))

vi.mock('../lib/api', () => ({
  apiGetJobs: (...args: unknown[]) => apiGetJobsMock(...args),
  apiCompareJobs: vi.fn(),
}))

const job = (id: string, title: string) => ({
  id,
  title,
  description: `${title} description`,
  location: 'Accra',
  salary: '3000',
  type: 'Full-time',
  category: 'General',
  createdAt: '2026-03-21T00:00:00.000Z',
  employer: { id: `e-${id}`, email: `${id}@example.com`, employerProfile: { companyName: `Company ${id}` } },
})

describe('JobListings ?search= prefill (used by the homepage)', () => {
  beforeEach(() => {
    apiGetJobsMock.mockResolvedValue({
      jobs: [job('1', 'Hotel Receptionist'), job('2', 'Financial Consultant')],
    })
  })

  it('starts with the search box filled and only matching roles shown', async () => {
    render(
      <MemoryRouter initialEntries={['/jobs?search=receptionist']}>
        <JobListings />
      </MemoryRouter>,
    )

    expect((await screen.findAllByDisplayValue('receptionist')).length).toBeGreaterThan(0)
    expect(await screen.findByText('Hotel Receptionist')).toBeInTheDocument()
    expect(screen.queryByText('Financial Consultant')).not.toBeInTheDocument()
  })

  it('narrows by the town from the homepage search', async () => {
    apiGetJobsMock.mockResolvedValue({
      jobs: [{ ...job('1', 'Hotel Receptionist'), location: 'Kumasi' }, { ...job('2', 'Cashier'), location: 'Accra' }],
    })

    render(
      <MemoryRouter initialEntries={['/jobs?location=kumasi']}>
        <JobListings />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Hotel Receptionist')).toBeInTheDocument()
    expect(screen.queryByText('Cashier')).not.toBeInTheDocument()
    expect((await screen.findAllByDisplayValue('kumasi')).length).toBeGreaterThan(0)
  })
})
