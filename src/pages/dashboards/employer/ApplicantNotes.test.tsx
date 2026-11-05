import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerApplicantsPanel from './EmployerApplicantsPanel'

const saveReviewMock = vi.fn()
const bulkRejectMock = vi.fn()

vi.mock('../../../lib/api', () => ({
  apiSaveApplicationReview: (...args: unknown[]) => saveReviewMock(...args),
  apiBulkRejectApplicants: (...args: unknown[]) => bulkRejectMock(...args),
  apiUpdateApplicationStatus: vi.fn(),
}))

const person = (id: string, first: string, status = 'SUBMITTED', extra: Record<string, unknown> = {}) => ({
  id,
  status,
  createdAt: '2026-11-01T00:00:00.000Z',
  coverLetter: 'Hello',
  seeker: { id: `s-${id}`, email: `${first.toLowerCase()}@example.com`, jobSeekerProfile: { firstName: first, lastName: 'Test', skills: 'Front desk' } },
  ...extra,
})

const onRefresh = vi.fn()

const renderPanel = (applicants: unknown[]) =>
  render(
    <MemoryRouter>
      <EmployerApplicantsPanel
        jobs={[{ id: 'job-1', title: 'Receptionist', status: 'ACTIVE', createdAt: '2026-11-01T00:00:00.000Z', _count: { applications: applicants.length } }]}
        applicants={applicants as never}
        selectedJobId="job-1"
        selectedJobTitle="Receptionist"
        isApplicantsLoading={false}
        onSelectJob={vi.fn()}
        onRefresh={onRefresh}
      />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  saveReviewMock.mockResolvedValue({ success: true, review: {} })
  bulkRejectMock.mockResolvedValue({ success: true, rejected: ['a1', 'a2'], skipped: [] })
})

describe('private notes and rating', () => {
  it('shows what was saved earlier, and says only the employer sees it', () => {
    renderPanel([person('a1', 'Ama', 'SUBMITTED', { review: { rating: 4, note: 'Ask about weekends' } })])

    expect(screen.getByLabelText(/private notes about ama test/i)).toHaveValue('Ask about weekends')
    expect(screen.getByText('4 of 5')).toBeInTheDocument()
    expect(screen.getByText(/only you can see these/i)).toBeInTheDocument()
  })

  it('saves a star rating, sending only the rating', async () => {
    renderPanel([person('a1', 'Ama')])

    fireEvent.click(screen.getByRole('button', { name: '3 stars' }))
    fireEvent.click(screen.getByRole('button', { name: /save notes/i }))

    await waitFor(() => expect(saveReviewMock).toHaveBeenCalledWith('a1', { rating: 3 }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('saves a note, and tapping the same star again clears the rating', async () => {
    renderPanel([person('a1', 'Ama', 'SUBMITTED', { review: { rating: 5, note: null } })])

    fireEvent.click(screen.getByRole('button', { name: '5 stars' }))
    fireEvent.change(screen.getByLabelText(/private notes about ama test/i), { target: { value: '  Good on the phone  ' } })
    fireEvent.click(screen.getByRole('button', { name: /save notes/i }))

    await waitFor(() => expect(saveReviewMock).toHaveBeenCalledWith('a1', { rating: null, note: 'Good on the phone' }))
  })

  it('does not offer to save until something changed', () => {
    renderPanel([person('a1', 'Ama')])

    expect(screen.getByRole('button', { name: /save notes/i })).toBeDisabled()
  })

  it('says so when saving fails', async () => {
    saveReviewMock.mockRejectedValue(new Error('Network down'))
    renderPanel([person('a1', 'Ama')])

    fireEvent.click(screen.getByRole('button', { name: '2 stars' }))
    fireEvent.click(screen.getByRole('button', { name: /save notes/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/network down/i)
  })
})

describe('rejecting several applicants', () => {
  const three = () => [person('a1', 'Ama'), person('a2', 'Kofi', 'SHORTLISTED'), person('a3', 'Esi', 'HIRED')]

  it('offers a tick box only to people who can still be turned down', () => {
    renderPanel(three())

    expect(screen.getByLabelText('Select Ama Test')).toBeInTheDocument()
    expect(screen.getByLabelText('Select Kofi Test')).toBeInTheDocument()
    expect(screen.queryByLabelText('Select Esi Test')).not.toBeInTheDocument()
  })

  it('asks first, and says what the applicants will receive', () => {
    renderPanel(three())

    fireEvent.click(screen.getByLabelText('Select Ama Test'))
    fireEvent.click(screen.getByLabelText('Select Kofi Test'))
    fireEvent.click(screen.getByRole('button', { name: /reject selected \(2\)/i }))

    expect(screen.getByText(/turn down 2 applicants\? each gets a polite message/i)).toBeInTheDocument()
    expect(bulkRejectMock).not.toHaveBeenCalled()
  })

  it('sends the chosen ids once confirmed, then refreshes and reports', async () => {
    renderPanel(three())

    fireEvent.click(screen.getByLabelText(/select all applicants/i))
    fireEvent.click(screen.getByRole('button', { name: /reject selected \(2\)/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, turn them down/i }))

    await waitFor(() => expect(bulkRejectMock).toHaveBeenCalledWith('job-1', ['a1', 'a2']))
    expect(await screen.findByRole('status')).toHaveTextContent('2 applicants were told politely')
    expect(onRefresh).toHaveBeenCalled()
  })

  it('cancelling sends nothing', () => {
    renderPanel(three())

    fireEvent.click(screen.getByLabelText('Select Ama Test'))
    fireEvent.click(screen.getByRole('button', { name: /reject selected \(1\)/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(bulkRejectMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /reject selected \(1\)/i })).toBeInTheDocument()
  })

  it('mentions any that could not be changed', async () => {
    bulkRejectMock.mockResolvedValue({ success: true, rejected: ['a1'], skipped: [{ id: 'a2', reason: 'Already hired' }] })
    renderPanel(three())

    fireEvent.click(screen.getByLabelText(/select all applicants/i))
    fireEvent.click(screen.getByRole('button', { name: /reject selected/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, turn them down/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/1 applicant was told politely.*1 could not be changed/i)
  })

  it('shows the error and keeps the selection when it fails', async () => {
    bulkRejectMock.mockRejectedValue(new Error('Server is busy'))
    renderPanel(three())

    fireEvent.click(screen.getByLabelText('Select Ama Test'))
    fireEvent.click(screen.getByRole('button', { name: /reject selected/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, turn them down/i }))

    await waitFor(() => expect(screen.getByText(/server is busy/i)).toBeInTheDocument())
    expect(screen.getByLabelText('Select Ama Test')).toBeChecked()
  })
})
