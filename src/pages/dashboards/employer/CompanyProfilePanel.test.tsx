import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CompanyProfilePanel from './CompanyProfilePanel'

const useAuthMock = vi.fn()
const apiUpdateProfileMock = vi.fn()
const uploadLogoFileMock = vi.fn()
const refreshUserMock = vi.fn()

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => useAuthMock() }))
vi.mock('../../../lib/api', () => ({ apiUpdateProfile: (...args: unknown[]) => apiUpdateProfileMock(...args) }))
vi.mock('../../../lib/evidenceUpload', () => ({
  maxLogoFileBytes: 1024 * 1024,
  uploadLogoFile: (...args: unknown[]) => uploadLogoFileMock(...args),
}))

const renderPanel = () =>
  render(
    <MemoryRouter>
      <CompanyProfilePanel />
    </MemoryRouter>,
  )

const openPanel = () => fireEvent.click(screen.getByRole('button', { expanded: false }))

describe('CompanyProfilePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshUserMock.mockResolvedValue(undefined)
    apiUpdateProfileMock.mockResolvedValue({ success: true })
    useAuthMock.mockReturnValue({
      user: {
        id: 'emp-1',
        role: 'EMPLOYER',
        employerProfile: {
          companyName: 'Achiba Star Hotel',
          industry: 'Hospitality',
          website: 'achiba.example.com',
          description: 'A hotel.',
          logoUrl: null,
        },
      },
      refreshUser: refreshUserMock,
    })
  })

  it('stays collapsed at first and nudges the employer to add a logo', () => {
    renderPanel()

    expect(screen.getByText(/add your logo so candidates recognise you/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument()
  })

  it('opens with the current details filled in', () => {
    renderPanel()
    openPanel()

    expect(screen.getByLabelText(/company name/i)).toHaveValue('Achiba Star Hotel')
    expect(screen.getByLabelText(/industry/i)).toHaveValue('Hospitality')
    expect(screen.getByLabelText(/^website/i)).toHaveValue('achiba.example.com')
  })

  it('uploads a logo and previews it before saving', async () => {
    uploadLogoFileMock.mockResolvedValue({ file: { url: '/api/uploads/logo/new.png' } })
    renderPanel()
    openPanel()

    const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/upload company logo/i), { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByRole('img', { name: /achiba star hotel logo/i })).toHaveAttribute('src', '/api/uploads/logo/new.png'),
    )
    expect(uploadLogoFileMock).toHaveBeenCalledWith(file)
    expect(apiUpdateProfileMock).not.toHaveBeenCalled()
  })

  it('shows the reason when a logo is rejected', async () => {
    uploadLogoFileMock.mockRejectedValue(new Error('Logos must be 1 MB or smaller'))
    renderPanel()
    openPanel()

    fireEvent.change(screen.getByLabelText(/upload company logo/i), {
      target: { files: [new File(['x'], 'big.png', { type: 'image/png' })] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Logos must be 1 MB or smaller')
  })

  it('saves everything, refreshes the account and links to the public page', async () => {
    uploadLogoFileMock.mockResolvedValue({ file: { url: '/api/uploads/logo/new.png' } })
    renderPanel()
    openPanel()
    fireEvent.change(screen.getByLabelText(/upload company logo/i), {
      target: { files: [new File(['x'], 'l.png', { type: 'image/png' })] },
    })
    await screen.findByRole('img', { name: /logo/i })
    fireEvent.change(screen.getByLabelText(/industry/i), { target: { value: 'Tourism' } })

    fireEvent.click(screen.getByRole('button', { name: /save company profile/i }))

    await waitFor(() =>
      expect(apiUpdateProfileMock).toHaveBeenCalledWith({
        companyName: 'Achiba Star Hotel',
        industry: 'Tourism',
        website: 'achiba.example.com',
        description: 'A hotel.',
        logoUrl: '/api/uploads/logo/new.png',
      }),
    )
    expect(refreshUserMock).toHaveBeenCalled()
    expect(await screen.findByRole('link', { name: /view your public page/i })).toHaveAttribute('href', '/companies/emp-1')
  })

  it('refuses a blank company name before calling the server', async () => {
    renderPanel()
    openPanel()
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: '   ' } })

    fireEvent.submit(screen.getByRole('button', { name: /save company profile/i }).closest('form') as HTMLFormElement)

    expect(await screen.findByRole('alert')).toHaveTextContent(/add your company name/i)
    expect(apiUpdateProfileMock).not.toHaveBeenCalled()
  })

  it('removing the logo clears it on save', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'emp-1',
        role: 'EMPLOYER',
        employerProfile: { companyName: 'Achiba Star Hotel', logoUrl: '/api/uploads/logo/old.png' },
      },
      refreshUser: refreshUserMock,
    })
    renderPanel()
    openPanel()

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    fireEvent.click(screen.getByRole('button', { name: /save company profile/i }))

    await waitFor(() => expect(apiUpdateProfileMock).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: '' })))
  })
})
