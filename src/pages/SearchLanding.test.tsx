import { render, screen, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Footer from '../components/Footer'
import { looksLikeLandingSlug } from '../lib/landingSlug'
import SearchLanding from './SearchLanding'

const apiGetLandingPageMock = vi.fn()

vi.mock('../lib/api', () => ({
  apiGetLandingPage: (...args: unknown[]) => apiGetLandingPageMock(...args),
}))

const pageData = (overrides: Record<string, unknown> = {}) => ({
  slug: 'banking-jobs-in-accra',
  path: '/banking-jobs-in-accra',
  kind: 'category-place',
  h1: 'Banking jobs in Accra',
  title: 'Banking jobs in Accra - 4 open now',
  description: 'Apply for 4 open banking jobs in Accra.',
  intro: 'There are 4 open banking jobs in Accra on JobWahala from 2 employers.',
  count: 4,
  indexable: true,
  jobs: [
    { id: 'j1', title: 'Bank Teller', employerName: 'Achiba Bank', location: 'Accra', type: 'Full-time', salary: 'GHS 1,800 a month', createdAt: new Date().toISOString() },
    { id: 'j2', title: 'Loan Officer', employerName: 'Star Microfinance', location: 'Accra', type: 'Full-time', salary: null, createdAt: new Date().toISOString() },
  ],
  related: [
    { title: 'Banking jobs elsewhere', links: [{ label: 'Banking jobs in Kumasi', path: '/banking-jobs-in-kumasi', count: 3 }] },
    { title: 'Broader searches', links: [{ label: 'Banking jobs', path: '/banking-jobs', count: 7 }, { label: 'Jobs in Accra', path: '/jobs-in-accra', count: 12 }] },
  ],
  breadcrumbs: [
    { label: 'Home', path: '/' },
    { label: 'Jobs', path: '/jobs' },
    { label: 'Banking jobs', path: '/banking-jobs' },
    { label: 'Banking jobs in Accra', path: '/banking-jobs-in-accra' },
  ],
  ...overrides,
})

const renderAt = (path: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:slug" element={<SearchLanding />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null

beforeEach(() => {
  vi.clearAllMocks()
  apiGetLandingPageMock.mockResolvedValue({ page: pageData() })
})

describe('a search landing page', () => {
  it('asks the server for the page named in the address', async () => {
    renderAt('/banking-jobs-in-accra')

    await screen.findByRole('heading', { level: 1, name: 'Banking jobs in Accra' })
    expect(apiGetLandingPageMock).toHaveBeenCalledWith('banking-jobs-in-accra')
  })

  it('shows the heading, intro, jobs and related pages', async () => {
    renderAt('/banking-jobs-in-accra')

    expect(await screen.findByText(/there are 4 open banking jobs in accra/i)).toBeInTheDocument()
    const jobs = within(screen.getByRole('list', { name: 'Open jobs' }))
    expect(jobs.getByRole('link', { name: 'Bank Teller' })).toHaveAttribute('href', '/jobs/j1')
    expect(jobs.getByText('GHS 1,800 a month')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /banking jobs in kumasi/i })).toHaveAttribute('href', '/banking-jobs-in-kumasi')
    expect(screen.getByRole('link', { name: /jobs in accra \(12\)/i })).toHaveAttribute('href', '/jobs-in-accra')
  })

  it('has breadcrumbs back up the tree, ending on the current page', async () => {
    renderAt('/banking-jobs-in-accra')

    const crumbs = within(await screen.findByRole('navigation', { name: 'Breadcrumb' }))
    expect(crumbs.getByRole('link', { name: 'Banking jobs' })).toHaveAttribute('href', '/banking-jobs')
    expect(crumbs.getByText('Banking jobs in Accra')).toHaveAttribute('aria-current', 'page')
  })

  it('a published page can be indexed', async () => {
    renderAt('/banking-jobs-in-accra')

    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => expect(document.title).toContain('Banking jobs in Accra - 4 open now'))
    expect(robots()).toBeNull()
  })

  it('a thin page tells search engines not to index it', async () => {
    apiGetLandingPageMock.mockResolvedValue({ page: pageData({ indexable: false, count: 2, jobs: pageData().jobs }) })

    renderAt('/banking-jobs-in-accra')

    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => expect(robots()).toBe('noindex, follow'))
  })

  it('a page with no jobs says so and points to all jobs', async () => {
    apiGetLandingPageMock.mockResolvedValue({ page: pageData({ indexable: false, count: 0, jobs: [], related: [] }) })

    renderAt('/banking-jobs-in-accra')

    expect(await screen.findByText(/no open jobs right now/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /see every open job/i })).toHaveAttribute('href', '/jobs')
  })

  it('a directory page lists its links and no jobs', async () => {
    apiGetLandingPageMock.mockResolvedValue({
      page: pageData({
        kind: 'directory',
        h1: 'Jobs by location',
        jobs: [],
        related: [{ title: 'Cities and towns', links: [{ label: 'Jobs in Accra', path: '/jobs-in-accra', count: 12 }] }],
        breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Jobs by location', path: '/jobs-by-location' }],
      }),
    })

    renderAt('/jobs-by-location')

    expect(await screen.findByRole('heading', { level: 1, name: 'Jobs by location' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Cities and towns' })).toBeInTheDocument()
    expect(screen.queryByText(/no open jobs right now/i)).not.toBeInTheDocument()
  })
})

describe('addresses that are not landing pages', () => {
  it('shows "not found" without asking the server, and is not indexed', async () => {
    renderAt('/something-else')

    await waitFor(() => expect(robots()).toBe('noindex, follow'))
    expect(apiGetLandingPageMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { level: 1, name: 'Banking jobs in Accra' })).not.toBeInTheDocument()
  })

  it('shows "not found" when the server has no such page', async () => {
    apiGetLandingPageMock.mockRejectedValue(Object.assign(new Error('Page not found'), { status: 404 }))

    renderAt('/jobs-in-narnia')

    await waitFor(() => expect(robots()).toBe('noindex, follow'))
    expect(screen.queryByText(/loading jobs/i)).not.toBeInTheDocument()
  })

  it('says so, and is not indexed, when the page cannot be loaded', async () => {
    apiGetLandingPageMock.mockRejectedValue(new Error('Network down'))

    renderAt('/banking-jobs')

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load this page/i)
    await waitFor(() => expect(robots()).toBe('noindex, follow'))
  })

  it('recognises our address shapes', () => {
    for (const slug of ['jobs-in-accra', 'banking-jobs', 'banking-jobs-in-accra', 'jobs-by-location', 'jobs-by-category', 'part-time-jobs']) {
      expect(looksLikeLandingSlug(slug), slug).toBe(true)
    }
    for (const slug of ['login', 'dashboard', 'jobs', 'saved-job', 'jobs-in-']) {
      expect(looksLikeLandingSlug(slug), slug).toBe(false)
    }
  })
})

describe('the footer', () => {
  it('links the main search pages and both directories', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )

    const href = (name: string) => screen.getByRole('link', { name }).getAttribute('href')
    expect(href('Jobs by location')).toBe('/jobs-by-location')
    expect(href('Jobs by category')).toBe('/jobs-by-category')
    expect(href('Jobs in Accra')).toBe('/jobs-in-accra')
    expect(href('Jobs in Kumasi')).toBe('/jobs-in-kumasi')
    expect(href('Remote jobs')).toBe('/remote-jobs')
    expect(href('Part-time jobs')).toBe('/part-time-jobs')
    expect(href('Internships')).toBe('/internship-jobs')
    expect(href('National Service (NSS)')).toBe('/nss-jobs')
    expect(href('Fresher jobs')).toBe('/fresher-jobs')
  })
})
