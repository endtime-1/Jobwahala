import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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

describe('JobListings field, type and country links', () => {
  const mixed = [
    { ...job('1', 'Hotel Receptionist'), category: 'Tourism & Hotels', type: 'Full-time' },
    { ...job('2', 'Financial Consultant'), category: 'Finance', type: 'Contract' },
    { ...job('3', 'Branch Accountant'), category: 'Finance', type: 'Full-time', location: 'Nairobi, Kenya' },
  ]

  beforeEach(() => {
    apiGetJobsMock.mockResolvedValue({ jobs: mixed })
  })

  it('filters by the field in the link', async () => {
    render(
      <MemoryRouter initialEntries={['/jobs?category=Finance']}>
        <JobListings />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Financial Consultant')).toBeInTheDocument()
    expect(screen.getByText('Branch Accountant')).toBeInTheDocument()
    expect(screen.queryByText('Hotel Receptionist')).not.toBeInTheDocument()
  })

  it('filters by the job type in the link', async () => {
    render(
      <MemoryRouter initialEntries={['/jobs?type=Contract']}>
        <JobListings />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Financial Consultant')).toBeInTheDocument()
    expect(screen.queryByText('Branch Accountant')).not.toBeInTheDocument()
  })

  it('shows only jobs in the country on a country page', async () => {
    render(
      <MemoryRouter initialEntries={['/jobs-in/kenya']}>
        <Routes>
          <Route path="/jobs-in/:country" element={<JobListings />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Branch Accountant')).toBeInTheDocument()
    expect(screen.queryByText('Hotel Receptionist')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/real jobs in kenya/i)
  })
})
