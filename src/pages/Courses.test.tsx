import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SKILLS } from '../content/skills'
import { courseFilterParams, emptyCourseFilters, durationText, priceLabel, skillFromCoursesSlug, startText, hasCourseFilters, type Course } from '../lib/courses'
import Courses from './Courses'
import CourseDetail from './CourseDetail'
import SlugPage, { CourseCategoryPage } from './SlugPage'

const apiListCoursesMock = vi.fn()
const apiGetCourseMock = vi.fn()
const apiTrackMock = vi.fn()
const apiEnquiryMock = vi.fn()
const apiLandingMock = vi.fn()
const apiJobLandingMock = vi.fn()

vi.mock('../lib/api', () => ({
  apiListCourses: (...args: unknown[]) => apiListCoursesMock(...args),
  apiGetCourse: (...args: unknown[]) => apiGetCourseMock(...args),
  apiTrackCourseEvent: (...args: unknown[]) => apiTrackMock(...args),
  apiCreateCourseEnquiry: (...args: unknown[]) => apiEnquiryMock(...args),
  apiGetCourseLanding: (...args: unknown[]) => apiLandingMock(...args),
  apiGetLandingPage: (...args: unknown[]) => apiJobLandingMock(...args),
}))

const course = (id: string, overrides: Partial<Course> = {}): Course => ({
  id,
  slug: `excel-${id}`,
  title: `Excel for accountants ${id}`,
  summary: 'Spreadsheets for everyday accounting work.',
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
  skills: ['excel', 'accounting'],
  featured: false,
  createdAt: new Date().toISOString(),
  provider: { id: 'p1', name: 'Accra Training Centre', logoUrl: null, isVerified: true },
  ...overrides,
})

const renderAt = (path: string, element = <Courses />, routePath = '/courses') =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null
const lastParams = () => apiListCoursesMock.mock.calls[apiListCoursesMock.mock.calls.length - 1][0] as Record<string, string>

beforeEach(() => {
  vi.clearAllMocks()
  apiListCoursesMock.mockResolvedValue({ courses: [], total: 0 })
  apiTrackMock.mockResolvedValue(undefined)
})

describe('the course helpers', () => {
  it('say the price, the length and the start in plain words', () => {
    expect(priceLabel({ isFree: true, priceGhs: null })).toBe('Free')
    expect(priceLabel({ isFree: false, priceGhs: 1500 })).toBe('GHS 1,500')
    expect(durationText(1)).toBe('1 week')
    expect(durationText(6)).toBe('6 weeks')
    expect(durationText(26)).toBe('6 months')
    expect(startText({ startDates: [], rollingStart: true })).toBe('Starts any time')
    expect(startText({ startDates: ['2099-02-01', '2099-01-10'], rollingStart: false })).toBe('Next start: 10 Jan 2099')
    expect(startText({ startDates: ['2020-01-01'], rollingStart: false })).toBe('')
  })

  it('turn the filters into what the server is asked', () => {
    expect(courseFilterParams(emptyCourseFilters)).toEqual({})
    expect(
      courseFilterParams({ search: ' excel ', category: 'office-skills', skill: 'excel', level: 'BEGINNER', format: 'ONLINE', location: ' Accra ', price: 'free', verified: true }),
    ).toEqual({ q: 'excel', category: 'office-skills', skill: 'excel', level: 'BEGINNER', format: 'ONLINE', location: 'Accra', free: '1', verified: '1' })
    expect(courseFilterParams({ ...emptyCourseFilters, price: '500' })).toEqual({ maxPrice: '500' })
    expect(hasCourseFilters(emptyCourseFilters)).toBe(false)
  })

  it('read a skill out of a "[skill] courses in Ghana" address', () => {
    expect(skillFromCoursesSlug('excel-courses-in-ghana')).toBe('excel')
    expect(skillFromCoursesSlug('juggling-courses-in-ghana')).toBeNull()
    expect(SKILLS.length).toBeGreaterThan(40)
  })
})

describe('the Courses page', () => {
  it('lists courses with the price first, how long, how, and the provider', async () => {
    apiListCoursesMock.mockResolvedValue({ courses: [course('1')], total: 1 })

    renderAt('/courses')

    const card = within(await screen.findByRole('list', { name: 'Results' }))
    expect(card.getByRole('link', { name: 'Excel for accountants 1' })).toHaveAttribute('href', '/courses/excel-1')
    expect(card.getByText('GHS 450')).toBeInTheDocument()
    expect(card.getByText('6 weeks')).toBeInTheDocument()
    expect(card.getByText('Starts any time')).toBeInTheDocument()
    expect(card.getByText('Certificate')).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'Accra Training Centre' })).toHaveAttribute('href', '/providers/p1')
    expect(await screen.findByText('1 course')).toBeInTheDocument()
  })

  it('shows free courses as "Free" and featured ones as featured', async () => {
    apiListCoursesMock.mockResolvedValue({ courses: [course('2', { isFree: true, priceGhs: null, featured: true })], total: 1 })

    renderAt('/courses')

    expect(await screen.findByText('Featured')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Results' })).getByText('Free')).toBeInTheDocument()
  })

  it('asks again with each filter: category, skill, price, format, location, level, verified', async () => {
    renderAt('/courses')
    await waitFor(() => expect(apiListCoursesMock).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/^category/i), { target: { value: 'finance-accounting' } })
    fireEvent.change(screen.getByLabelText(/skill you want to learn/i), { target: { value: 'excel' } })
    fireEvent.change(screen.getByLabelText(/^price/i), { target: { value: 'free' } })
    fireEvent.change(screen.getByLabelText(/how you learn/i), { target: { value: 'IN_PERSON' } })
    fireEvent.change(screen.getByLabelText(/^level/i), { target: { value: 'BEGINNER' } })
    fireEvent.click(screen.getByLabelText(/verified providers only/i))
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Kumasi' } })

    await waitFor(() =>
      expect(lastParams()).toEqual({ category: 'finance-accounting', skill: 'excel', free: '1', format: 'IN_PERSON', level: 'BEGINNER', verified: '1', location: 'Kumasi' }),
    )
  })

  it('shows each filter as a chip that can be removed, and clears them all', async () => {
    renderAt('/courses?category=office-skills&skill=excel')
    await waitFor(() => expect(apiListCoursesMock).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /remove filter microsoft excel/i }))
    await waitFor(() => expect(lastParams()).toEqual({ category: 'office-skills' }))

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    await waitFor(() => expect(lastParams()).toEqual({}))
  })

  it('says so when nothing is listed or nothing matches, and invites providers', async () => {
    renderAt('/courses')
    expect(await screen.findByText(/no courses are listed yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /list your courses/i })).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/verified providers only/i))
    expect(await screen.findByText(/no courses match those filters/i)).toBeInTheDocument()
  })

  it('says so when the search fails', async () => {
    apiListCoursesMock.mockRejectedValue(new Error('Network down'))

    renderAt('/courses')

    expect(await screen.findByRole('alert')).toHaveTextContent(/network down/i)
  })
})

describe('a course page', () => {
  const open = (data: Record<string, unknown> = {}) => {
    apiGetCourseMock.mockResolvedValue({ course: { ...course('1'), description: 'Six weeks of practical Excel.\nBring a laptop.', ...data }, related: [course('2')] })
    return renderAt('/courses/excel-1', <CourseDetail />, '/courses/:slug')
  }

  it('shows the price, the facts, the skills and the provider, and counts one view', async () => {
    open({ startDates: [], rollingStart: false, startDatesNote: undefined })

    expect(await screen.findByRole('heading', { level: 1, name: 'Excel for accountants 1' })).toBeInTheDocument()
    const facts = within(screen.getByRole('list', { name: 'Course facts' }))
    expect(facts.getByText('6 weeks')).toBeInTheDocument()
    expect(facts.getByText('Online')).toBeInTheDocument()
    expect(facts.getByText('Offered')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Microsoft Excel' })).toHaveAttribute('href', '/excel-courses-in-ghana')
    expect(screen.getByText(/bring a laptop/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Similar courses' })).toBeInTheDocument()
    await waitFor(() => expect(apiTrackMock).toHaveBeenCalledWith('1', 'VIEW'))
  })

  it('counts a click on the enrolment link, which opens safely in a new tab', async () => {
    open()

    const link = await screen.findByRole('link', { name: /enrol with accra training centre/i })
    expect(link).toHaveAttribute('href', 'https://provider.example/enrol')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toMatch(/noopener/)
    fireEvent.click(link)

    expect(apiTrackMock).toHaveBeenCalledWith('1', 'CLICK')
  })

  it('sends an enquiry, and says it was sent', async () => {
    apiEnquiryMock.mockResolvedValue({ success: true })
    open()

    fireEvent.change(await screen.findByLabelText('Your name'), { target: { value: 'Ama Mensah' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ama@example.com' } })
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Is there a weekend class?' } })
    fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }))

    await waitFor(() => expect(apiEnquiryMock).toHaveBeenCalledWith('1', { name: 'Ama Mensah', email: 'ama@example.com', message: 'Is there a weekend class?' }, undefined))
    expect(await screen.findByRole('status')).toHaveTextContent(/sent/i)
  })

  it('needs an email or a phone number before an enquiry can be sent', async () => {
    open()

    fireEvent.change(await screen.findByLabelText('Your name'), { target: { value: 'Ama Mensah' } })
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Is there a weekend class?' } })

    expect(screen.getByRole('button', { name: /send enquiry/i })).toBeDisabled()
  })

  it('says why when an enquiry fails', async () => {
    apiEnquiryMock.mockRejectedValue(new Error('Too many enquiries'))
    open()

    fireEvent.change(await screen.findByLabelText('Your name'), { target: { value: 'Ama Mensah' } })
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0241234567' } })
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Is there a weekend class?' } })
    fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many enquiries/i)
  })

  it('has no enquiry form when the provider takes enrolments only through its own link', async () => {
    open({ enquiryEnabled: false })

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: /send enquiry/i })).not.toBeInTheDocument()
  })

  it('a course that is gone shows "not found" and is not indexed', async () => {
    apiGetCourseMock.mockRejectedValue(Object.assign(new Error('Course not found'), { status: 404 }))

    renderAt('/courses/nope', <CourseDetail />, '/courses/:slug')

    await waitFor(() => expect(robots()).toBe('noindex, follow'))
    expect(apiTrackMock).not.toHaveBeenCalled()
  })
})

describe('category and skill pages', () => {
  const page = (overrides: Record<string, unknown> = {}) => ({
    kind: 'skill',
    slug: 'excel',
    path: '/excel-courses-in-ghana',
    h1: 'Microsoft Excel courses in Ghana',
    title: 'Microsoft Excel courses in Ghana - 3 courses',
    description: 'Compare 3 Microsoft Excel courses in Ghana.',
    intro: 'There are 3 Microsoft Excel courses in Ghana on JobWahala from 1 training provider.',
    count: 3,
    indexable: true,
    courses: [course('1'), course('2'), course('3')],
    related: [{ label: 'Office and admin skills', path: '/courses/category/office-skills', count: 3 }],
    ...overrides,
  })

  it('a "[skill] courses in Ghana" address shows that skill\'s page', async () => {
    apiLandingMock.mockResolvedValue({ page: page() })

    renderAt('/excel-courses-in-ghana', <SlugPage />, '/:slug')

    expect(await screen.findByRole('heading', { level: 1, name: 'Microsoft Excel courses in Ghana' })).toBeInTheDocument()
    expect(apiLandingMock).toHaveBeenCalledWith('skill', 'excel')
    expect(apiJobLandingMock).not.toHaveBeenCalled()
    expect(screen.getAllByRole('link', { name: /excel for accountants/i })).toHaveLength(3)
    expect(screen.getByRole('link', { name: /office and admin skills \(3\)/i })).toHaveAttribute('href', '/courses/category/office-skills')
    await waitFor(() => expect(robots()).toBeNull())
  })

  it('any other one-word address still goes to the jobs pages', async () => {
    apiJobLandingMock.mockResolvedValue({ page: { slug: 'jobs-in-accra', path: '/jobs-in-accra', kind: 'place', h1: 'Jobs in Accra', title: 'Jobs in Accra', description: 'd', intro: 'i', count: 0, indexable: false, jobs: [], related: [], breadcrumbs: [{ label: 'Home', path: '/' }] } })

    renderAt('/jobs-in-accra', <SlugPage />, '/:slug')

    expect(await screen.findByRole('heading', { level: 1, name: 'Jobs in Accra' })).toBeInTheDocument()
    expect(apiLandingMock).not.toHaveBeenCalled()
  })

  it('a category page asks for the category', async () => {
    apiLandingMock.mockResolvedValue({ page: page({ kind: 'category', slug: 'office-skills', path: '/courses/category/office-skills', h1: 'Office and admin skills courses in Ghana' }) })

    renderAt('/courses/category/office-skills', <CourseCategoryPage />, '/courses/category/:category')

    await screen.findByRole('heading', { level: 1, name: /office and admin skills/i })
    expect(apiLandingMock).toHaveBeenCalledWith('category', 'office-skills')
  })

  it('a thin page (fewer than 3 courses) says noindex', async () => {
    apiLandingMock.mockResolvedValue({ page: page({ indexable: false, count: 2, courses: [course('1'), course('2')] }) })

    renderAt('/excel-courses-in-ghana', <SlugPage />, '/:slug')

    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => expect(robots()).toBe('noindex, follow'))
  })

  it('an unknown skill is "not found" and not indexed', async () => {
    renderAt('/juggling-courses-in-ghana', <SlugPage />, '/:slug')

    await waitFor(() => expect(robots()).toBe('noindex, follow'))
    expect(apiLandingMock).not.toHaveBeenCalled()
  })
})
