import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Internships from './Internships'

const apiGetJobsMock = vi.fn()
const auth = vi.hoisted(() => ({ value: { user: null as null | Record<string, unknown> } }))

vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }))
vi.mock('../lib/api', () => ({
  apiGetJobs: (...args: unknown[]) => apiGetJobsMock(...args),
  apiGetSavedJobIds: vi.fn().mockResolvedValue({ ids: [] }),
  apiGetSavedSearches: vi.fn().mockResolvedValue({ savedSearches: [], limit: 10 }),
  apiCreateSavedSearch: vi.fn(),
}))

const job = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `${type} at ${id}`,
  description: 'Learn on the job.',
  location: 'Accra',
  type,
  createdAt: new Date().toISOString(),
  employer: { id: `emp-${id}`, email: `${id}@example.com`, isVerified: true, employerProfile: { companyName: `Company ${id}` } },
  ...extra,
})

const renderPage = (url = '/internships') =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[url]}>
        <Internships />
      </MemoryRouter>
    </HelmetProvider>,
  )

const lastParams = () => apiGetJobsMock.mock.calls[apiGetJobsMock.mock.calls.length - 1][0] as Record<string, string>

beforeEach(() => {
  vi.clearAllMocks()
  auth.value = { user: null }
  apiGetJobsMock.mockResolvedValue({ jobs: [] })
})

describe('the Internships & NSS page', () => {
  it('asks for the early-career section only', async () => {
    renderPage()

    await waitFor(() => expect(apiGetJobsMock).toHaveBeenCalled())
    expect(apiGetJobsMock.mock.calls[0][0]).toEqual({ section: 'early' })
    expect(screen.getByRole('heading', { level: 1, name: /internships & nss/i })).toBeInTheDocument()
  })

  it('shows stipend, duration, start, hours and the offer tag on each card', async () => {
    apiGetJobsMock.mockResolvedValue({
      jobs: [job('a', 'Internship', { salary: 'GHS 500 - 800 a month', durationMonths: 3, schedule: 'PART_TIME', startsImmediately: true, possibleJobOffer: true })],
    })

    renderPage()

    const chips = within(await screen.findByLabelText('Early-career details'))
    expect(chips.getByText('Stipend: GHS 500 - 800 a month')).toBeInTheDocument()
    expect(chips.getByText('3 months')).toBeInTheDocument()
    expect(chips.getByText('Part-time')).toBeInTheDocument()
    expect(chips.getByText('Starts immediately')).toBeInTheDocument()
    expect(chips.getByText(/possible job offer after/i)).toBeInTheDocument()
  })

  it('labels an unpaid role "Unpaid", clearly', async () => {
    apiGetJobsMock.mockResolvedValue({ jobs: [job('a', 'Industrial Attachment', { unpaid: true, salary: 'Unpaid' })] })

    renderPage()

    expect(await within(await screen.findByLabelText('Early-career details')).findByText('Unpaid')).toBeInTheDocument()
  })

  it('searches again with each filter the visitor picks', async () => {
    renderPage()
    await waitFor(() => expect(apiGetJobsMock).toHaveBeenCalled())

    fireEvent.click(screen.getByLabelText('National Service (NSS)'))
    await waitFor(() => expect(lastParams().types).toBe('National Service (NSS)'))

    fireEvent.change(screen.getByLabelText(/^stipend/i), { target: { value: 'paid' } })
    fireEvent.change(screen.getByLabelText(/^duration/i), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText(/^start date/i), { target: { value: 'now' } })
    fireEvent.change(screen.getByLabelText(/^hours/i), { target: { value: 'FULL_TIME' } })
    fireEvent.click(screen.getByLabelText(/possible job offer after/i))
    fireEvent.change(screen.getByLabelText(/^location/i), { target: { value: 'Kumasi' } })

    await waitFor(() =>
      expect(lastParams()).toEqual({
        section: 'early',
        types: 'National Service (NSS)',
        paid: '1',
        maxDuration: '3',
        startsNow: '1',
        schedule: 'FULL_TIME',
        offer: '1',
        location: 'Kumasi',
      }),
    )
  })

  it('opens on a type named in the link', async () => {
    renderPage('/internships?type=internship')

    await waitFor(() => expect(apiGetJobsMock).toHaveBeenCalled())
    expect(apiGetJobsMock.mock.calls[0][0]).toMatchObject({ types: 'Internship' })
    expect(screen.getByLabelText('Internship')).toBeChecked()
  })

  it('clears every filter at once', async () => {
    renderPage()
    fireEvent.click(await screen.findByLabelText('Internship'))

    fireEvent.click(await screen.findByRole('button', { name: /clear filters/i }))

    await waitFor(() => expect(lastParams()).toEqual({ section: 'early' }))
  })

  it('says so when nothing is open, or nothing matches', async () => {
    renderPage()
    expect(await screen.findByText(/no opportunities are open right now/i)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/possible job offer after/i))
    expect(await screen.findByText(/nothing matches those filters/i)).toBeInTheDocument()
  })

  it('says so when the search fails', async () => {
    apiGetJobsMock.mockRejectedValue(new Error('Network down'))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/network down/i)
  })
})

describe('relevance for the signed-in seeker', () => {
  const seeker = (careerStage?: string) => ({ user: { id: 'u1', role: 'SEEKER', jobSeekerProfile: careerStage ? { careerStage } : {} }, role: 'SEEKER' })
  const jobs = [job('grad', 'Graduate / Entry-level Job'), job('nss', 'National Service (NSS)'), job('intern', 'Internship'), job('att', 'Industrial Attachment')]
  const titles = () => within(screen.getByRole('list', { name: 'Results' })).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)

  it('a student sees attachments and internships first, marked "Suits you"', async () => {
    auth.value = seeker('STUDENT')
    apiGetJobsMock.mockResolvedValue({ jobs })

    renderPage()

    await screen.findByText(/industrial attachment at att/i)
    expect(titles().slice(0, 2)).toEqual(['Industrial Attachment at att', 'Internship at intern'])
    expect(screen.getByText(/you are set as: student/i)).toBeInTheDocument()
    expect(screen.getAllByText('Suits you').length).toBeGreaterThan(0)
  })

  it('NSS personnel see National Service first', async () => {
    auth.value = seeker('NSS')
    apiGetJobsMock.mockResolvedValue({ jobs })

    renderPage()

    await screen.findByText(/national service \(nss\) at nss/i)
    expect(titles()[0]).toBe('National Service (NSS) at nss')
  })

  it('without a stage, the order is unchanged and the seeker is invited to say what they are', async () => {
    auth.value = seeker()
    apiGetJobsMock.mockResolvedValue({ jobs })

    renderPage()

    await screen.findByText(/graduate \/ entry-level job at grad/i)
    expect(titles()[0]).toBe('Graduate / Entry-level Job at grad')
    expect(screen.getByRole('link', { name: /tell us on your dashboard/i })).toHaveAttribute('href', '/dashboard')
  })

  it('visitors who are not signed in see no profile message', async () => {
    apiGetJobsMock.mockResolvedValue({ jobs })

    renderPage()

    await screen.findByText(/internship at intern/i)
    expect(screen.queryByText(/you are set as/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /tell us on your dashboard/i })).not.toBeInTheDocument()
  })
})
