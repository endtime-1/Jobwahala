import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import HeroSearch from './HeroSearch'

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

const renderSearch = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HeroSearch />} />
        <Route path="/jobs" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

describe('HeroSearch', () => {
  it('takes the visitor to the jobs page with their keyword and town', () => {
    renderSearch()

    fireEvent.change(screen.getByLabelText(/job title or keyword/i), { target: { value: 'accountant' } })
    fireEvent.change(screen.getByLabelText(/town or city/i), { target: { value: 'Kumasi' } })
    fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))

    expect(screen.getByTestId('where')).toHaveTextContent('/jobs?search=accountant&location=Kumasi')
  })

  it('still works with nothing typed', () => {
    renderSearch()

    fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))

    expect(screen.getByTestId('where')).toHaveTextContent(/^\/jobs$/)
  })

  it('submits with the Enter key', () => {
    renderSearch()

    const keyword = screen.getByLabelText(/job title or keyword/i)
    fireEvent.change(keyword, { target: { value: 'cook' } })
    fireEvent.submit(keyword.closest('form') as HTMLFormElement)

    expect(screen.getByTestId('where')).toHaveTextContent('/jobs?search=cook')
  })
})
