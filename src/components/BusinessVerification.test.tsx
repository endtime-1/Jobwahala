import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BusinessVerificationForm from './BusinessVerificationForm'
import ContactCodeStep from './ContactCodeStep'
import VerificationPanel from './VerificationPanel'

const apiRequestCodeMock = vi.fn()
const apiConfirmCodeMock = vi.fn()

vi.mock('../lib/api', () => ({
  apiRequestVerificationCode: (...args: unknown[]) => apiRequestCodeMock(...args),
  apiConfirmVerificationCode: (...args: unknown[]) => apiConfirmCodeMock(...args),
}))

// The upload widget talks to the API; a plain input stands in for it here.
vi.mock('./EvidenceUploadField', () => ({
  default: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  ),
}))
vi.mock('./EvidenceLink', () => ({ default: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }))

const fillForm = (overrides: Record<string, string> = {}) => {
  const values: Record<string, string> = {
    'Registrar-General registration number': 'CS123456789',
    'Registration certificate': 'https://x/cert.pdf',
    'Company email': 'hr@achiba.example',
    'Physical address': '12 Ring Road, Accra',
    ...overrides,
  }
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

describe('BusinessVerificationForm', () => {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    onSubmit.mockResolvedValue(undefined)
  })

  it('asks for the registration number, certificate, company email and address', () => {
    render(<BusinessVerificationForm isSubmitting={false} onCancel={onCancel} onSubmit={onSubmit} />)

    for (const label of ['Registrar-General registration number', 'Registration certificate', 'Company email', 'Physical address']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByText(/we can text the code to it/i)).toBeInTheDocument()
  })

  it('will not send without the certificate', () => {
    render(<BusinessVerificationForm isSubmitting={false} onCancel={onCancel} onSubmit={onSubmit} />)
    fillForm({ 'Registration certificate': '' })

    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/upload your business registration certificate/i)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('sends everything the admin team needs', async () => {
    render(<BusinessVerificationForm isSubmitting={false} onCancel={onCancel} onSubmit={onSubmit} />)
    fillForm()
    fireEvent.change(screen.getByLabelText(/company phone/i), { target: { value: '024 123 4567' } })

    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        registrationNumber: 'CS123456789',
        documentUrl: 'https://x/cert.pdf',
        contactEmail: 'hr@achiba.example',
        contactPhone: '024 123 4567',
        address: '12 Ring Road, Accra',
        details: '',
      }),
    )
  })

  it('accepts a phone number instead of an email', async () => {
    render(<BusinessVerificationForm isSubmitting={false} onCancel={onCancel} onSubmit={onSubmit} />)
    fillForm({ 'Company email': '' })
    fireEvent.change(screen.getByLabelText(/company phone/i), { target: { value: '024 123 4567' } })

    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ contactEmail: '', contactPhone: '024 123 4567' })))
  })

  it('needs at least an email or a phone', () => {
    render(<BusinessVerificationForm isSubmitting={false} onCancel={onCancel} onSubmit={onSubmit} />)
    fillForm({ 'Company email': '' })

    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/company email or a company phone/i)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('fills in what was sent last time when the employer is asked for more', () => {
    render(
      <BusinessVerificationForm
        initial={{ registrationNumber: 'CS999', contactEmail: 'old@achiba.example' }}
        isSubmitting={false}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByLabelText('Registrar-General registration number')).toHaveValue('CS999')
    expect(screen.getByLabelText('Company email')).toHaveValue('old@achiba.example')
  })
})

describe('ContactCodeStep', () => {
  const onConfirmed = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    apiConfirmCodeMock.mockResolvedValue({ success: true })
    apiRequestCodeMock.mockResolvedValue({ success: true })
  })

  const renderStep = (props: { email?: string | null; phone?: string | null } = { email: 'hr@achiba.example' }) =>
    render(<ContactCodeStep requestId="ver-1" onConfirmed={onConfirmed} {...props} />)

  it('says where the code was sent and only allows six digits', () => {
    renderStep()

    expect(screen.getByText('hr@achiba.example')).toBeInTheDocument()
    const input = screen.getByLabelText('6-digit code')
    fireEvent.change(input, { target: { value: '12ab34567' } })
    expect(input).toHaveValue('123456')
  })

  it('keeps Confirm off until all six digits are in, then confirms', async () => {
    renderStep()
    const confirm = screen.getByRole('button', { name: /^confirm$/i })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '482913' } })
    fireEvent.click(confirm)

    await waitFor(() => expect(apiConfirmCodeMock).toHaveBeenCalledWith('ver-1', '482913'))
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled())
  })

  it('shows the server message for a wrong code', async () => {
    apiConfirmCodeMock.mockRejectedValue(new Error('That code is not right. 4 tries left.'))
    renderStep()

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/4 tries left/)
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('sends a new code on request, and shows a wait message if asked too soon', async () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: /email me a new code/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/new code is on its way to hr@achiba.example/i)
    expect(apiRequestCodeMock).toHaveBeenCalledWith('ver-1', 'EMAIL')

    apiRequestCodeMock.mockRejectedValue(new Error('Please wait 40 seconds before asking for another code.'))
    fireEvent.click(screen.getByRole('button', { name: /email me a new code/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/wait 40 seconds/i)
  })

  it('offers a text message when the company gave a phone, and asks for it by SMS', async () => {
    renderStep({ email: 'hr@achiba.example', phone: '+233241234567' })

    expect(screen.getByRole('button', { name: /email me a new code/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /text me a new code/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/by text to \+233241234567/i)
    expect(apiRequestCodeMock).toHaveBeenCalledWith('ver-1', 'PHONE')
  })

  it('works for a company that only gave a phone number', () => {
    renderStep({ email: null, phone: '+233241234567' })

    expect(screen.getByText('+233241234567')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /email me a new code/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /text me a new code/i })).toBeInTheDocument()
  })
})

describe('VerificationPanel for employers', () => {
  const onSubmit = vi.fn()

  const renderPanel = (verification: Record<string, unknown> | null) =>
    render(
      <MemoryRouter>
        <VerificationPanel type="employer" verification={verification} isSubmitting={false} onSubmit={onSubmit} />
      </MemoryRouter>,
    )

  beforeEach(() => vi.clearAllMocks())

  it('opens the business form, not the free-text form', () => {
    renderPanel({ verificationStatus: 'UNVERIFIED', isVerified: false, latestVerificationRequest: null })

    fireEvent.click(screen.getByRole('button', { name: /request business verification/i }))

    expect(screen.getByLabelText('Registrar-General registration number')).toBeInTheDocument()
    expect(screen.queryByText('Verification Details')).not.toBeInTheDocument()
  })

  it('passes the business details up when submitted', async () => {
    onSubmit.mockResolvedValue(undefined)
    renderPanel({ verificationStatus: 'UNVERIFIED', isVerified: false, latestVerificationRequest: null })
    fireEvent.click(screen.getByRole('button', { name: /request business verification/i }))
    fillForm()

    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationNumber: 'CS123456789',
          contactEmail: 'hr@achiba.example',
          address: '12 Ring Road, Accra',
          documentUrl: 'https://x/cert.pdf',
        }),
      ),
    )
  })

  it('asks for the emailed code while the contact is not confirmed', () => {
    renderPanel({
      verificationStatus: 'PENDING',
      latestVerificationRequest: { id: 'ver-1', status: 'PENDING', contactEmail: 'hr@achiba.example', contactVerifiedAt: null },
    })

    expect(screen.getByText(/confirm your company contact/i)).toBeInTheDocument()
    expect(screen.getByLabelText('6-digit code')).toBeInTheDocument()
  })

  it('asks for the texted code on a request that only has a phone', () => {
    renderPanel({
      verificationStatus: 'PENDING',
      latestVerificationRequest: { id: 'ver-1', status: 'PENDING', contactEmail: null, contactPhone: '+233241234567', contactVerifiedAt: null },
    })

    expect(screen.getByText(/confirm your company contact/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /text me a new code/i })).toBeInTheDocument()
  })

  it('says the email is confirmed once it is', () => {
    renderPanel({
      verificationStatus: 'PENDING',
      latestVerificationRequest: { id: 'ver-1', status: 'PENDING', contactEmail: 'hr@achiba.example', contactVerifiedAt: '2026-03-21T00:00:00Z' },
    })

    expect(screen.getByText(/company contact confirmed: hr@achiba.example/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('6-digit code')).not.toBeInTheDocument()
  })

  it('shows the admin\'s reason when more information is needed', () => {
    renderPanel({
      verificationStatus: 'NEEDS_INFO',
      latestVerificationRequest: { id: 'ver-1', status: 'NEEDS_INFO', reviewNote: 'Please upload a clearer scan' },
    })

    expect(screen.getByText('Please upload a clearer scan')).toBeInTheDocument()
  })
})
