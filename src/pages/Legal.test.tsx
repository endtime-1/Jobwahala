import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Privacy from './Privacy'
import Terms from './Terms'

const renderAt = (path: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )

describe('legal pages linked from signup', () => {
  it('renders the terms of service with a section index', () => {
    renderAt('/terms')

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /freelance gigs, payments and escrow/i })).toHaveAttribute('href', '#section-3')
    expect(screen.getByRole('heading', { level: 2, name: /3\. Freelance gigs, payments and escrow/ })).toBeInTheDocument()
  })

  it('renders the privacy policy', () => {
    renderAt('/privacy')

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /support centre/i })[0]).toHaveAttribute('href', '/support')
  })
})

describe('drafts waiting for legal review', () => {
  it.each(['/privacy', '/terms'])('%s is marked clearly as a draft for legal review', (path) => {
    renderAt(path)

    const notice = screen.getByRole('note', { name: /draft notice/i })
    expect(notice).toHaveTextContent(/draft for legal review/i)
    expect(notice).toHaveTextContent(/not been reviewed by a lawyer/i)
    expect(notice).toHaveTextContent(/not legal advice/i)
    expect(screen.getByText(/\(draft\)/i)).toBeInTheDocument()
  })

  it('leaves the facts that only the company knows as visible placeholders', () => {
    renderAt('/privacy')

    expect(screen.getAllByText(/\[LEGAL NAME OF THE COMPANY\]/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\[PRIVACY EMAIL ADDRESS\]/).length).toBeGreaterThan(0)
  })
})

describe('Ghana Data Protection Act, 2012 (Act 843)', () => {
  it('the privacy policy names the Act, the Commission and the member\'s rights', () => {
    const { container } = renderAt('/privacy')
    const text = container.textContent ?? ''

    expect(text).toMatch(/Data Protection Act, 2012 \(Act 843\)/)
    expect(text).toMatch(/Data Protection Commission/)
    expect(text).toMatch(/data controller/i)
    expect(screen.getByRole('heading', { level: 2, name: /Your rights under Act 843/ })).toBeInTheDocument()
  })

  it('points people to the real download and delete tools', () => {
    renderAt('/privacy')

    const settings = screen.getAllByRole('link', { name: /account settings/i })
    expect(settings.length).toBeGreaterThanOrEqual(2)
    for (const link of settings) expect(link).toHaveAttribute('href', '/settings')
  })

  it('describes what is actually collected and who processes it', () => {
    const { container } = renderAt('/privacy')
    const text = container.textContent ?? ''

    for (const topic of [/phone number/i, /registration number/i, /Arkesel/, /Sentry/, /Turnstile/, /retention|how long we keep/i]) {
      expect(text).toMatch(topic)
    }
  })

  it('the terms refer to the same Act and link the privacy policy and settings', () => {
    const { container } = renderAt('/terms')

    expect(container.textContent).toMatch(/Act 843/)
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Account settings' })).toHaveAttribute('href', '/settings')
  })

  it('the terms no longer present escrow or freelance payouts as live', () => {
    const { container } = renderAt('/terms')

    expect(container.textContent).toMatch(/not available yet/i)
    expect(container.textContent).not.toMatch(/held until the milestone is approved/i)
  })
})
