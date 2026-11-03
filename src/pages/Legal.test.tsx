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
    expect(screen.getByRole('link', { name: /payments and escrow/i })).toHaveAttribute('href', '#section-3')
    expect(screen.getByRole('heading', { level: 2, name: /3\. Payments and escrow/ })).toBeInTheDocument()
  })

  it('renders the privacy policy', () => {
    renderAt('/privacy')

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /support centre/i })).toHaveAttribute('href', '/support')
  })
})
