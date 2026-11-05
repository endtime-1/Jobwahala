import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaveJobButton from '../components/SaveJobButton'
import { resetSavedJobsForTests, useSavedJobs } from '../lib/savedJobs'
import SavedJobs from './SavedJobs'

const apiGetIdsMock = vi.fn()
const apiSaveMock = vi.fn()
const apiUnsaveMock = vi.fn()
const apiGetSavedMock = vi.fn()
const auth = vi.hoisted(() => ({ value: { user: { id: 'u1' } as { id: string } | null, role: 'SEEKER' as string | null } }))

vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }))

vi.mock('../lib/api', () => ({
  apiGetSavedJobIds: (...args: unknown[]) => apiGetIdsMock(...args),
  apiSaveJob: (...args: unknown[]) => apiSaveMock(...args),
  apiUnsaveJob: (...args: unknown[]) => apiUnsaveMock(...args),
  apiGetSavedJobs: (...args: unknown[]) => apiGetSavedMock(...args),
}))

const renderButton = (jobId = 'job-1', variant: 'icon' | 'labelled' = 'icon') =>
  render(
    <MemoryRouter initialEntries={['/jobs']}>
      <Routes>
        <Route path="/jobs" element={<SaveJobButton jobId={jobId} variant={variant} />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  resetSavedJobsForTests()
  auth.value = { user: { id: 'u1' }, role: 'SEEKER' }
  apiGetIdsMock.mockResolvedValue({ ids: ['job-2'] })
  apiSaveMock.mockResolvedValue({ success: true })
  apiUnsaveMock.mockResolvedValue({ success: true })
})

describe('the save button', () => {
  it('shows an unsaved job as unsaved, then saves it with one tap', async () => {
    renderButton('job-1')
    const button = await screen.findByRole('button', { name: /save this job/i })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(button)

    await waitFor(() => expect(apiSaveMock).toHaveBeenCalledWith('job-1'))
    expect(screen.getByRole('button', { name: /remove from saved jobs/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a job already saved as saved, and unsaves it', async () => {
    renderButton('job-2')

    const button = await screen.findByRole('button', { name: /remove from saved jobs/i })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)

    await waitFor(() => expect(apiUnsaveMock).toHaveBeenCalledWith('job-2'))
    expect(screen.getByRole('button', { name: /save this job/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('puts it back the way it was when the server says no', async () => {
    apiSaveMock.mockRejectedValue(new Error('You can save up to 200 jobs. Remove one to save another.'))
    renderButton('job-1', 'labelled')
    await screen.findByRole('button', { name: /save job/i })

    fireEvent.click(screen.getByRole('button', { name: /save job/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/save up to 200 jobs/i)
    expect(screen.getByRole('button', { name: /save job/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('has a labelled version for the job page', async () => {
    renderButton('job-2', 'labelled')

    expect(await screen.findByRole('button', { name: /^saved$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sends a visitor who is not signed in to log in, and saves nothing', async () => {
    auth.value = { user: null, role: null }
    renderButton()

    fireEvent.click(screen.getByRole('button', { name: /save this job/i }))

    expect(await screen.findByText('Login Page')).toBeInTheDocument()
    expect(apiSaveMock).not.toHaveBeenCalled()
    expect(apiGetIdsMock).not.toHaveBeenCalled()
  })

  it('is not shown to employers', () => {
    auth.value = { user: { id: 'e1' }, role: 'EMPLOYER' }
    renderButton()

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(apiGetIdsMock).not.toHaveBeenCalled()
  })

  it('does not open the job card it sits on', async () => {
    const open = vi.fn()
    render(
      <MemoryRouter>
        <div onClick={open}>
          <SaveJobButton jobId="job-1" />
        </div>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /save this job/i }))

    expect(open).not.toHaveBeenCalled()
  })
})

describe('the saved list stays in step across buttons', () => {
  const Two = () => {
    const { isSaved } = useSavedJobs()
    return (
      <>
        <SaveJobButton jobId="job-1" />
        <p>{isSaved('job-1') ? 'listed as saved' : 'listed as not saved'}</p>
      </>
    )
  }

  it('one tap updates every place that shows the job', async () => {
    render(
      <MemoryRouter>
        <Two />
      </MemoryRouter>,
    )
    await screen.findByText('listed as not saved')

    fireEvent.click(screen.getByRole('button', { name: /save this job/i }))

    expect(await screen.findByText('listed as saved')).toBeInTheDocument()
  })

  it('loads the saved list once per sign-in, not once per button', async () => {
    render(
      <MemoryRouter>
        <SaveJobButton jobId="a" />
        <SaveJobButton jobId="b" />
        <SaveJobButton jobId="c" />
      </MemoryRouter>,
    )
    await screen.findAllByRole('button')
    await waitFor(() => expect(apiGetIdsMock).toHaveBeenCalled())

    expect(apiGetIdsMock).toHaveBeenCalledTimes(1)
  })
})

describe('the Saved jobs page', () => {
  const entry = (overrides: Record<string, unknown> = {}) => ({
    savedAt: '2026-11-01T09:00:00.000Z',
    job: {
      id: 'job-1',
      title: 'Hotel Receptionist',
      location: 'Kumasi',
      type: 'Full-time',
      salary: 'GHS 3,000 a month',
      closesAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      isOpen: true,
    },
    company: { id: 'emp-1', name: 'Achiba Star Hotel', logoUrl: null, isVerified: true },
    ...overrides,
  })

  const renderPage = () =>
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SavedJobs />
        </MemoryRouter>
      </HelmetProvider>,
    )

  it('lists each saved job with company, pay, when it closes and when it was saved', async () => {
    apiGetSavedMock.mockResolvedValue({ savedJobs: [entry()] })

    renderPage()

    const row = within(await screen.findByRole('listitem'))
    expect(row.getByRole('link', { name: 'Hotel Receptionist' })).toHaveAttribute('href', '/jobs/job-1')
    expect(row.getByRole('link', { name: 'Achiba Star Hotel' })).toHaveAttribute('href', '/companies/emp-1')
    expect(row.getByText('GHS 3,000 a month')).toBeInTheDocument()
    expect(row.getByText(/\(5 days left\)/)).toBeInTheDocument()
    expect(row.getByText('Saved 1 Nov 2026')).toBeInTheDocument()
    expect(row.queryByText('Unverified employer')).not.toBeInTheDocument()
  })

  it('labels an unverified employer', async () => {
    apiGetSavedMock.mockResolvedValue({ savedJobs: [entry({ company: { id: 'emp-2', name: 'Unknown Ltd', isVerified: false } })] })

    renderPage()

    expect(await screen.findByText('Unverified employer')).toBeInTheDocument()
  })

  it('keeps a job that has closed, without linking to it', async () => {
    apiGetSavedMock.mockResolvedValue({ savedJobs: [entry({ job: { ...entry().job, isOpen: false } })] })

    renderPage()

    expect(await screen.findByText('Hotel Receptionist')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Hotel Receptionist' })).not.toBeInTheDocument()
    expect(screen.getByText(/no longer taking applications/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view job/i })).not.toBeInTheDocument()
  })

  it('removes a job from the list and from the server', async () => {
    apiGetSavedMock.mockResolvedValue({ savedJobs: [entry(), entry({ job: { ...entry().job, id: 'job-2', title: 'Cook' } })] })
    renderPage()
    await screen.findByText('Cook')

    fireEvent.click(within(screen.getAllByRole('listitem')[1]).getByRole('button', { name: /remove/i }))

    await waitFor(() => expect(apiUnsaveMock).toHaveBeenCalledWith('job-2'))
    expect(screen.queryByText('Cook')).not.toBeInTheDocument()
    expect(screen.getByText('Hotel Receptionist')).toBeInTheDocument()
  })

  it('puts the job back and says why when removing fails', async () => {
    apiGetSavedMock.mockResolvedValue({ savedJobs: [entry()] })
    apiUnsaveMock.mockRejectedValue(new Error('offline'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /remove/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/offline/i)
    expect(screen.getByText('Hotel Receptionist')).toBeInTheDocument()
  })

  it('invites you to find jobs when there are none', async () => {
    apiGetSavedMock.mockResolvedValue({ savedJobs: [] })

    renderPage()

    expect(await screen.findByText(/have not saved any jobs yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find a job/i })).toHaveAttribute('href', '/jobs')
  })

  it('says so when the list cannot be loaded', async () => {
    apiGetSavedMock.mockRejectedValue(new Error('offline'))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/offline/i)
  })
})
