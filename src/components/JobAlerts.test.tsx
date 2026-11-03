import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobAlerts from './JobAlerts'

const apiGetSavedSearchesMock = vi.fn()
const apiCreateSavedSearchMock = vi.fn()
const apiUpdateSavedSearchMock = vi.fn()
const apiDeleteSavedSearchMock = vi.fn()

vi.mock('../lib/api', () => ({
  apiGetSavedSearches: (...args: unknown[]) => apiGetSavedSearchesMock(...args),
  apiCreateSavedSearch: (...args: unknown[]) => apiCreateSavedSearchMock(...args),
  apiUpdateSavedSearch: (...args: unknown[]) => apiUpdateSavedSearchMock(...args),
  apiDeleteSavedSearch: (...args: unknown[]) => apiDeleteSavedSearchMock(...args),
}))

const existing = { id: 'a1', query: 'excel', location: null, jobType: 'Full-time', emailAlerts: true, createdAt: '2026-03-01T00:00:00Z' }

const renderAlerts = (props: Partial<React.ComponentProps<typeof JobAlerts>> = {}) =>
  render(
    <MemoryRouter>
      <JobAlerts criteria={{ query: 'receptionist' }} isSignedIn isSeeker {...props} />
    </MemoryRouter>,
  )

describe('JobAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGetSavedSearchesMock.mockResolvedValue({ savedSearches: [existing], limit: 10 })
    apiCreateSavedSearchMock.mockResolvedValue({ savedSearch: { id: 'new' } })
    apiUpdateSavedSearchMock.mockResolvedValue({ success: true })
    apiDeleteSavedSearchMock.mockResolvedValue({ success: true })
  })

  it('invites signed-out visitors to log in and loads nothing', () => {
    renderAlerts({ isSignedIn: false, isSeeker: false })

    expect(screen.getByRole('link', { name: /log in to set alerts/i })).toHaveAttribute('href', '/login')
    expect(apiGetSavedSearchesMock).not.toHaveBeenCalled()
  })

  it('shows nothing for employers and freelancers', () => {
    const { container } = renderAlerts({ isSeeker: false })

    expect(container).toBeEmptyDOMElement()
    expect(apiGetSavedSearchesMock).not.toHaveBeenCalled()
  })

  it('lists existing alerts and says what the current search would alert on', async () => {
    renderAlerts()

    expect(await screen.findByText('excel · Full-time')).toBeInTheDocument()
    expect(screen.getByText(/alert me about: receptionist/i)).toBeInTheDocument()
  })

  it('keeps the save button off until there is something to alert on', async () => {
    renderAlerts({ criteria: {} })

    expect(await screen.findByText('excel · Full-time')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /alert me/i })).toBeDisabled()
    expect(screen.getByText(/type a keyword or pick a job type/i)).toBeInTheDocument()
  })

  it('saves the current search and refreshes the list', async () => {
    renderAlerts()
    await screen.findByText('excel · Full-time')

    fireEvent.click(screen.getByRole('button', { name: /alert me/i }))

    await waitFor(() => expect(apiCreateSavedSearchMock).toHaveBeenCalledWith({ query: 'receptionist' }))
    expect(await screen.findByText(/alert saved/i)).toBeInTheDocument()
    expect(apiGetSavedSearchesMock).toHaveBeenCalledTimes(2)
  })

  it('shows the server message when a duplicate is rejected', async () => {
    apiCreateSavedSearchMock.mockRejectedValue(new Error('You already have an alert for this search.'))
    renderAlerts()
    await screen.findByText('excel · Full-time')

    fireEvent.click(screen.getByRole('button', { name: /alert me/i }))

    expect(await screen.findByText(/already have an alert/i)).toBeInTheDocument()
  })

  it('toggles email alerts optimistically', async () => {
    renderAlerts()
    const toggle = await screen.findByRole('button', { name: /email on/i })

    fireEvent.click(toggle)

    expect(await screen.findByRole('button', { name: /email off/i })).toBeInTheDocument()
    expect(apiUpdateSavedSearchMock).toHaveBeenCalledWith('a1', { emailAlerts: false })
  })

  it('deletes an alert', async () => {
    renderAlerts()

    fireEvent.click(await screen.findByRole('button', { name: /delete alert excel/i }))

    await waitFor(() => expect(screen.queryByText('excel · Full-time')).not.toBeInTheDocument())
    expect(apiDeleteSavedSearchMock).toHaveBeenCalledWith('a1')
  })

  it('stops at the alert limit', async () => {
    apiGetSavedSearchesMock.mockResolvedValue({ savedSearches: [existing], limit: 1 })
    renderAlerts()

    expect(await screen.findByText(/the maximum/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /alert me/i })).toBeDisabled()
  })
})
