import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AddPhonePanel from './AddPhonePanel'
import PhoneCodeFlow from './PhoneCodeFlow'
import Login from '../pages/Login'
import Signup from '../pages/Signup'
import { setFeaturesForTests } from '../lib/features'

const loginWithPhoneMock = vi.fn()
const signupWithPhoneMock = vi.fn()
const refreshUserMock = vi.fn()
const authState = vi.hoisted(() => ({ user: null as null | { phone?: string | null } }))
const apiSendPhoneCodeMock = vi.fn()
const apiSendAddPhoneCodeMock = vi.fn()
const apiConfirmAddPhoneMock = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    login: vi.fn(),
    signup: vi.fn(),
    loginWithPhone: (...args: unknown[]) => loginWithPhoneMock(...args),
    signupWithPhone: (...args: unknown[]) => signupWithPhoneMock(...args),
    refreshUser: (...args: unknown[]) => refreshUserMock(...args),
  }),
}))

vi.mock('../lib/api', () => ({
  apiSendPhoneCode: (...args: unknown[]) => apiSendPhoneCodeMock(...args),
  apiSendAddPhoneCode: (...args: unknown[]) => apiSendAddPhoneCodeMock(...args),
  apiConfirmAddPhone: (...args: unknown[]) => apiConfirmAddPhoneMock(...args),
}))

const typePhone = (value = '024 123 4567') => fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value } })
// The code box appears once the text has been sent, so wait for it.
const typeCode = async (value = '482913') => fireEvent.change(await screen.findByLabelText(/6-digit code/i), { target: { value } })

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = null
  apiSendPhoneCodeMock.mockResolvedValue({ success: true })
  apiSendAddPhoneCodeMock.mockResolvedValue({ success: true })
  apiConfirmAddPhoneMock.mockResolvedValue({ success: true })
  loginWithPhoneMock.mockResolvedValue(undefined)
  signupWithPhoneMock.mockResolvedValue(undefined)
  refreshUserMock.mockResolvedValue(undefined)
  setFeaturesForTests({ freelanceEnabled: false })
})

describe('PhoneCodeFlow', () => {
  const onDone = vi.fn()

  it('texts a code to the typed number, then logs in with it', async () => {
    render(<PhoneCodeFlow mode="login" onDone={onDone} />)

    typePhone()
    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))

    await waitFor(() => expect(apiSendPhoneCodeMock).toHaveBeenCalledWith('024 123 4567', 'LOGIN'))
    await typeCode()
    fireEvent.click(await screen.findByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(loginWithPhoneMock).toHaveBeenCalledWith('024 123 4567', '482913'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('signs up with the chosen role', async () => {
    render(<PhoneCodeFlow mode="signup" role="EMPLOYER" onDone={onDone} />)

    typePhone()
    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))
    await waitFor(() => expect(apiSendPhoneCodeMock).toHaveBeenCalledWith('024 123 4567', 'SIGNUP'))
    await typeCode()
    fireEvent.click(await screen.findByRole('button', { name: /create account/i }))

    await waitFor(() => expect(signupWithPhoneMock).toHaveBeenCalledWith('024 123 4567', '482913', 'EMPLOYER'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('only enables the sign-in button with all six digits, and strips anything that is not a digit', async () => {
    render(<PhoneCodeFlow mode="login" onDone={onDone} />)
    typePhone()
    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))

    const input = await screen.findByLabelText(/6-digit code/i)
    fireEvent.change(input, { target: { value: '12ab34' } })
    expect(input).toHaveValue('1234')
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeDisabled()

    fireEvent.change(input, { target: { value: '123456' } })
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled()
  })

  it('shows the server message when the number is refused, and waits as long as it is told to', async () => {
    apiSendPhoneCodeMock.mockRejectedValue(Object.assign(new Error('Please wait 40 seconds before asking for another code.'), { retryAfterSeconds: 40 }))
    render(<PhoneCodeFlow mode="login" onDone={onDone} />)

    typePhone()
    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/wait 40 seconds/i)
    expect(screen.getByRole('button', { name: /wait 40s/i })).toBeDisabled()
  })

  it('shows a wrong-code message and stays on the code step', async () => {
    loginWithPhoneMock.mockRejectedValue(new Error('That code is not right. 4 tries left.'))
    render(<PhoneCodeFlow mode="login" onDone={onDone} />)
    typePhone()
    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))
    await typeCode('000000')
    fireEvent.click(await screen.findByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/4 tries left/)
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument()
  })

  it('lets the person go back and use a different number', async () => {
    render(<PhoneCodeFlow mode="login" onDone={onDone} />)
    typePhone()
    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))

    fireEvent.click(await screen.findByRole('button', { name: /use a different number/i }))

    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument()
  })
})

describe('Login and Signup pages', () => {
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

  it('keeps email and password sign-in as the default', () => {
    renderAt('/login')

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Email' })).toHaveAttribute('aria-selected', 'true')
  })

  it('offers phone sign-in on its own tab', () => {
    renderAt('/login')

    fireEvent.click(screen.getByRole('tab', { name: 'Phone' }))

    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('you@example.com')).not.toBeInTheDocument()
  })

  it('takes someone to their dashboard after a phone log-in', async () => {
    renderAt('/login')
    fireEvent.click(screen.getByRole('tab', { name: 'Phone' }))
    typePhone()
    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))
    await typeCode()
    fireEvent.click(await screen.findByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument()
  })

  it('offers phone sign-up with a choice of account type, and no freelancer option while freelance is off', () => {
    renderAt('/signup')

    fireEvent.click(screen.getByRole('tab', { name: 'Phone' }))

    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /job seeker/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /employer/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /freelancer/i })).not.toBeInTheDocument()
  })

  it('shows the freelancer option once freelance is on', () => {
    setFeaturesForTests({ freelanceEnabled: true })
    renderAt('/signup')

    expect(screen.getByRole('button', { name: /freelancer/i })).toBeInTheDocument()
  })

  it('signs up by phone as an employer', async () => {
    renderAt('/signup')
    fireEvent.click(screen.getByRole('tab', { name: 'Phone' }))
    fireEvent.click(screen.getByRole('button', { name: /employer/i }))
    typePhone()
    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))
    await typeCode()
    fireEvent.click(await screen.findByRole('button', { name: /create account/i }))

    await waitFor(() => expect(signupWithPhoneMock).toHaveBeenCalledWith('024 123 4567', '482913', 'EMPLOYER'))
  })
})

describe('AddPhonePanel', () => {
  it('shows the number, confirmed, when the account already has one', () => {
    authState.user = { phone: '+233241234567' }
    render(<AddPhonePanel />)

    expect(screen.getByText('+233241234567')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.queryByLabelText(/mobile number/i)).not.toBeInTheDocument()
  })

  it('adds a number: text a code, confirm it, then reload the account', async () => {
    render(<AddPhonePanel />)

    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '055 123 4567' } })
    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))
    await waitFor(() => expect(apiSendAddPhoneCodeMock).toHaveBeenCalledWith('055 123 4567'))

    fireEvent.change(await screen.findByLabelText(/6-digit code/i), { target: { value: '482913' } })
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }))

    await waitFor(() => expect(apiConfirmAddPhoneMock).toHaveBeenCalledWith('055 123 4567', '482913'))
    await waitFor(() => expect(refreshUserMock).toHaveBeenCalled())
  })

  it('shows why a number cannot be added', async () => {
    apiSendAddPhoneCodeMock.mockRejectedValue(new Error('This number is already used by another account.'))
    render(<AddPhonePanel />)

    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '055 123 4567' } })
    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/another account/i)
  })
})
