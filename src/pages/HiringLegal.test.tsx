import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Footer from '../components/Footer'

describe('the footer', () => {
  it('links to the Hiring Service, the Terms of Service and the Privacy Policy', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      </HelmetProvider>,
    )
    expect(screen.getByRole('link', { name: /Hiring Service: we recruit for you/ })).toHaveAttribute('href', '/hiring-service')
    for (const link of screen.getAllByRole('link', { name: /Terms/ })) expect(link).toHaveAttribute('href', '/terms')
    for (const link of screen.getAllByRole('link', { name: /Privacy/ })) expect(link).toHaveAttribute('href', '/privacy')
    expect(screen.getAllByRole('link', { name: /Terms/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Privacy/ }).length).toBeGreaterThan(0)
  })
})
