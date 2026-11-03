import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CompanyLogo from './CompanyLogo'

describe('CompanyLogo', () => {
  it('shows the uploaded logo with a descriptive alt text', () => {
    render(<CompanyLogo name="Achiba Star Hotel" logoUrl="/api/uploads/logo/a.png" />)

    expect(screen.getByRole('img', { name: 'Achiba Star Hotel logo' })).toHaveAttribute('src', '/api/uploads/logo/a.png')
  })

  it('falls back to initials when there is no logo', () => {
    render(<CompanyLogo name="Achiba Star Hotel" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('AS')).toBeInTheDocument()
  })

  it('falls back to initials when the image fails to load', () => {
    render(<CompanyLogo name="Kumasi Foods" logoUrl="/api/uploads/logo/missing.png" />)

    fireEvent.error(screen.getByRole('img'))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('KF')).toBeInTheDocument()
  })

  it('tries the new image again when the logo changes after a failure', () => {
    const { rerender } = render(<CompanyLogo name="Kumasi Foods" logoUrl="/bad.png" />)
    fireEvent.error(screen.getByRole('img'))

    rerender(<CompanyLogo name="Kumasi Foods" logoUrl="/good.png" />)

    expect(screen.getByRole('img')).toHaveAttribute('src', '/good.png')
  })
})
