import { fireEvent, render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ signup: vi.fn(), user: null, role: null }) }))
vi.mock('../components/GoogleSignIn', () => ({ default: () => null }))
vi.mock('../components/TurnstileWidget', () => ({ default: () => null }))
vi.mock('../components/PhoneCodeFlow', () => ({ default: () => <p>Phone sign-up</p> }))

import Signup from './Signup'

const open = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    </HelmetProvider>,
  )

describe('sign-up', () => {
  const expectAgreement = () => {
    expect(screen.getByText(/By signing up you agree to our/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
  }

  it('says that signing up means agreeing to the Terms and the Privacy Policy, with links to both', () => {
    open()
    expectAgreement()
  })

  it('says it for phone sign-up too, and only once', () => {
    open()
    fireEvent.click(screen.getByRole('tab', { name: /phone/i }))

    expect(screen.getByText('Phone sign-up')).toBeInTheDocument()
    expectAgreement()
    expect(screen.getAllByText(/By signing up you agree to our/)).toHaveLength(1)
  })
})
