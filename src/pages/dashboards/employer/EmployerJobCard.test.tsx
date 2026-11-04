import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerJobCard from './EmployerJobCard'
import type { EmployerJob } from './types'

const apiUpdateJobStatusMock = vi.fn()
const apiUpdateJobMock = vi.fn()
const apiDuplicateJobMock = vi.fn()
const apiExtendJobMock = vi.fn()

vi.mock('../../../lib/api', () => ({
  apiUpdateJobStatus: (...args: unknown[]) => apiUpdateJobStatusMock(...args),
  apiUpdateJob: (...args: unknown[]) => apiUpdateJobMock(...args),
  apiDuplicateJob: (...args: unknown[]) => apiDuplicateJobMock(...args),
  apiExtendJob: (...args: unknown[]) => apiExtendJobMock(...args),
}))

const DAY = 86_400_000
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString()

const makeJob = (overrides: Partial<EmployerJob> = {}): EmployerJob => ({
  id: 'job-1',
  title: 'Receptionist',
  description: 'Front desk',
  location: 'Accra',
  type: 'Full-time',
  salary: 'GHS 3,000',
  category: 'Hospitality',
  status: 'ACTIVE',
  closesAt: inDays(20),
  createdAt: new Date().toISOString(),
  _count: { applications: 7 },
  ...overrides,
})

const onChanged = vi.fn()
const onReview = vi.fn()

const renderCard = (job: EmployerJob, props: { highlighted?: boolean } = {}) =>
  render(
    <MemoryRouter>
      <EmployerJobCard job={job} onChanged={onChanged} onReviewApplicants={onReview} {...props} />
    </MemoryRouter>,
  )

const button = (name: RegExp) => screen.queryByRole('button', { name })

describe('EmployerJobCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const mock of [apiUpdateJobStatusMock, apiUpdateJobMock, apiDuplicateJobMock, apiExtendJobMock]) {
      mock.mockResolvedValue({ success: true })
    }
  })

  it('shows the status and when the job closes', () => {
    renderCard(makeJob())

    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText(/closes .* \(20 days left\)/i)).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('pauses a live job', async () => {
    renderCard(makeJob())

    fireEvent.click(screen.getByRole('button', { name: /pause/i }))

    await waitFor(() => expect(apiUpdateJobStatusMock).toHaveBeenCalledWith('job-1', 'PAUSED'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('resumes a paused job and says the applicants are kept', async () => {
    renderCard(makeJob({ status: 'PAUSED' }))

    expect(screen.getByText(/applicants are kept/i)).toBeInTheDocument()
    expect(button(/pause/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    await waitFor(() => expect(apiUpdateJobStatusMock).toHaveBeenCalledWith('job-1', 'ACTIVE'))
  })

  it('publishes a draft, which only the employer can see', async () => {
    renderCard(makeJob({ status: 'DRAFT' }))

    expect(screen.getByText(/only you can see it/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view role/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))

    await waitFor(() => expect(apiUpdateJobStatusMock).toHaveBeenCalledWith('job-1', 'ACTIVE'))
  })

  it('offers Extend, not Resume, once a job has expired, and keeps applicants reviewable', async () => {
    renderCard(makeJob({ status: 'EXPIRED', closesAt: inDays(-2) }))

    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(button(/resume|reopen|^publish$/i)).toBeNull()
    expect(screen.getByText('7')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /review applicants/i }))
    expect(onReview).toHaveBeenCalledWith('job-1', 'Receptionist')

    fireEvent.change(screen.getByLabelText(/keep it open for/i), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: /^extend$/i }))

    await waitFor(() => expect(apiExtendJobMock).toHaveBeenCalledWith('job-1', 14))
  })

  it('offers Extend when a live job is about to close, and for the job named in the email link', () => {
    const near = renderCard(makeJob({ closesAt: inDays(2) }))
    expect(button(/^extend$/i)).not.toBeNull()
    near.unmount()

    const far = renderCard(makeJob({ closesAt: inDays(40) }))
    expect(button(/^extend$/i)).toBeNull()
    far.unmount()

    renderCard(makeJob({ closesAt: inDays(40) }), { highlighted: true })
    expect(button(/^extend$/i)).not.toBeNull()
  })

  it('duplicates a job', async () => {
    renderCard(makeJob({ status: 'CLOSED' }))

    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }))

    await waitFor(() => expect(apiDuplicateJobMock).toHaveBeenCalledWith('job-1'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('edits a job and saves through the edit form', async () => {
    renderCard(makeJob())

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    fireEvent.change(screen.getByLabelText(/job title/i), { target: { value: 'Head Receptionist' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(apiUpdateJobMock).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ title: 'Head Receptionist', closesAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
      ),
    )
  })

  it('does not let an expired job change its date by editing', async () => {
    renderCard(makeJob({ status: 'EXPIRED', closesAt: inDays(-2) }))

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.queryByLabelText(/closing date/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(apiUpdateJobMock).toHaveBeenCalled())
    expect(apiUpdateJobMock.mock.calls[0][1]).not.toHaveProperty('closesAt')
  })

  it('shows the server message when an action is refused', async () => {
    apiUpdateJobStatusMock.mockRejectedValue(new Error('The closing date has passed. Extend the job to open it again.'))
    renderCard(makeJob({ status: 'PAUSED', closesAt: inDays(1) }))

    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/closing date has passed/i)
  })

  it('locks a job that moderators are reviewing', () => {
    renderCard(makeJob({ status: 'SUSPENDED' }))

    expect(screen.getByText(/under review by jobwahala/i)).toBeInTheDocument()
    expect(button(/pause|resume|edit|duplicate|close role|reopen/i)).toBeNull()
  })
})
