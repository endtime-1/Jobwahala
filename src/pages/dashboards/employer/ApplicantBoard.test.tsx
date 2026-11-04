import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApplicantBoard from './ApplicantBoard'
import type { JobApplicant } from './types'

const applicant = (id: string, first: string, status: string, fitScore?: number): JobApplicant => ({
  id,
  status,
  fitScore,
  createdAt: '2026-03-20T00:00:00.000Z',
  seeker: {
    id: `seeker-${id}`,
    email: `${first.toLowerCase()}@example.com`,
    jobSeekerProfile: { firstName: first, lastName: 'Mensah', skills: 'Excel, accounting' },
  },
})

const applicants = [
  applicant('a1', 'Ada', 'SUBMITTED', 88),
  applicant('a2', 'Kojo', 'SHORTLISTED', 70),
  applicant('a3', 'Esi', 'INTERVIEW'),
  applicant('a4', 'Yaw', 'HIRED'),
]

describe('ApplicantBoard', () => {
  const onMove = vi.fn()
  const onReview = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  const renderBoard = (busy = false) =>
    render(<ApplicantBoard applicants={applicants} busy={busy} onMove={onMove} onReview={onReview} />)

  it('places each candidate in their stage column with counts', () => {
    renderBoard()

    const shortlisted = screen.getByRole('region', { name: /shortlisted column/i })
    expect(within(shortlisted).getByText('Kojo Mensah')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: /new column/i })).getByText('88% fit')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: /rejected column/i })).getByText(/drop a candidate here/i)).toBeInTheDocument()
  })

  it('advances a candidate with one tap', () => {
    renderBoard()

    fireEvent.click(screen.getByRole('button', { name: /move ada mensah to shortlisted/i }))

    expect(onMove).toHaveBeenCalledWith('a1', 'SHORTLISTED')
  })

  it('asks before making an offer and does nothing if the employer says no', () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    renderBoard()

    fireEvent.click(screen.getByRole('button', { name: /move esi mensah to offered/i }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/offer.*esi mensah|esi mensah.*offer/i))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('moves an interviewed candidate on to Offered once confirmed', () => {
    renderBoard()

    fireEvent.click(screen.getByRole('button', { name: /move esi mensah to offered/i }))

    expect(onMove).toHaveBeenCalledWith('a3', 'OFFERED')
  })

  it('asks before hiring, and tells the employer the candidate will be emailed', () => {
    renderBoard()

    fireEvent.change(screen.getByLabelText(/move esi mensah to another stage/i), { target: { value: 'HIRED' } })

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/mark esi mensah as hired.*email/i))
    expect(onMove).toHaveBeenCalledWith('a3', 'HIRED')
  })

  it('has an Offered column between Interview and Hired', () => {
    renderBoard()

    const names = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label') ?? '')
    const order = ['new', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'].map((stage) =>
      names.findIndex((name) => name.toLowerCase().startsWith(stage)),
    )
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((x, y) => x - y)).toEqual(order)
  })

  it('supports the move-to menu, including rejection with confirmation', () => {
    renderBoard()

    fireEvent.change(screen.getByLabelText(/move ada mensah to another stage/i), { target: { value: 'REJECTED' } })

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/move ada mensah to rejected.*polite message/i))
    expect(onMove).toHaveBeenCalledWith('a1', 'REJECTED')
  })

  it('moves a candidate when dragged onto another column', () => {
    renderBoard()

    const card = screen.getByText('Ada Mensah').closest('article') as HTMLElement
    const target = screen.getByRole('region', { name: /interview column/i })

    fireEvent.dragStart(card)
    fireEvent.dragOver(target)
    fireEvent.drop(target)

    expect(onMove).toHaveBeenCalledWith('a1', 'INTERVIEW')
  })

  it('ignores a drop onto the column the candidate is already in', () => {
    renderBoard()

    const card = screen.getByText('Kojo Mensah').closest('article') as HTMLElement
    const same = screen.getByRole('region', { name: /shortlisted column/i })

    fireEvent.dragStart(card)
    fireEvent.drop(same)

    expect(onMove).not.toHaveBeenCalled()
  })

  it('offers no advance button for hired candidates and opens the full review on request', () => {
    renderBoard()

    expect(screen.queryByRole('button', { name: /move yaw mensah to/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /review yaw mensah/i }))
    expect(onReview).toHaveBeenCalledWith('a4')
  })

  it('blocks moves while an update is in flight', () => {
    renderBoard(true)

    expect(screen.getByRole('button', { name: /move ada mensah to shortlisted/i })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/move ada mensah to another stage/i), { target: { value: 'INTERVIEW' } })
    expect(onMove).not.toHaveBeenCalled()
  })
})
