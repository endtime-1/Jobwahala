import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GoogleSignIn from './GoogleSignIn'

const continueWithGoogleMock = vi.fn()
const initializeMock = vi.fn()
const renderButtonMock = vi.fn()
const clientId = vi.hoisted(() => ({ value: 'client-123.apps.googleusercontent.com' }))

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ continueWithGoogle: continueWithGoogleMock }) }))
vi.mock('../lib/google', () => ({
  getGoogleClientId: () => clientId.value,
  loadGoogleIdentity: () => Promise.resolve({ initialize: initializeMock, renderButton: renderButtonMock }),
}))

const onDone = vi.fn()

/** What Google does when the person picks an account. */
const googleReturns = async (credential = 'google-id-token') => {
  await waitFor(() => expect(initializeMock).toHaveBeenCalled())
  await act(async () => {
    initializeMock.mock.calls[0][0].callback({ credential })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  clientId.value = 'client-123.apps.googleusercontent.com'
  continueWithGoogleMock.mockResolvedValue({ isNew: false })
})

describe('Continue with Google', () => {
  it('shows nothing, and loads nothing, when the site has no Google client id', () => {
    clientId.value = ''

    const { container } = render(<GoogleSignIn onDone={onDone} />)

    expect(container).toBeEmptyDOMElement()
    expect(initializeMock).not.toHaveBeenCalled()
  })

  it('sets up Google\'s button with our client id', async () => {
    render(<GoogleSignIn onDone={onDone} />)

    await waitFor(() => expect(renderButtonMock).toHaveBeenCalled())
    expect(initializeMock.mock.calls[0][0].client_id).toBe('client-123.apps.googleusercontent.com')
    expect(renderButtonMock.mock.calls[0][1]).toMatchObject({ text: 'continue_with' })
  })

  it('signs in someone who already has an account and goes to the dashboard', async () => {
    render(<GoogleSignIn onDone={onDone} />)

    await googleReturns('token-1')

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(false))
    expect(continueWithGoogleMock).toHaveBeenCalledWith('token-1', undefined)
  })

  it('asks a new person what brings them, then creates the account with their answer', async () => {
    continueWithGoogleMock.mockRejectedValueOnce(Object.assign(new Error('No account yet'), { code: 'ROLE_REQUIRED' })).mockResolvedValueOnce({ isNew: true })
    render(<GoogleSignIn onDone={onDone} />)

    await googleReturns('token-2')
    expect(await screen.findByText(/what brings you to jobwahala/i)).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /i am hiring/i }))

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true))
    expect(continueWithGoogleMock).toHaveBeenLastCalledWith('token-2', 'EMPLOYER')
  })

  it('a new job seeker can say so', async () => {
    continueWithGoogleMock.mockRejectedValueOnce(Object.assign(new Error('No account yet'), { code: 'ROLE_REQUIRED' })).mockResolvedValueOnce({ isNew: true })
    render(<GoogleSignIn onDone={onDone} />)

    await googleReturns()
    fireEvent.click(await screen.findByRole('button', { name: /looking for a job/i }))

    await waitFor(() => expect(continueWithGoogleMock).toHaveBeenLastCalledWith('google-id-token', 'SEEKER'))
  })

  it('shows the reason when Google sign-in is refused, and stays out of the way', async () => {
    continueWithGoogleMock.mockRejectedValue(new Error('Your Google email address is not verified'))
    render(<GoogleSignIn onDone={onDone} />)

    await googleReturns()

    expect(await screen.findByRole('alert')).toHaveTextContent(/not verified/i)
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.queryByText(/what brings you/i)).not.toBeInTheDocument()
  })
})
