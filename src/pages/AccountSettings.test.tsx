import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccountSettings from './AccountSettings'
import AccountDeleted from './AccountDeleted'

const logoutMock = vi.fn()
const apiDownloadMock = vi.fn()
const apiPreviewMock = vi.fn()
const apiSendCodeMock = vi.fn()
const apiDeleteMock = vi.fn()
const authState = vi.hoisted(() => ({ user: { id: 'u1', email: 'ama@example.com', phone: null as string | null, role: 'SEEKER' } }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: authState.user, logout: logoutMock, refreshUser: vi.fn() }),
}))

vi.mock('../lib/api', () => ({
  apiDownloadMyData: (...args: unknown[]) => apiDownloadMock(...args),
  apiGetDeletionPreview: (...args: unknown[]) => apiPreviewMock(...args),
  apiSendDeletionCode: (...args: unknown[]) => apiSendCodeMock(...args),
  apiDeleteMyAccount: (...args: unknown[]) => apiDeleteMock(...args),
  apiSendAddPhoneCode: vi.fn(),
  apiConfirmAddPhone: vi.fn(),
}))

const preview = (overrides: Record<string, unknown> = {}) => ({
  preview: {
    role: 'SEEKER',
    confirmWith: 'PASSWORD',
    hasPhone: false,
    applicationsMade: 3,
    openJobs: 0,
    applicantsOnOpenJobs: 0,
    blockers: [],
    ...overrides,
  },
})

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<AccountSettings />} />
          <Route path="/account-deleted" element={<AccountDeleted />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )

const openDeleteForm = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^delete my account$/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { id: 'u1', email: 'ama@example.com', phone: null, role: 'SEEKER' }
  apiPreviewMock.mockResolvedValue(preview())
  apiDeleteMock.mockResolvedValue({ success: true })
  apiSendCodeMock.mockResolvedValue({ success: true })
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
})

describe('Account settings: sign-in details', () => {
  it('shows the email and phone on the account', () => {
    authState.user = { id: 'u1', email: 'ama@example.com', phone: '+233241234567', role: 'SEEKER' }
    renderPage()

    expect(screen.getByText('ama@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('+233241234567').length).toBeGreaterThan(0)
  })
})

describe('Account settings: download my data', () => {
  it('downloads the file the server sends, under its own name', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    apiDownloadMock.mockResolvedValue({ blob: new Blob(['{}'], { type: 'application/json' }), filename: 'jobwahala-my-data-2026-11-05.json' })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /download my data/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/downloaded/i)
    expect(click).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    click.mockRestore()
  })

  it('says so when the file cannot be prepared', async () => {
    apiDownloadMock.mockRejectedValue(new Error('Too many requests'))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /download my data/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i)
  })

  it('tells people what is in the file and what is not', () => {
    renderPage()

    expect(screen.getByText(/does not include other people/i)).toBeInTheDocument()
  })
})

describe('Account settings: delete my account', () => {
  it('is hidden behind a button, with the consequences explained first', async () => {
    renderPage()

    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/type delete to confirm/i)).not.toBeInTheDocument()
    await openDeleteForm()
    expect(screen.getByLabelText(/type delete to confirm/i)).toBeInTheDocument()
  })

  it('keeps the final button off until DELETE is typed and the password entered', async () => {
    renderPage()
    await openDeleteForm()
    const final = screen.getByRole('button', { name: /permanently delete my account/i })
    expect(final).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: 'Correct-Horse-9' } })
    expect(final).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'delete' } })
    expect(final).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } })
    expect(final).toBeEnabled()
  })

  it('deletes, signs out and shows the goodbye page', async () => {
    renderPage()
    await openDeleteForm()
    fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: 'Correct-Horse-9' } })
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } })

    fireEvent.click(screen.getByRole('button', { name: /permanently delete my account/i }))

    await waitFor(() => expect(apiDeleteMock).toHaveBeenCalledWith({ confirm: 'DELETE', password: 'Correct-Horse-9' }))
    await waitFor(() => expect(logoutMock).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: /your account has been deleted/i })).toBeInTheDocument()
  })

  it('shows the server\'s message, and stays signed in, when it is refused', async () => {
    apiDeleteMock.mockRejectedValue(new Error('That password is not right.'))
    renderPage()
    await openDeleteForm()
    fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: 'wrong' } })
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } })

    fireEvent.click(screen.getByRole('button', { name: /permanently delete my account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/password is not right/i)
    expect(logoutMock).not.toHaveBeenCalled()
  })

  it('lists what is in the way and will not open the form', async () => {
    apiPreviewMock.mockResolvedValue(preview({ blockers: ['You have active work agreements. Finish or cancel them first.'] }))
    renderPage()

    expect(await screen.findByText(/active work agreements/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete my account$/i })).toBeDisabled()
  })

  it('makes an employer confirm that their jobs will close and the company page will go', async () => {
    apiPreviewMock.mockResolvedValue(preview({ role: 'EMPLOYER', openJobs: 2, applicantsOnOpenJobs: 7 }))
    renderPage()
    await openDeleteForm()
    fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: 'Correct-Horse-9' } })
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } })
    const final = screen.getByRole('button', { name: /permanently delete my account/i })

    expect(screen.getByText(/2 open jobs will be closed/i)).toBeInTheDocument()
    expect(screen.getByText(/7 people waiting on them/i)).toBeInTheDocument()
    expect(final).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(final).toBeEnabled()
    fireEvent.click(final)

    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith({ confirm: 'DELETE', password: 'Correct-Horse-9', acknowledgeCompany: true }),
    )
  })

  it('uses a texted code instead of a password for a phone-only account', async () => {
    authState.user = { id: 'u1', email: null as unknown as string, phone: '+233241234567', role: 'SEEKER' }
    apiPreviewMock.mockResolvedValue(preview({ confirmWith: 'SMS_CODE', hasPhone: true }))
    renderPage()
    await openDeleteForm()

    expect(screen.queryByLabelText(/your password/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } })
    const final = screen.getByRole('button', { name: /permanently delete my account/i })
    expect(final).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /text me a code/i }))
    await waitFor(() => expect(apiSendCodeMock).toHaveBeenCalled())
    fireEvent.change(await screen.findByLabelText(/6-digit code/i), { target: { value: '482913' } })
    expect(final).toBeEnabled()
    fireEvent.click(final)

    await waitFor(() => expect(apiDeleteMock).toHaveBeenCalledWith({ confirm: 'DELETE', code: '482913' }))
  })

  it('Keep my account closes the form without deleting anything', async () => {
    renderPage()
    await openDeleteForm()

    fireEvent.click(screen.getByRole('button', { name: /keep my account/i }))

    expect(screen.queryByLabelText(/type delete to confirm/i)).not.toBeInTheDocument()
    expect(apiDeleteMock).not.toHaveBeenCalled()
  })
})
