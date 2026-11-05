import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matchesSalaryFloor, parseSalaryFloor } from '../lib/jobSearch'
import { toJobPayload, makeInitialJobForm } from './dashboards/employer/utils'
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

const job = (id: string, title: string, salaryMin: number | null, salaryMax: number | null) => ({
  id,
  title,
  description: `${title} description`,
  location: 'Accra',
  salary: salaryMin ? `GHS ${salaryMin}` : 'Negotiable',
  salaryMin,
  salaryMax,
  type: 'Full-time',
  category: 'General',
  createdAt: '2026-03-21T00:00:00.000Z',
  employer: { id: `e-${id}`, email: `${id}@example.com`, isVerified: true, employerProfile: { companyName: `Company ${id}` } },
})

describe('salary matching helpers', () => {
  it('reads the pay level from a link, ignoring nonsense', () => {
    expect(parseSalaryFloor('3000')).toBe(3000)
    expect(parseSalaryFloor('2500.9')).toBe(2500)
    for (const bad of [null, undefined, '', '0', '-5', 'lots']) expect(parseSalaryFloor(bad)).toBe(0)
  })

  it('wants pay that reaches the level, using the top of a range', () => {
    expect(matchesSalaryFloor({ salaryMin: 3000, salaryMax: 4500 }, 4000)).toBe(true)
    expect(matchesSalaryFloor({ salaryMin: 3000, salaryMax: 4500 }, 5000)).toBe(false)
    expect(matchesSalaryFloor({ salaryMin: 3000, salaryMax: null }, 3000)).toBe(true)
    expect(matchesSalaryFloor({ salaryMin: null, salaryMax: 6000 }, 5000)).toBe(true)
  })

  it('cannot match a job with no pay numbers, but no filter shows everything', () => {
    expect(matchesSalaryFloor({ salaryMin: null, salaryMax: null }, 1000)).toBe(false)
    expect(matchesSalaryFloor({}, 1000)).toBe(false)
    expect(matchesSalaryFloor({ salaryMin: null, salaryMax: null }, 0)).toBe(true)
  })
})

describe('the Pay from filter on the job board', () => {
  beforeEach(() => {
    apiGetJobsMock.mockResolvedValue({
      jobs: [job('1', 'Cook', 1500, 2000), job('2', 'Accountant', 4000, 6000), job('3', 'Manager', 9000, null), job('4', 'Helper', null, null)],
    })
  })

  const renderBoard = (url = '/jobs') =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <JobListings />
      </MemoryRouter>,
    )

  it('shows every job until a level is picked', async () => {
    renderBoard()

    for (const title of ['Cook', 'Accountant', 'Manager', 'Helper']) expect(await screen.findByText(title)).toBeInTheDocument()
    expect(screen.getByLabelText('Pay from')).toHaveValue('0')
  })

  it('keeps only jobs whose pay reaches the level, and drops jobs with no pay figures', async () => {
    renderBoard()
    await screen.findByText('Cook')

    fireEvent.change(screen.getByLabelText('Pay from'), { target: { value: '3000' } })

    expect(screen.getByText('Accountant')).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
    expect(screen.queryByText('Cook')).not.toBeInTheDocument()
    expect(screen.queryByText('Helper')).not.toBeInTheDocument()
  })

  it('starts from a link such as ?minSalary=5000', async () => {
    renderBoard('/jobs?minSalary=5000')

    expect(await screen.findByText('Accountant')).toBeInTheDocument()
    expect(screen.getByLabelText('Pay from')).toHaveValue('5000')
    expect(screen.queryByText('Cook')).not.toBeInTheDocument()
  })

  it('works together with Verified employers only, and Clear puts everything back', async () => {
    renderBoard('/jobs?minSalary=5000')
    await screen.findByText('Accountant')

    fireEvent.click(screen.getAllByRole('button', { name: /clear/i })[0])

    expect(await screen.findByText('Cook')).toBeInTheDocument()
    expect(screen.getByLabelText('Pay from')).toHaveValue('0')
  })
})

describe('posting pay as numbers', () => {
  it('sends the numbers, and nothing when they are empty', () => {
    const form = { ...makeInitialJobForm(), title: 'Cook', description: 'Kitchen', salaryMin: '3,000', salaryMax: '4500' }

    expect(toJobPayload(form)).toMatchObject({ title: 'Cook', salaryMin: 3000, salaryMax: 4500 })

    const empty = toJobPayload({ ...form, salaryMin: '', salaryMax: '  ' })
    expect(empty).not.toHaveProperty('salaryMin')
    expect(empty).not.toHaveProperty('salaryMax')
  })

  it('allows a single figure', () => {
    const payload = toJobPayload({ ...makeInitialJobForm(), salaryMin: '3000', salaryMax: '' })

    expect(payload).toMatchObject({ salaryMin: 3000 })
    expect(payload).not.toHaveProperty('salaryMax')
  })

  it('ignores text that is not a number', () => {
    expect(toJobPayload({ ...makeInitialJobForm(), salaryMin: 'lots' })).not.toHaveProperty('salaryMin')
  })
})
