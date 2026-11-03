import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CompanyProfile from './CompanyProfile'

const apiGetCompanyMock = vi.fn()

vi.mock('../lib/api', () => ({
  apiGetCompany: (...args: unknown[]) => apiGetCompanyMock(...args),
}))

const company = {
  id: 'emp-1',
  companyName: 'Achiba Star Hotel',
  industry: 'Hospitality',
  logoUrl: '/api/uploads/logo/a.png',
  website: 'https://achiba.example.com',
  description: 'A hotel in Sokoban.',
  isVerified: true,
  memberSince: '2026-03-01T00:00:00.000Z',
  jobs: [
    { id: 'job-1', title: 'Hotel Receptionist', location: 'Sokoban', type: 'Full-time', createdAt: new Date().toISOString() },
    { id: 'job-2', title: 'Housekeeping Attendant', location: 'Kumasi', type: 'Part-time', createdAt: new Date().toISOString() },
  ],
}

const renderPage = (id = 'emp-1') =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/companies/${id}`]}>
        <Routes>
          <Route path="/companies/:id" element={<CompanyProfile />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )

describe('CompanyProfile page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGetCompanyMock.mockResolvedValue({ company })
  })

  it('shows the company, its verified badge and its open roles', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Achiba Star Hotel' })).toBeInTheDocument()
    expect(screen.getByText('Verified business')).toBeInTheDocument()
    expect(screen.getByText('A hotel in Sokoban.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Achiba Star Hotel logo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /hotel receptionist/i })).toHaveAttribute('href', '/jobs/job-1')
    expect(screen.getByRole('heading', { name: /open roles/i })).toHaveTextContent('(2)')
    expect(apiGetCompanyMock).toHaveBeenCalledWith('emp-1')
  })

  it('opens the company website safely in a new tab', async () => {
    renderPage()

    const website = await screen.findByRole('link', { name: /website/i })
    expect(website).toHaveAttribute('href', 'https://achiba.example.com')
    expect(website).toHaveAttribute('target', '_blank')
    expect(website.getAttribute('rel')).toContain('noopener')
    expect(website.getAttribute('rel')).toContain('nofollow')
  })

  it('does not claim verification when the business is not verified', async () => {
    apiGetCompanyMock.mockResolvedValue({ company: { ...company, isVerified: false } })
    renderPage()

    await screen.findByRole('heading', { level: 1, name: 'Achiba Star Hotel' })
    expect(screen.queryByText('Verified business')).not.toBeInTheDocument()
  })

  it('says so when there are no open roles or no description', async () => {
    apiGetCompanyMock.mockResolvedValue({ company: { ...company, jobs: [], description: null } })
    renderPage()

    expect(await screen.findByText(/has no open roles right now/i)).toBeInTheDocument()
    expect(screen.getByText(/has not added a company description yet/i)).toBeInTheDocument()
  })

  it('shows a friendly page for a company that does not exist', async () => {
    apiGetCompanyMock.mockRejectedValue(new Error('Company not found'))
    renderPage('nope')

    expect(await screen.findByRole('heading', { name: /could not find that company/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse open jobs/i })).toHaveAttribute('href', '/jobs')
  })
})
