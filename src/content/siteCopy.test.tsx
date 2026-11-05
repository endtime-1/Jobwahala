import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Hero from '../components/landing/Hero'
import { siteCopy } from './siteCopy'

describe('home page words', () => {
  it('the hero shows the shared copy, with no escrow or payout promise', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    )

    expect(screen.getByText(siteCopy.heroText)).toBeInTheDocument()
    expect(screen.queryByText(/escrow|mobile money/i)).not.toBeInTheDocument()
  })
})
