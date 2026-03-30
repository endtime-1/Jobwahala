import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

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

describe('Dashboard smoke role switching', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it.each([
    ['SEEKER', 'Seeker Dashboard'],
    ['EMPLOYER', 'Employer Dashboard'],
    ['FREELANCER', 'Freelancer Dashboard'],
    ['ADMIN', 'Admin Dashboard'],
  ])('renders %s users into the correct dashboard', async (role, label) => {
    useAuthMock.mockReturnValue({ role })

    render(<Dashboard />)

    expect(await screen.findByText(label)).toBeInTheDocument()
  })
})
