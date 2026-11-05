import { fireEvent, render, screen } from '@testing-library/react'
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

const job = (id: string, title: string, isVerified: boolean) => ({
  id,
  title,
  description: `${title} description`,
  location: 'Accra',
  salary: '3000',
  type: 'Full-time',
  category: 'General',
  createdAt: '2026-03-21T00:00:00.000Z',
  employer: { id: `e-${id}`, email: `${id}@example.com`, isVerified, employerProfile: { companyName: `Company ${id}` } },
})

const renderListings = (url = '/jobs') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <JobListings />
    </MemoryRouter>,
  )

describe('Verified and unverified employers on the jobs board', () => {
  beforeEach(() => {
    apiGetJobsMock.mockResolvedValue({
      jobs: [job('1', 'Hotel Receptionist', true), job('2', 'Cashier', false), job('3', 'Driver', false)],
    })
  })

  it('labels jobs from unverified companies, and only those', async () => {
    renderListings()

    await screen.findByText('Hotel Receptionist')
    expect(screen.getAllByText('Unverified employer')).toHaveLength(2)
  })

  it('keeps the order the server sends: verified first', async () => {
    renderListings()

    await screen.findByText('Hotel Receptionist')
    const titles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(titles.indexOf('Hotel Receptionist')).toBeLessThan(titles.indexOf('Cashier'))
  })

  it('"Verified employers only" hides unverified companies, and can be switched off again', async () => {
    renderListings()
    await screen.findByText('Cashier')

    const toggle = screen.getByRole('button', { name: /verified employers only/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Hotel Receptionist')).toBeInTheDocument()
    expect(screen.queryByText('Cashier')).not.toBeInTheDocument()
    expect(screen.queryByText('Driver')).not.toBeInTheDocument()
    expect(screen.queryByText('Unverified employer')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.getByText('Cashier')).toBeInTheDocument()
  })

  it('starts with the filter on when the link says verified=1', async () => {
    renderListings('/jobs?verified=1')

    await screen.findByText('Hotel Receptionist')
    expect(screen.getByRole('button', { name: /verified employers only/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Cashier')).not.toBeInTheDocument()
  })

  it('Clear brings the unverified jobs back', async () => {
    renderListings('/jobs?verified=1')
    await screen.findByText('Hotel Receptionist')

    fireEvent.click(screen.getAllByRole('button', { name: /clear/i })[0])

    expect(await screen.findByText('Cashier')).toBeInTheDocument()
  })
})
