import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import About from '../pages/About'
import Footer from '../components/Footer'
import SocialLinks from '../components/SocialLinks'
import { organizationJsonLd, resolveSocialLinks } from './social'

afterEach(() => vi.unstubAllEnvs())

const LINKEDIN = 'https://www.linkedin.com/company/145436921'
const FACEBOOK = 'https://www.facebook.com/profile.php?id=61576395645143'
const WHATSAPP = 'https://whatsapp.com/channel/0029VbEH50105MUaVCzgge2Z'

describe('social links', () => {
  it('has WhatsApp, LinkedIn and Facebook built in, and hides the networks with no link', () => {
    expect(resolveSocialLinks({}).map((link) => [link.key, link.url])).toEqual([
      ['whatsapp', WHATSAPP],
      ['linkedin', LINKEDIN],
      ['facebook', FACEBOOK],
    ])
  })

  it('lets a link be changed from the settings, and shows Instagram, TikTok and X once they are set', () => {
    const links = resolveSocialLinks({
      VITE_LINKEDIN_URL: 'https://www.linkedin.com/company/jobwahala',
      VITE_INSTAGRAM_URL: 'https://www.instagram.com/jobwahala',
      VITE_TIKTOK_URL: 'https://www.tiktok.com/@jobwahala',
      VITE_X_URL: 'https://x.com/jobwahala',
    })
    expect(links.map((link) => link.key)).toEqual(['whatsapp', 'linkedin', 'facebook', 'instagram', 'tiktok', 'x'])
    expect(links.find((link) => link.key === 'linkedin')?.url).toBe('https://www.linkedin.com/company/jobwahala')
  })

  it('ignores placeholders, other websites and links that are not https', () => {
    const links = resolveSocialLinks({
      VITE_LINKEDIN_URL: 'https://evil.example.com/x',
      VITE_FACEBOOK_URL: 'http://facebook.com/x',
      VITE_INSTAGRAM_URL: 'https://instagram.com/REPLACE_ME',
      VITE_X_URL: 'javascript:alert(1)',
    })
    expect(links.map((link) => [link.key, link.url])).toEqual([
      ['whatsapp', WHATSAPP],
      ['linkedin', LINKEDIN],
      ['facebook', FACEBOOK],
    ])
  })

  it('puts every link in the Organization sameAs list', () => {
    expect(organizationJsonLd(resolveSocialLinks({}).map((link) => link.url)).sameAs).toEqual([WHATSAPP, LINKEDIN, FACEBOOK])
  })
})

describe('where the links show', () => {
  it('shows an icon link for each profile, opening in a new tab', () => {
    render(<SocialLinks />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([WHATSAPP, LINKEDIN, FACEBOOK])
    for (const link of links) expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'JobWahala on LinkedIn' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Instagram|TikTok/ })).not.toBeInTheDocument()
  })

  it('adds a network when its setting is filled in', () => {
    vi.stubEnv('VITE_INSTAGRAM_URL', 'https://www.instagram.com/jobwahala')
    render(<SocialLinks />)
    expect(screen.getByRole('link', { name: 'JobWahala on Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/jobwahala')
  })

  it('is in the footer, with a link to the About page', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'JobWahala on Facebook' })).toHaveAttribute('href', FACEBOOK)
    expect(screen.getByRole('link', { name: 'About JobWahala' })).toHaveAttribute('href', '/about')
  })

  it('is on the About page', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Follow JobWahala' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'JobWahala on LinkedIn' })).toHaveAttribute('href', LINKEDIN)
  })
})
