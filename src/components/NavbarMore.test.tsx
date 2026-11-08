import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setFeaturesForTests } from '../lib/features'
import Navbar from './Navbar'

const useAuthMock = vi.fn()

vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }))
vi.mock('../lib/api', () => ({ apiGetWorkspaceSignals: () => Promise.resolve({}) }))
vi.mock('../lib/realtime', () => ({ subscribeToRealtimeEvents: () => () => undefined }))
vi.mock('./NotificationCenter', () => ({ default: () => null }))

const signedInAs = (role: string) =>
  useAuthMock.mockReturnValue({ user: { id: 'u1', email: 'ada@example.com' }, role, isOnboarded: true, userName: 'Ada', userEmail: 'ada@example.com', logout: vi.fn() })

// The desktop bar is the first navigation that is not the phone sheet or the dock.
const desktopBar = () => document.querySelector('.nav-links-rail') as HTMLElement

beforeEach(() => {
  vi.clearAllMocks()
  setFeaturesForTests({ freelanceEnabled: false })
})

const renderBar = () =>
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  )

describe('the desktop menu for a job seeker', () => {
  it('keeps the five main links on the bar, so none of them is cut off', () => {
    signedInAs('SEEKER')
    renderBar()

    const names = within(desktopBar())
      .getAllByRole('link')
      .map((link) => link.textContent?.trim())
    expect(names).toEqual(['Browse Jobs', 'Internships & NSS', 'My applications', 'Dashboard', 'Messages'])
  })

  it('puts the rest under More, which opens a list of them', () => {
    signedInAs('SEEKER')
    renderBar()
    expect(screen.queryByLabelText('More pages')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /more/i }))

    const menu = screen.getByLabelText('More pages')
    const names = within(menu).getAllByRole('link').map((link) => link.textContent?.trim())
    expect(names).toEqual(['Courses', 'Saved jobs', 'CV Generator', 'Resources'])
    expect(screen.getByRole('button', { name: /more/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes with Escape, with a click elsewhere, and when you pick a page', () => {
    signedInAs('SEEKER')
    renderBar()
    const open = () => fireEvent.click(screen.getByRole('button', { name: /more/i }))

    open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByLabelText('More pages')).not.toBeInTheDocument()

    open()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByLabelText('More pages')).not.toBeInTheDocument()

    open()
    fireEvent.click(within(screen.getByLabelText('More pages')).getByRole('link', { name: /Saved jobs/ }))
    expect(screen.queryByLabelText('More pages')).not.toBeInTheDocument()
  })
})

describe('the other roles', () => {
  it('an employer keeps its five workspace links on the bar, and has nothing to put under More while freelance is off', () => {
    signedInAs('EMPLOYER')
    renderBar()

    const names = within(desktopBar()).getAllByRole('link').map((link) => link.textContent?.trim())
    expect(names).toEqual(['Dashboard', 'CV database', 'Plans & billing', 'Team', 'Messages'])
    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument()
  })

  it('a menu that already fits has no More button', () => {
    useAuthMock.mockReturnValue({ user: null, role: null, isOnboarded: false, userName: '', userEmail: '', logout: vi.fn() })
    renderBar()

    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument()
  })

  it('when freelance is on, an employer finds Find Talent, Proposals and Agreements under More', () => {
    setFeaturesForTests({ freelanceEnabled: true })
    signedInAs('EMPLOYER')
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: /more/i }))

    const names = within(screen.getByLabelText('More pages')).getAllByRole('link').map((link) => link.textContent?.trim())
    expect(names).toEqual(['Find Talent', 'Proposals', 'Agreements'])
  })

  it('the phone menu is not affected: it still has every link', () => {
    signedInAs('SEEKER')
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    const everyLink = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    for (const href of ['/jobs', '/internships', '/courses', '/applications', '/saved-jobs', '/dashboard', '/cv-generator', '/messaging', '/blog']) {
      expect(everyLink).toContain(href)
    }
  })
})
