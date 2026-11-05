import { render, screen, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Footer from './Footer'
import LegalPage from './LegalPage'
import Navbar from './Navbar'
import SEO from './SEO'
import NotFound from '../pages/NotFound'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, role: null, isOnboarded: false, userName: '', userEmail: '', logout: vi.fn() }),
}))
vi.mock('../lib/api', () => ({ apiGetWorkspaceSignals: vi.fn().mockResolvedValue({}) }))
vi.mock('../lib/realtime', () => ({ subscribeToRealtimeEvents: () => () => undefined }))
vi.mock('./NotificationCenter', () => ({ default: () => <div /> }))

const wrap = (node: React.ReactNode) => (
  <HelmetProvider>
    <MemoryRouter>{node}</MemoryRouter>
  </HelmetProvider>
)

beforeEach(() => {
  document.head.innerHTML = ''
})

describe('the address search engines and share previews see', () => {
  it('uses www, because the bare domain has no address', async () => {
    render(wrap(<SEO title="Anything" />))

    await waitFor(() => expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://www.jobwahala.com'))
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://www.jobwahala.com/og-image.jpg')
    expect(document.documentElement.outerHTML).not.toContain('https://jobwahala.com')
  })

  it('a page that does not exist asks search engines not to index it', async () => {
    render(wrap(<NotFound />))

    await waitFor(() => expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex'))
  })
})

describe('accessibility and tap targets', () => {
  it('the menu button has a name a screen reader can read', () => {
    render(wrap(<Navbar />))

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('footer links are tall enough to tap', () => {
    render(wrap(<Footer />))

    const link = screen.getByRole('link', { name: 'Terms' })
    expect(link.className).toMatch(/py-2/)
  })

  it('the contents list on a legal page has tappable links', () => {
    render(wrap(<LegalPage title="Terms" description="d" updated="now" intro="intro" sections={[{ heading: 'One', body: <p>text</p> }]} />))

    expect(screen.getByRole('link', { name: '1. One' }).className).toMatch(/py-1\.5/)
  })
})
