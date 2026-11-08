import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'
import { setFeaturesForTests } from '../lib/features'

// These tests cover the freelance screens, which exist only while FREELANCE_ENABLED is on.
setFeaturesForTests({ freelanceEnabled: true })

const useAuthMock = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('./dashboards/SeekerDashboard', () => ({
  default: () => <div>Seeker Dashboard</div>,
}))

vi.mock('./dashboards/EmployerDashboard', () => ({
  default: () => <div>Employer Dashboard</div>,
}))

vi.mock('./dashboards/FreelancerDashboard', () => ({
  default: () => <div>Freelancer Dashboard</div>,
}))

vi.mock('./dashboards/AdminDashboard', () => ({
  default: () => <div>Admin Dashboard</div>,
}))

vi.mock('./dashboards/RecruiterDashboard', () => ({
  default: () => <div>Recruiter Dashboard</div>,
}))

describe('Dashboard smoke role switching', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it.each([
    ['SEEKER', 'Seeker Dashboard'],
    ['EMPLOYER', 'Employer Dashboard'],
    ['FREELANCER', 'Freelancer Dashboard'],
    ['ADMIN', 'Admin Dashboard'],
    ['RECRUITER', 'Recruiter Dashboard'],
  ])('renders %s users into the correct dashboard', async (role, label) => {
    useAuthMock.mockReturnValue({ role })

    render(<Dashboard />)

    expect(await screen.findByText(label)).toBeInTheDocument()
  })
})

describe('Dashboard with the freelance flag off', () => {
  it('shows a coming-soon note to freelancer accounts instead of the freelancer dashboard', () => {
    setFeaturesForTests({ freelanceEnabled: false })
    useAuthMock.mockReturnValue({ role: 'FREELANCER' })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /freelance gigs are coming soon/i })).toBeInTheDocument()
    expect(screen.queryByText('Freelancer Dashboard')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse jobs/i })).toHaveAttribute('href', '/jobs')
  })
})
