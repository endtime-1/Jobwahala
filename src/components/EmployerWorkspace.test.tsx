import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Navbar from './Navbar'

const useAuthMock = vi.fn()

vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }))
vi.mock('../lib/api', () => ({ apiGetWorkspaceSignals: vi.fn().mockResolvedValue({}) }))
vi.mock('../lib/realtime', () => ({ subscribeToRealtimeEvents: () => () => undefined }))
vi.mock('./NotificationCenter', () => ({ default: () => <div /> }))

const signedInAs = (role: 'EMPLOYER' | 'SEEKER') =>
  useAuthMock.mockReturnValue({
    user: { id: 'u1', email: 'hr@akoko.example' },
    role,
    isOnboarded: true,
    userName: 'Akoko Solutions',
    userEmail: 'hr@akoko.example',
    logout: vi.fn(),
  })

const names = () => screen.getAllByRole('link').map((link) => link.textContent?.trim() ?? '')

beforeEach(() => vi.clearAllMocks())

describe('an employer account', () => {
  it('sees an employer workspace in the menu, not the job seeker pages', () => {
    signedInAs('EMPLOYER')
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    )

    const links = names().join(' | ')
    expect(links).toMatch(/Dashboard/)
    expect(links).toMatch(/CV database/)
    expect(links).toMatch(/Plans & billing/)
    expect(links).toMatch(/Team/)
    expect(links).not.toMatch(/Browse Jobs/)
    expect(links).not.toMatch(/Internships & NSS/)
    expect(links).not.toMatch(/Courses/)
  })

  it('a job seeker still sees the job pages', () => {
    signedInAs('SEEKER')
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    )

    const links = names().join(' | ')
    expect(links).toMatch(/Browse Jobs/)
    expect(links).toMatch(/Internships & NSS/)
    expect(links).not.toMatch(/CV database/)
  })
})
