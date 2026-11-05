import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ScrollToTop from './ScrollToTop'

const scrollTo = vi.fn()

const renderApp = () =>
  render(
    <MemoryRouter initialEntries={['/a']}>
      <ScrollToTop />
      <Link to="/b">to b</Link>
      <Link to="/b#section">to b section</Link>
      <Link to="/a?filter=1">filter</Link>
      <Routes>
        <Route path="*" element={<p>page</p>} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  scrollTo.mockClear()
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo
})

describe('opening a page', () => {
  it('starts at the top when a link goes to another page', () => {
    renderApp()
    scrollTo.mockClear()

    fireEvent.click(screen.getByText('to b'))

    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('leaves a link to part of a page for that page to handle', () => {
    renderApp()
    scrollTo.mockClear()

    fireEvent.click(screen.getByText('to b section'))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('does not jump when only the search filters change', () => {
    renderApp()
    scrollTo.mockClear()

    fireEvent.click(screen.getByText('filter'))

    expect(scrollTo).not.toHaveBeenCalled()
  })
})
