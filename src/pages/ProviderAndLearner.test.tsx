import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCoursesPanel from '../components/AdminCoursesPanel'
import CoursesForJob from '../components/CoursesForJob'
import MyLearningPanel from '../components/MyLearningPanel'
import EmployerApplicantsPanel from './dashboards/employer/EmployerApplicantsPanel'
import ProviderDashboard from './ProviderDashboard'
import type { Course } from '../lib/courses'

const api = vi.hoisted(() => ({
  status: vi.fn(),
  enable: vi.fn(),
  mine: vi.fn(),
  enquiries: vi.fn(),
  completions: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  remove: vi.fn(),
  markRead: vi.fn(),
  decide: vi.fn(),
  learnerList: vi.fn(),
  learnerAdd: vi.fn(),
  learnerRemove: vi.fn(),
  learnerRequest: vi.fn(),
  forJob: vi.fn(),
  queue: vi.fn(),
  reviewProvider: vi.fn(),
  reviewCourse: vi.fn(),
  featured: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  apiGetProviderStatus: (...a: unknown[]) => api.status(...a),
  apiEnableProvider: (...a: unknown[]) => api.enable(...a),
  apiListMyCourses: (...a: unknown[]) => api.mine(...a),
  apiListCourseEnquiries: (...a: unknown[]) => api.enquiries(...a),
  apiListCompletionRequests: (...a: unknown[]) => api.completions(...a),
  apiCreateCourse: (...a: unknown[]) => api.create(...a),
  apiUpdateCourse: (...a: unknown[]) => api.update(...a),
  apiPauseCourse: (...a: unknown[]) => api.pause(...a),
  apiResumeCourse: (...a: unknown[]) => api.resume(...a),
  apiRemoveCourse: (...a: unknown[]) => api.remove(...a),
  apiMarkCourseEnquiryRead: (...a: unknown[]) => api.markRead(...a),
  apiDecideCompletion: (...a: unknown[]) => api.decide(...a),
  apiListLearnerCourses: (...a: unknown[]) => api.learnerList(...a),
  apiAddLearnerCourse: (...a: unknown[]) => api.learnerAdd(...a),
  apiRemoveLearnerCourse: (...a: unknown[]) => api.learnerRemove(...a),
  apiRequestCourseConfirmation: (...a: unknown[]) => api.learnerRequest(...a),
  apiCoursesForJob: (...a: unknown[]) => api.forJob(...a),
  apiGetCourseQueue: (...a: unknown[]) => api.queue(...a),
  apiReviewCourseProvider: (...a: unknown[]) => api.reviewProvider(...a),
  apiReviewCourse: (...a: unknown[]) => api.reviewCourse(...a),
  apiSetCourseFeatured: (...a: unknown[]) => api.featured(...a),
}))

const stats = (views = 0, clicks = 0, enquiries = 0) => ({ views, clicks, enquiries })
const mine = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  slug: 'excel-1',
  title: 'Excel for accountants',
  summary: 'Spreadsheets for everyday accounting work.',
  description: 'Six weeks of practical Excel for accounts clerks.',
  category: 'finance-accounting',
  level: 'BEGINNER',
  isFree: false,
  priceGhs: 450,
  durationWeeks: 6,
  format: 'ONLINE',
  location: null,
  startDates: [],
  rollingStart: true,
  certificateOffered: true,
  enrolUrl: 'https://provider.example/enrol',
  enquiryEnabled: true,
  skills: ['excel'],
  status: 'ACTIVE',
  reviewStatus: 'APPROVED',
  reviewNote: null,
  featured: false,
  stats: { allTime: stats(120, 30, 4), last30Days: stats(10, 2, 1) },
  ...overrides,
})

const renderIn = (ui: React.ReactElement) =>
  render(
    <HelmetProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </HelmetProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  api.status.mockResolvedValue({ provider: { isTrainingProvider: true, status: 'APPROVED' } })
  api.mine.mockResolvedValue({ courses: [mine()] })
  api.enquiries.mockResolvedValue({ enquiries: [] })
  api.completions.mockResolvedValue({ requests: [] })
  for (const key of ['enable', 'create', 'update', 'pause', 'resume', 'remove', 'markRead', 'decide', 'learnerAdd', 'learnerRemove', 'learnerRequest', 'reviewProvider', 'reviewCourse', 'featured'] as const) {
    api[key].mockResolvedValue({ success: true })
  }
  api.learnerList.mockResolvedValue({ courses: [] })
  api.forJob.mockResolvedValue({ courses: [], skills: [] })
  api.queue.mockResolvedValue({ providers: [], pending: [], recent: [] })
})

describe('the provider dashboard', () => {
  it('invites a company that is not a provider yet to say it is', async () => {
    api.status.mockResolvedValue({ provider: { isTrainingProvider: false, status: 'NONE' } })
    renderIn(<ProviderDashboard />)

    fireEvent.click(await screen.findByRole('button', { name: /we are a training provider/i }))

    await waitFor(() => expect(api.enable).toHaveBeenCalled())
    expect(await screen.findByRole('status')).toHaveTextContent(/we will check/i)
  })

  it('shows views, clicks and enquiries for each course, all time and the last 30 days', async () => {
    renderIn(<ProviderDashboard />)

    expect(await screen.findByText('120')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('10 in the last 30 days')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('says when a listing waits for approval, was turned down (with the reason), or the provider is not yet approved', async () => {
    api.status.mockResolvedValue({ provider: { isTrainingProvider: true, status: 'PENDING' } })
    api.mine.mockResolvedValue({ courses: [mine({ reviewStatus: 'PENDING' }), mine({ id: 'c2', title: 'Second', reviewStatus: 'REJECTED', reviewNote: 'The price does not match your website.' })] })

    renderIn(<ProviderDashboard />)

    expect(await screen.findByText(/we are checking your organisation/i)).toBeInTheDocument()
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument()
    expect(screen.getByText('Not approved')).toBeInTheDocument()
    expect(screen.getByText('The price does not match your website.')).toBeInTheDocument()
  })

  it('creates a course from the form, with its skills, and says it will be checked', async () => {
    renderIn(<ProviderDashboard />)
    fireEvent.click(await screen.findByRole('button', { name: /new course/i }))

    fireEvent.change(screen.getByLabelText('Course title'), { target: { value: 'Digital marketing basics' } })
    fireEvent.change(screen.getByLabelText('One-line summary'), { target: { value: 'Learn to promote a business online.' } })
    fireEvent.change(screen.getByLabelText('Full description'), { target: { value: 'Eight weeks of practical digital marketing.' } })
    fireEvent.change(screen.getByLabelText(/price \(ghs\)/i), { target: { value: '600' } })
    fireEvent.change(screen.getByLabelText(/duration \(weeks\)/i), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Add a skill'), { target: { value: 'digital-marketing' } })
    fireEvent.click(screen.getByLabelText(/learners can start any time/i))
    fireEvent.click(screen.getByRole('button', { name: /save course/i }))

    await waitFor(() => expect(api.create).toHaveBeenCalled())
    expect(api.create.mock.calls[0][0]).toMatchObject({
      title: 'Digital marketing basics',
      priceGhs: 600,
      isFree: false,
      durationWeeks: 8,
      format: 'ONLINE',
      rollingStart: true,
      skills: ['digital-marketing'],
      enquiryEnabled: true,
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/jobwahala will check it/i)
  })

  it('will not save a course with no skill chosen', async () => {
    renderIn(<ProviderDashboard />)
    fireEvent.click(await screen.findByRole('button', { name: /new course/i }))
    fireEvent.change(screen.getByLabelText('Course title'), { target: { value: 'Digital marketing basics' } })
    fireEvent.change(screen.getByLabelText('One-line summary'), { target: { value: 'Learn to promote a business online.' } })
    fireEvent.change(screen.getByLabelText('Full description'), { target: { value: 'Eight weeks of practical digital marketing.' } })
    fireEvent.change(screen.getByLabelText(/price \(ghs\)/i), { target: { value: '600' } })

    fireEvent.click(screen.getByRole('button', { name: /save course/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/choose at least one skill/i)
    expect(api.create).not.toHaveBeenCalled()
  })

  it('a free course sends no price, and an in-person one asks where', async () => {
    renderIn(<ProviderDashboard />)
    fireEvent.click(await screen.findByRole('button', { name: /new course/i }))

    fireEvent.click(screen.getByLabelText(/this course is free/i))
    expect(screen.queryByLabelText(/price \(ghs\)/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/where are classes held/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'IN_PERSON' } })
    expect(screen.getByLabelText(/where are classes held/i)).toBeInTheDocument()
  })

  it('edits a course and says when a big change sends it back for a check', async () => {
    api.update.mockResolvedValue({ success: true, backInReview: true })
    renderIn(<ProviderDashboard />)
    fireEvent.click(await screen.findByRole('button', { name: /^edit$/i }))

    expect(screen.getByLabelText('Course title')).toHaveValue('Excel for accountants')
    fireEvent.change(screen.getByLabelText(/price \(ghs\)/i), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(api.update).toHaveBeenCalledWith('c1', expect.objectContaining({ priceGhs: 900, skills: ['excel'] })))
    expect(await screen.findByRole('status')).toHaveTextContent(/being checked again/i)
  })

  it('pauses, resumes and removes a course (removing asks first)', async () => {
    renderIn(<ProviderDashboard />)

    const pauseButton = await screen.findByRole('button', { name: /pause/i })
    api.mine.mockResolvedValue({ courses: [mine({ status: 'PAUSED' })] })
    fireEvent.click(pauseButton)
    await waitFor(() => expect(api.pause).toHaveBeenCalledWith('c1'))

    fireEvent.click(await screen.findByRole('button', { name: /resume/i }))
    await waitFor(() => expect(api.resume).toHaveBeenCalledWith('c1'))

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    fireEvent.click(await screen.findByRole('button', { name: /remove/i }))
    expect(api.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('c1'))
    confirm.mockRestore()
  })

  it('shows enquiries with how to reply, and marks one as read', async () => {
    api.enquiries.mockResolvedValue({ enquiries: [{ id: 'e1', name: 'Ama Mensah', email: 'ama@example.com', phone: '0241234567', message: 'Is there a weekend class?', status: 'NEW', createdAt: new Date().toISOString(), course: { id: 'c1', title: 'Excel for accountants' } }] })
    renderIn(<ProviderDashboard />)

    fireEvent.click(await screen.findByRole('tab', { name: /enquiries \(1 new\)/i }))

    expect(screen.getByText('Is there a weekend class?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ama@example.com' })).toHaveAttribute('href', 'mailto:ama@example.com')
    expect(screen.getByRole('link', { name: '0241234567' })).toHaveAttribute('href', 'tel:0241234567')
    fireEvent.click(screen.getByRole('button', { name: /mark as read/i }))
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith('e1'))
  })

  it('lets the provider confirm, or not recognise, a learner who says they completed a course', async () => {
    api.completions.mockResolvedValue({ requests: [{ id: 'r1', courseTitle: 'Excel for accountants', learnerName: 'Ama Mensah', completedOn: '2026-10-01T00:00:00.000Z', certificateUrl: null, status: 'REQUESTED' }] })
    renderIn(<ProviderDashboard />)

    fireEvent.click(await screen.findByRole('tab', { name: /completions \(1 to confirm\)/i }))
    expect(screen.getByText('Ama Mensah')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /confirm they completed it/i }))
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('r1', 'CONFIRM'))

    fireEvent.click(screen.getByRole('button', { name: /i do not recognise this/i }))
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('r1', 'DECLINE'))
  })
})

describe('a learner\'s courses', () => {
  const learner = (overrides: Record<string, unknown> = {}) => ({ id: 'l1', courseId: 'c1', courseSlug: 'excel-1', title: 'Excel for accountants', providerName: 'Accra Training Centre', completedOn: '2026-10-01T00:00:00.000Z', certificateUrl: null, status: 'SELF', ...overrides })

  it('adds a course done elsewhere, with its date and certificate link', async () => {
    renderIn(<MyLearningPanel />)

    fireEvent.click(await screen.findByRole('button', { name: /add a completed course/i }))
    fireEvent.change(screen.getByLabelText('Course name'), { target: { value: 'Google Data Analytics' } })
    fireEvent.change(screen.getByLabelText('Who ran it'), { target: { value: 'Coursera' } })
    fireEvent.change(screen.getByLabelText('Date completed'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText(/link to your certificate/i), { target: { value: 'https://coursera.example/cert/1' } })
    fireEvent.click(screen.getByRole('button', { name: /^add course$/i }))

    await waitFor(() => expect(api.learnerAdd).toHaveBeenCalledWith({ title: 'Google Data Analytics', providerName: 'Coursera', completedOn: '2026-09-01', certificateUrl: 'https://coursera.example/cert/1' }))
  })

  it('asks the provider to confirm a course from the catalogue', async () => {
    api.learnerList.mockResolvedValue({ courses: [learner()] })
    renderIn(<MyLearningPanel />)

    fireEvent.click(await screen.findByRole('button', { name: /ask the provider to confirm/i }))

    await waitFor(() => expect(api.learnerRequest).toHaveBeenCalledWith('l1'))
  })

  it('cannot ask for confirmation until there is a completion date', async () => {
    api.learnerList.mockResolvedValue({ courses: [learner({ completedOn: null })] })
    renderIn(<MyLearningPanel />)

    expect(await screen.findByRole('button', { name: /ask the provider to confirm/i })).toBeDisabled()
  })

  it('shows the "Verified certificate" badge once confirmed, "waiting" while asked, and the reason if declined', async () => {
    api.learnerList.mockResolvedValue({
      courses: [learner({ id: 'a', title: 'Confirmed one', status: 'CONFIRMED' }), learner({ id: 'b', title: 'Asked one', status: 'REQUESTED' }), learner({ id: 'c', title: 'Declined one', status: 'DECLINED', decisionNote: 'No record of you.' })],
    })
    renderIn(<MyLearningPanel />)

    expect(await screen.findByText('Verified certificate')).toBeInTheDocument()
    expect(screen.getByText('Waiting for the provider')).toBeInTheDocument()
    expect(screen.getByText(/no record of you/i)).toBeInTheDocument()
    // Only a declined or unconfirmed catalogue course can be asked again.
    expect(screen.getAllByRole('button', { name: /ask the provider to confirm/i })).toHaveLength(1)
  })

  it('a course written in by hand has no confirm button, and a course can be removed', async () => {
    api.learnerList.mockResolvedValue({ courses: [learner({ courseId: null, courseSlug: null, title: 'Hand written' })] })
    renderIn(<MyLearningPanel />)

    await screen.findByText('Hand written')
    expect(screen.queryByRole('button', { name: /ask the provider to confirm/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /remove hand written/i }))
    await waitFor(() => expect(api.learnerRemove).toHaveBeenCalledWith('l1'))
  })
})

describe('"Build skills for this job"', () => {
  const found = (id: string): Course => ({
    id,
    slug: `excel-${id}`,
    title: `Excel course ${id}`,
    summary: 's',
    category: 'office-skills',
    level: 'BEGINNER',
    isFree: false,
    priceGhs: 300,
    durationWeeks: 4,
    format: 'ONLINE',
    location: null,
    startDates: [],
    rollingStart: true,
    certificateOffered: false,
    enrolUrl: null,
    enquiryEnabled: true,
    skills: ['excel'],
    featured: false,
    createdAt: new Date().toISOString(),
    provider: { id: 'p1', name: 'Accra Training Centre', logoUrl: null, isVerified: false },
  })

  it('shows the courses that teach what the job asks for', async () => {
    api.forJob.mockResolvedValue({ courses: [found('1'), found('2')], skills: ['Microsoft Excel'] })
    renderIn(<CoursesForJob jobId="job-1" />)

    expect(await screen.findByRole('heading', { name: /build skills for this job/i })).toBeInTheDocument()
    expect(screen.getByText(/courses that teach microsoft excel/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Excel course 1' })).toHaveAttribute('href', '/courses/excel-1')
    expect(api.forJob).toHaveBeenCalledWith('job-1')
  })

  it('shows nothing at all when there is no course, or when it cannot be loaded', async () => {
    const { container } = renderIn(<CoursesForJob jobId="job-1" />)
    await waitFor(() => expect(api.forJob).toHaveBeenCalled())
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(container.querySelector('section')).toBeNull()

    api.forJob.mockRejectedValue(new Error('offline'))
    const second = renderIn(<CoursesForJob jobId="job-2" />)
    await waitFor(() => expect(api.forJob).toHaveBeenCalledWith('job-2'))
    expect(second.container.querySelector('section')).toBeNull()
  })
})

describe('what an employer sees about an applicant\'s courses', () => {
  it('shows each course, with "Verified certificate" only on the ones the provider confirmed', () => {
    const applicant = {
      id: 'app-1',
      status: 'SUBMITTED',
      createdAt: '2026-11-01T00:00:00.000Z',
      coverLetter: 'Hello',
      seeker: {
        id: 's1',
        email: 'ama@example.com',
        jobSeekerProfile: { firstName: 'Ama', lastName: 'Mensah', skills: 'Excel' },
        learnerCourses: [
          { id: 'x1', title: 'Excel for accountants', providerName: 'Accra Training Centre', completedOn: '2026-10-01T00:00:00.000Z', certificateUrl: null, verified: true },
          { id: 'x2', title: 'Google Data Analytics', providerName: 'Coursera', completedOn: null, certificateUrl: 'https://coursera.example/cert/1', verified: false },
        ],
      },
    }
    renderIn(
      <EmployerApplicantsPanel
        jobs={[{ id: 'job-1', title: 'Accounts Clerk', status: 'ACTIVE', createdAt: '2026-11-01T00:00:00.000Z', _count: { applications: 1 } }]}
        applicants={[applicant] as never}
        selectedJobId="job-1"
        selectedJobTitle="Accounts Clerk"
        isApplicantsLoading={false}
        onSelectJob={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByText('Courses and certificates')).toBeInTheDocument()
    expect(screen.getByText('Excel for accountants')).toBeInTheDocument()
    expect(screen.getAllByText('Verified certificate')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Certificate link' })).toHaveAttribute('href', 'https://coursera.example/cert/1')
  })
})

describe('the admin\'s course panel', () => {
  const queueCourse = (overrides: Record<string, unknown> = {}) => ({
    id: 'c1',
    slug: 'excel-1',
    title: 'Excel for accountants',
    summary: 'Spreadsheets.',
    description: 'Long description.',
    category: 'finance-accounting',
    isFree: false,
    priceGhs: 450,
    enrolUrl: 'https://provider.example/enrol',
    skills: ['excel'],
    status: 'ACTIVE',
    reviewStatus: 'PENDING',
    reviewNote: null,
    featured: false,
    featuredUntil: null,
    providerId: 'p1',
    providerName: 'Accra Training Centre',
    providerStatus: 'APPROVED',
    ...overrides,
  })

  it('approves a provider, and rejects one with a reason', async () => {
    api.queue.mockResolvedValue({ providers: [{ userId: 'p1', companyName: 'Accra Training Centre', description: 'We train.', website: null, email: 'info@act.example', isVerified: true }], pending: [], recent: [] })
    renderIn(<AdminCoursesPanel />)

    fireEvent.click(await screen.findByRole('button', { name: /approve accra training centre/i }))
    await waitFor(() => expect(api.reviewProvider).toHaveBeenCalledWith('p1', 'APPROVE'))

    fireEvent.change(screen.getByLabelText('Reason for p1'), { target: { value: 'We could not find this organisation.' } })
    fireEvent.click(screen.getByRole('button', { name: /reject accra training centre/i }))
    await waitFor(() => expect(api.reviewProvider).toHaveBeenCalledWith('p1', 'REJECT', 'We could not find this organisation.'))
  })

  it('approves, rejects or removes a listing, sending the reason', async () => {
    api.queue.mockResolvedValue({ providers: [], pending: [queueCourse()], recent: [] })
    renderIn(<AdminCoursesPanel />)

    fireEvent.click(await screen.findByRole('button', { name: /approve excel for accountants/i }))
    await waitFor(() => expect(api.reviewCourse).toHaveBeenCalledWith('c1', 'APPROVE'))

    fireEvent.change(screen.getByLabelText('Reason for c1'), { target: { value: 'Claims an accreditation it lacks.' } })
    fireEvent.click(screen.getByRole('button', { name: /remove excel for accountants/i }))
    await waitFor(() => expect(api.reviewCourse).toHaveBeenCalledWith('c1', 'REMOVE', 'Claims an accreditation it lacks.'))
  })

  it('features an approved listing for a number of days', async () => {
    api.queue.mockResolvedValue({ providers: [], pending: [], recent: [queueCourse({ reviewStatus: 'APPROVED' })] })
    renderIn(<AdminCoursesPanel />)

    fireEvent.change(await screen.findByLabelText(/feature for \(days\)/i), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: /set featured/i }))

    await waitFor(() => expect(api.featured).toHaveBeenCalledWith('c1', 14))
  })

  it('says so when the queue cannot be loaded', async () => {
    api.queue.mockRejectedValue(new Error('Network down'))
    renderIn(<AdminCoursesPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/network down/i)
  })
})
