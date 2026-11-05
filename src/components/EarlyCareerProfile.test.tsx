import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EarlyCareerProfile from './EarlyCareerProfile'

const apiUpdateProfileMock = vi.fn()
const refreshUserMock = vi.fn()
const auth = vi.hoisted(() => ({ value: { user: { jobSeekerProfile: {} } as Record<string, unknown> } }))

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ ...auth.value, refreshUser: refreshUserMock }) }))
vi.mock('../lib/api', () => ({ apiUpdateProfile: (...args: unknown[]) => apiUpdateProfileMock(...args) }))

const renderPanel = () =>
  render(
    <MemoryRouter>
      <EarlyCareerProfile />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  auth.value = { user: { jobSeekerProfile: {} } }
  apiUpdateProfileMock.mockResolvedValue({ success: true })
  refreshUserMock.mockResolvedValue(undefined)
})

describe('student, NSS or graduate', () => {
  it('offers the three choices, and asks for more only once one is chosen', () => {
    renderPanel()
    const options = Array.from((screen.getByLabelText(/^i am/i) as HTMLSelectElement).options).map((option) => option.textContent)
    expect(options).toEqual(['Not saying', 'Student', 'National Service personnel', 'Graduate'])
    expect(screen.queryByLabelText(/programme/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^i am/i), { target: { value: 'STUDENT' } })

    expect(screen.getByLabelText(/institution/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/programme/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/expected completion year/i)).toBeInTheDocument()
  })

  it('saves the stage, institution, programme and completion year', async () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText(/^i am/i), { target: { value: 'STUDENT' } })
    fireEvent.change(screen.getByLabelText(/institution/i), { target: { value: 'University of Ghana' } })
    fireEvent.change(screen.getByLabelText(/programme/i), { target: { value: 'BSc Computer Science' } })
    fireEvent.change(screen.getByLabelText(/expected completion year/i), { target: { value: '2027' } })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(apiUpdateProfileMock).toHaveBeenCalledWith({
        careerStage: 'STUDENT',
        institution: 'University of Ghana',
        programme: 'BSc Computer Science',
        completionYear: 2027,
      }),
    )
    expect(refreshUserMock).toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Saved')
  })

  it('starts from what is already saved, and can be cleared', async () => {
    auth.value = { user: { jobSeekerProfile: { careerStage: 'GRADUATE', institution: 'KNUST', programme: 'Law', completionYear: 2024 } } }
    renderPanel()

    expect(screen.getByLabelText(/^i am/i)).toHaveValue('GRADUATE')
    expect(screen.getByLabelText(/year completed/i)).toHaveValue(2024)

    fireEvent.change(screen.getByLabelText(/^i am/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(apiUpdateProfileMock).toHaveBeenCalledWith(expect.objectContaining({ careerStage: '' })))
  })

  it('says so when saving fails', async () => {
    apiUpdateProfileMock.mockRejectedValue(new Error('Network down'))
    renderPanel()
    fireEvent.change(screen.getByLabelText(/^i am/i), { target: { value: 'NSS' } })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/network down/i)
  })
})
