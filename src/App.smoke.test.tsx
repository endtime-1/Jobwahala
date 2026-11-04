import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { setFeaturesForTests } from './lib/features'

const useAuthMock = vi.fn()

vi.mock('./context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('./components/Layout', async () => {
  const router = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )

  return {
    default: function LayoutMock() {
      const Outlet = router.Outlet
      return (
        <div data-testid="layout">
          <Outlet />
        </div>
      )
    },
  }
})

vi.mock('./pages/Landing', () => ({
  default: () => <div>Landing Page</div>,
}))

vi.mock('./pages/JobListings', () => ({
  default: () => <div>Job Listings Page</div>,
}))

vi.mock('./pages/JobDetails', () => ({
  default: () => <div>Job Details Page</div>,
}))

vi.mock('./pages/CVGenerator', () => ({
  default: () => <div>CV Generator Page</div>,
}))

vi.mock('./pages/Messaging', () => ({
  default: () => <div>Messaging Page</div>,
}))

vi.mock('./pages/Agreements', () => ({
  default: () => <div>Agreements Page</div>,
}))

vi.mock('./pages/Onboarding', () => ({
  default: () => <div>Onboarding Page</div>,
}))

vi.mock('./pages/Login', () => ({
  default: () => <div>Login Page</div>,
}))

vi.mock('./pages/Signup', () => ({
  default: () => <div>Signup Page</div>,
}))

vi.mock('./pages/FreelancerMarketplace', () => ({
  default: () => <div>Freelancer Marketplace Page</div>,
}))

vi.mock('./pages/FreelancerProfile', () => ({
  default: () => <div>Freelancer Profile Page</div>,
}))

vi.mock('./pages/Dashboard', () => ({
  default: () => <div>Dashboard Page</div>,
}))

function renderRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App smoke routing', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: false,
      isOnboarded: false,
    })
  })

  it('renders the login page for guests', async () => {
    renderRoute('/login')

    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })

  it('redirects guests away from protected routes', async () => {
    renderRoute('/dashboard')

    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })

  it('redirects signed-in users without onboarding to onboarding', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'user-1', role: 'SEEKER' },
      isLoading: false,
      isOnboarded: false,
    })

    renderRoute('/dashboard')

    expect(await screen.findByText('Onboarding Page')).toBeInTheDocument()
  })

  it('redirects onboarded users away from auth pages to the dashboard', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'user-1', role: 'SEEKER' },
      isLoading: false,
      isOnboarded: true,
    })

    renderRoute('/login')

    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument()
  })

  it('shows the loading workspace state while auth is resolving', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: true,
      isOnboarded: false,
    })

    renderRoute('/dashboard')

    expect(screen.getByText('Loading Workspace')).toBeInTheDocument()
  })
})

vi.mock('./pages/Proposals', () => ({
  default: () => <div>Proposals Page</div>,
}))

describe('freelance feature flag', () => {
  const signedInSeeker = () =>
    useAuthMock.mockReturnValue({ user: { id: 'user-1', role: 'SEEKER' }, isLoading: false, isOnboarded: true })

  beforeEach(() => signedInSeeker())

  it.each(['/freelancers', '/freelancers/abc', '/proposals', '/agreements'])(
    'sends %s to the landing page waitlist while the flag is off',
    async (route) => {
      setFeaturesForTests({ freelanceEnabled: false })

      renderRoute(route)

      expect(await screen.findByText('Landing Page')).toBeInTheDocument()
      expect(screen.queryByText(/Marketplace Page|Profile Page|Proposals Page|Agreements Page/)).not.toBeInTheDocument()
    },
  )

  it('opens the freelance pages when the flag is on', async () => {
    setFeaturesForTests({ freelanceEnabled: true })

    renderRoute('/freelancers')
    expect(await screen.findByText('Freelancer Marketplace Page')).toBeInTheDocument()
  })

  it('opens agreements for a signed-in user when the flag is on', async () => {
    setFeaturesForTests({ freelanceEnabled: true })

    renderRoute('/agreements')
    expect(await screen.findByText('Agreements Page')).toBeInTheDocument()
  })
})
