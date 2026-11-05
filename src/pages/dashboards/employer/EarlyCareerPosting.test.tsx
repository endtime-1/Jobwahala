import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerJobCard from './EmployerJobCard'
import EmployerJobsPanel from './EmployerJobsPanel'
import { makeInitialJobForm, toJobPayload } from './utils'
import type { EmployerJob } from './types'

const apiCreateJobMock = vi.fn()
const apiUpdateJobMock = vi.fn()

vi.mock('../../../lib/api', () => ({
  apiCreateJob: (...args: unknown[]) => apiCreateJobMock(...args),
  apiUpdateJob: (...args: unknown[]) => apiUpdateJobMock(...args),
  apiGenerateJobDraft: vi.fn(),
  apiUpdateJobStatus: vi.fn(),
  apiDuplicateJob: vi.fn(),
  apiExtendJob: vi.fn(),
}))

const renderPanel = () =>
  render(
    <MemoryRouter>
      <EmployerJobsPanel jobs={[]} showCreateForm onToggleCreateForm={vi.fn()} onJobCreated={vi.fn()} onReviewApplicants={vi.fn()} />
    </MemoryRouter>,
  )

const fillRequired = () => {
  fireEvent.change(screen.getByPlaceholderText('Job title'), { target: { value: 'Marketing intern' } })
  fireEvent.change(screen.getByPlaceholderText('Describe the role, responsibilities, and expectations...'), { target: { value: 'Help the team.' } })
}

const chooseType = (type: string) => fireEvent.change(screen.getByLabelText(/type of work/i), { target: { value: type } })

beforeEach(() => {
  vi.clearAllMocks()
  apiCreateJobMock.mockResolvedValue({ job: { id: 'job-1' } })
  apiUpdateJobMock.mockResolvedValue({ job: {} })
})

describe('choosing the type when posting', () => {
  it('offers the four early-career types next to the usual ones', () => {
    renderPanel()

    const options = Array.from((screen.getByLabelText(/type of work/i) as HTMLSelectElement).options).map((option) => option.value)
    expect(options).toEqual(['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'National Service (NSS)', 'Industrial Attachment', 'Graduate / Entry-level Job'])
  })

  it('shows the extra questions only for an early-career type', () => {
    renderPanel()
    expect(screen.queryByText(/about this opportunity/i)).not.toBeInTheDocument()

    chooseType('Internship')

    expect(screen.getByText(/about this opportunity/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/this role is unpaid/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/how long does it last/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/part-time or full-time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/when does it start/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/possible job offer after/i)).toBeInTheDocument()
    expect(screen.getByText('Stipend (GHS a month)')).toBeInTheDocument()

    chooseType('Full-time')
    expect(screen.queryByText(/about this opportunity/i)).not.toBeInTheDocument()
  })

  it('a start date only appears when "on a date" is chosen', () => {
    renderPanel()
    chooseType('Internship')
    expect(screen.queryByLabelText(/^start date/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/when does it start/i), { target: { value: 'DATE' } })

    expect(screen.getByLabelText(/^start date/i)).toBeInTheDocument()
  })

  it('posts the stipend, duration, start date, hours and offer tag', async () => {
    renderPanel()
    fillRequired()
    chooseType('Internship')
    fireEvent.change(screen.getByLabelText(/pay from/i), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText(/pay to/i), { target: { value: '800' } })
    fireEvent.change(screen.getByLabelText(/how long does it last/i), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText(/part-time or full-time/i), { target: { value: 'PART_TIME' } })
    fireEvent.change(screen.getByLabelText(/when does it start/i), { target: { value: 'DATE' } })
    fireEvent.change(screen.getByLabelText(/^start date/i), { target: { value: '2099-01-15' } })
    fireEvent.click(screen.getByLabelText(/possible job offer after/i))

    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() => expect(apiCreateJobMock).toHaveBeenCalled())
    expect(apiCreateJobMock.mock.calls[0][0]).toMatchObject({
      type: 'Internship',
      salaryMin: 500,
      salaryMax: 800,
      unpaid: false,
      durationMonths: 3,
      schedule: 'PART_TIME',
      startsImmediately: false,
      startDate: '2099-01-15',
      possibleJobOffer: true,
    })
  })

  it('an unpaid role sends no pay at all, and switches the stipend boxes off', async () => {
    renderPanel()
    fillRequired()
    chooseType('Industrial Attachment')
    fireEvent.change(screen.getByLabelText(/pay from/i), { target: { value: '500' } })
    fireEvent.click(screen.getByLabelText(/this role is unpaid/i))

    expect(screen.getByLabelText(/pay from/i)).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() => expect(apiCreateJobMock).toHaveBeenCalled())
    const sent = apiCreateJobMock.mock.calls[0][0]
    expect(sent).toMatchObject({ type: 'Industrial Attachment', unpaid: true, startsImmediately: true })
    expect(sent).not.toHaveProperty('salaryMin')
    expect(sent).not.toHaveProperty('salary')
  })

  it('an ordinary job sends none of the early-career fields', async () => {
    renderPanel()
    fillRequired()
    chooseType('Full-time')

    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() => expect(apiCreateJobMock).toHaveBeenCalled())
    for (const key of ['unpaid', 'durationMonths', 'startsImmediately', 'startDate', 'schedule', 'possibleJobOffer']) {
      expect(apiCreateJobMock.mock.calls[0][0]).not.toHaveProperty(key)
    }
  })
})

describe('the payload', () => {
  it('start immediately is the default for early-career jobs', () => {
    expect(toJobPayload({ ...makeInitialJobForm(), type: 'National Service (NSS)' })).toMatchObject({
      startsImmediately: true,
      startDate: null,
      unpaid: false,
      durationMonths: null,
      schedule: null,
    })
  })
})

describe('editing an early-career job', () => {
  const makeJob = (overrides: Partial<EmployerJob> = {}): EmployerJob => ({
    id: 'job-1',
    title: 'Marketing intern',
    description: 'Help the team.',
    location: 'Accra',
    type: 'Internship',
    salary: 'GHS 500 - 800 a month',
    salaryMin: 500,
    salaryMax: 800,
    category: 'Marketing',
    status: 'ACTIVE',
    closesAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    createdAt: new Date().toISOString(),
    durationMonths: 3,
    schedule: 'FULL_TIME',
    startsImmediately: true,
    possibleJobOffer: true,
    _count: { applications: 0 },
    ...overrides,
  })

  const openEdit = (job: EmployerJob) => {
    render(
      <MemoryRouter>
        <EmployerJobCard job={job} onChanged={vi.fn()} onReviewApplicants={vi.fn()} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
  }

  it('shows what was saved', () => {
    openEdit(makeJob())

    expect(screen.getByLabelText(/how long does it last/i)).toHaveValue(3)
    expect(screen.getByLabelText(/part-time or full-time/i)).toHaveValue('FULL_TIME')
    expect(screen.getByLabelText(/possible job offer after/i)).toBeChecked()
    expect(screen.getByLabelText(/this role is unpaid/i)).not.toBeChecked()
  })

  it('saves a changed duration with the rest of the early-career details', async () => {
    openEdit(makeJob())

    fireEvent.change(screen.getByLabelText(/how long does it last/i), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(apiUpdateJobMock).toHaveBeenCalled())
    expect(apiUpdateJobMock.mock.calls[0][1]).toMatchObject({
      type: 'Internship',
      durationMonths: 6,
      schedule: 'FULL_TIME',
      possibleJobOffer: true,
      startsImmediately: true,
      unpaid: false,
    })
  })

  it('an unpaid role is shown as unpaid, and saving it again sends no pay', async () => {
    openEdit(makeJob({ unpaid: true, salary: 'Unpaid', salaryMin: null, salaryMax: null }))

    expect(screen.getByLabelText(/this role is unpaid/i)).toBeChecked()
    fireEvent.change(screen.getByLabelText(/how long does it last/i), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(apiUpdateJobMock).toHaveBeenCalled())
    const sent = apiUpdateJobMock.mock.calls[0][1]
    expect(sent).toMatchObject({ unpaid: true, durationMonths: 2 })
    expect(sent).not.toHaveProperty('salary')
    expect(sent).not.toHaveProperty('salaryMin')
  })

  it('changing it to an ordinary job sends no early-career fields, so the server clears them', async () => {
    openEdit(makeJob())

    fireEvent.change(screen.getByLabelText(/type of work/i), { target: { value: 'Full-time' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(apiUpdateJobMock).toHaveBeenCalled())
    expect(apiUpdateJobMock.mock.calls[0][1]).toMatchObject({ type: 'Full-time' })
    expect(apiUpdateJobMock.mock.calls[0][1]).not.toHaveProperty('durationMonths')
  })
})
