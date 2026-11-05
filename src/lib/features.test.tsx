import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { isFreelancePath, setFeaturesForTests } from './features'

const useAuthMock = vi.fn()

vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }))
vi.mock('./api', () => ({ apiGetWorkspaceSignals: () => Promise.resolve({}) }))
vi.mock('./realtime', () => ({ subscribeToRealtimeEvents: () => () => undefined }))
vi.mock('../components/NotificationCenter', () => ({ default: () => null }))

const FREELANCE_HREFS = ['/freelancers', '/proposals', '/agreements']

const hrefs = () => screen.queryAllByRole('link').map((link) => link.getAttribute('href') ?? '')
const freelanceLinks = () => hrefs().filter((href) => FREELANCE_HREFS.some((path) => href.startsWith(path)))

const signedIn = (role: string) =>
  useAuthMock.mockReturnValue({
    user: { id: 'u1', email: 'ada@example.com' },
    role,
    isOnboarded: true,
    userName: 'Ada',
    userEmail: 'ada@example.com',
    logout: vi.fn(),
  })

describe('isFreelancePath', () => {
  it('matches the freelance, proposal and agreement pages only', () => {
    for (const href of ['/freelancers', '/freelancers/abc', '/proposals', '/agreements', '/agreements?x=1']) {
      expect(isFreelancePath(href)).toBe(true)
    }
    for (const href of ['/jobs', '/jobs/1', '/dashboard', '/#freelance-gigs', '/messaging', '/companies/1']) {
      expect(isFreelancePath(href)).toBe(false)
    }
  })
})

describe('navigation with FREELANCE_ENABLED off', () => {
  for (const role of ['SEEKER', 'EMPLOYER', 'FREELANCER', 'ADMIN']) {
    it(`shows no freelance, proposal or agreement links to a ${role}`, () => {
      setFeaturesForTests({ freelanceEnabled: false })
      signedIn(role)

      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      )

      // An employer works from their own workspace, so the job seeker pages are not in their menu.
      if (role === 'EMPLOYER') expect(hrefs()).not.toContain('/jobs')
      else expect(hrefs()).toContain('/jobs')
      expect(freelanceLinks()).toEqual([])
    })
  }

  it('gives job seekers a My applications link, in the menu and on the phone dock, whatever the flag says', () => {
    setFeaturesForTests({ freelanceEnabled: false })
    signedIn('SEEKER')

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    )

    expect(hrefs().filter((href) => href === '/applications').length).toBeGreaterThanOrEqual(2)
  })

  it('gives job seekers a Saved jobs link, and nobody else', () => {
    setFeaturesForTests({ freelanceEnabled: false })
    signedIn('SEEKER')
    const seeker = render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    )
    expect(hrefs().filter((href) => href === '/saved-jobs').length).toBeGreaterThanOrEqual(2)
    seeker.unmount()

    signedIn('EMPLOYER')
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    )
    expect(hrefs()).not.toContain('/saved-jobs')
  })

  it('does not show employers a My applications link', () => {
    setFeaturesForTests({ freelanceEnabled: false })
    signedIn('EMPLOYER')

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    )

    expect(hrefs()).not.toContain('/applications')
  })

  it('shows them again when the flag is on', () => {
    setFeaturesForTests({ freelanceEnabled: true })
    signedIn('SEEKER')

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    )

    expect(freelanceLinks().length).toBeGreaterThan(0)
  })

  it('keeps freelance out of the footer and points to the waitlist instead', () => {
    setFeaturesForTests({ freelanceEnabled: false })

    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )

    expect(freelanceLinks()).toEqual([])
    expect(screen.getByRole('link', { name: /freelance gigs \(coming soon\)/i })).toHaveAttribute('href', '/#freelance-gigs')
  })

  it('lists freelance pages in the footer when the flag is on', () => {
    setFeaturesForTests({ freelanceEnabled: true })

    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /find freelance gigs/i })).toHaveAttribute('href', '/freelancers')
  })
})
