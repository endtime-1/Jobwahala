import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultClosingDate, latestClosingDate } from '../../../lib/jobLifecycle'
import EmployerJobsPanel from './EmployerJobsPanel'
import type { EmployerJob } from './types'

const apiCreateJobMock = vi.fn()

vi.mock('../../../lib/api', () => ({
  apiCreateJob: (...args: unknown[]) => apiCreateJobMock(...args),
  apiGenerateJobDraft: vi.fn(),
  apiUpdateJobStatus: vi.fn(),
  apiUpdateJob: vi.fn(),
  apiDuplicateJob: vi.fn(),
  apiExtendJob: vi.fn(),
}))

const onJobCreated = vi.fn()

const renderPanel = (jobs: EmployerJob[] = [], url = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <EmployerJobsPanel
        jobs={jobs}
        showCreateForm
        onToggleCreateForm={vi.fn()}
        onJobCreated={onJobCreated}
        onReviewApplicants={vi.fn()}
      />
    </MemoryRouter>,
  )

const fillRequired = () => {
  fireEvent.change(screen.getByPlaceholderText('Job title'), { target: { value: 'Cook' } })
  fireEvent.change(screen.getByPlaceholderText('Describe the role, responsibilities, and expectations...'), {
    target: { value: 'Kitchen work' },
  })
}

describe('Job form closing date and drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiCreateJobMock.mockResolvedValue({ job: { id: 'job-1' } })
  })

  it('asks for a closing date, 30 days out by default and at most 90', () => {
    renderPanel()

    const input = screen.getByLabelText(/closing date/i) as HTMLInputElement
    expect(input.required).toBe(true)
    expect(input.value).toBe(defaultClosingDate())
    expect(input.max).toBe(latestClosingDate())
  })

  it('publishes with the chosen closing date', async () => {
    renderPanel()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/closing date/i), { target: { value: latestClosingDate() } })

    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() =>
      expect(apiCreateJobMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Cook', closesAt: latestClosingDate() }),
      ),
    )
    expect(apiCreateJobMock.mock.calls[0][0]).not.toHaveProperty('status')
  })

  it('saves a draft without publishing', async () => {
    renderPanel()
    fillRequired()

    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() =>
      expect(apiCreateJobMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cook', status: 'DRAFT' })),
    )
  })

  it('sends pay as numbers when they are typed', async () => {
    renderPanel()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/pay from/i), { target: { value: '3000' } })
    fireEvent.change(screen.getByLabelText(/pay to/i), { target: { value: '4500' } })

    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() => expect(apiCreateJobMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cook', salaryMin: 3000, salaryMax: 4500 })))
  })

  it('sends no pay numbers when the boxes are empty', async () => {
    renderPanel()
    fillRequired()

    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() => expect(apiCreateJobMock).toHaveBeenCalled())
    expect(apiCreateJobMock.mock.calls[0][0]).not.toHaveProperty('salaryMin')
    expect(apiCreateJobMock.mock.calls[0][0]).not.toHaveProperty('salaryMax')
  })

  it('does not save a draft that is missing the basics', () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }))

    expect(apiCreateJobMock).not.toHaveBeenCalled()
  })

  it('highlights the job named in the expiry email link and offers Extend', () => {
    const job: EmployerJob = {
      id: 'job-9',
      title: 'Receptionist',
      status: 'ACTIVE',
      closesAt: new Date(Date.now() + 40 * 86_400_000).toISOString(),
      createdAt: new Date().toISOString(),
      _count: { applications: 2 },
    }

    renderPanel([job], '/dashboard?extend=job-9')

    expect(screen.getByRole('button', { name: /^extend$/i })).toBeInTheDocument()
  })
})
