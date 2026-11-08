import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Footer from '../components/Footer'
import Privacy from './Privacy'
import Terms from './Terms'

const page = (ui: React.ReactElement) =>
  render(
    <HelmetProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </HelmetProvider>,
  )

describe('the legal pages cover the Hiring Service', () => {
  it('the Terms say what is guaranteed, and what is not', () => {
    const { container } = page(<Terms />)
    const text = container.textContent ?? ''

    expect(screen.getByRole('heading', { level: 2, name: /The Hiring Service/ })).toBeInTheDocument()
    expect(text).toMatch(/Candidates agree first/)
    expect(text).toMatch(/We do not give you their profile, CV or\s+contact details until they say yes/)
    expect(text).toMatch(/Work starts only once the fee is agreed/)
    expect(text).toMatch(/Only you and our team see the shortlist/)
    expect(text).toMatch(/You can cancel a request before work starts/)
    expect(text).toMatch(/search again at no extra charge/)
    expect(text).toMatch(/counted from the day your hire starts/)
    expect(text).toMatch(/No guarantee of a hire/)
    expect(text).toMatch(/We are not the employer/)
    expect(screen.getByRole('link', { name: 'Hiring Service page' })).toHaveAttribute('href', '/hiring-service')
  })

  it('the Privacy Policy explains consent, what the company sees, who at JobWahala can see it, and the audit trail', () => {
    const { container } = page(<Privacy />)
    const text = container.textContent ?? ''

    expect(screen.getByRole('heading', { level: 2, name: /The Hiring Service: recruiters and candidates/ })).toBeInTheDocument()
    expect(text).toMatch(/We do not share your profile, CV or contact details with the hiring company until you agree/)
    expect(text).toMatch(/record when you agreed and the wording you agreed to/)
    expect(text).toMatch(/private notes about you are not shared/)
    expect(text).toMatch(/Recruiters cannot open searches that are not\s+assigned to them/)
    expect(text).toMatch(/recorded in our audit log/)
    expect(text).toMatch(/Companies you blocked/)
  })

  it('the footer links to the Hiring Service', () => {
    page(<Footer />)
    expect(screen.getByRole('link', { name: /Hiring Service: we recruit for you/ })).toHaveAttribute('href', '/hiring-service')
  })
})
