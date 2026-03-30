import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EvidenceUploadField from './EvidenceUploadField'

const uploadEvidenceFileMock = vi.fn()

vi.mock('../lib/evidenceUpload', () => ({
  evidenceUploadConstraints: {
    maxEvidenceFileBytes: 5 * 1024 * 1024,
    supportedContentTypes: [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
    ],
  },
  uploadEvidenceFile: (...args: unknown[]) => uploadEvidenceFileMock(...args),
}))

describe('EvidenceUploadField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps manual URL entry working', () => {
    const onChange = vi.fn()

    render(
      <EvidenceUploadField
        category="verification"
        label="Evidence Link"
        value=""
        onChange={onChange}
        placeholder="https://..."
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('https://...'), {
      target: { value: 'https://docs.example.com/identity' },
    })

    expect(onChange).toHaveBeenCalledWith('https://docs.example.com/identity')
  })

  it('uploads a file and returns the stored evidence URL', async () => {
    const onChange = vi.fn()
    const file = new File(['resume'], 'identity.pdf', {
      type: 'application/pdf',
    })

    uploadEvidenceFileMock.mockResolvedValue({
      file: {
        url: '/api/uploads/verification/uploaded-identity.pdf',
        originalFileName: 'identity.pdf',
      },
    })

    const { container } = render(
      <EvidenceUploadField
        category="verification"
        label="Evidence Link"
        value=""
        onChange={onChange}
      />,
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(uploadEvidenceFileMock).toHaveBeenCalledWith('verification', file)
    })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('/api/uploads/verification/uploaded-identity.pdf')
    })
    expect(await screen.findByText('Uploaded: identity.pdf')).toBeInTheDocument()
  })

  it('shows upload errors without breaking the URL field', async () => {
    const onChange = vi.fn()
    const file = new File(['bad'], 'oversized.pdf', {
      type: 'application/pdf',
    })

    uploadEvidenceFileMock.mockRejectedValue(
      new Error('Evidence files must be 5 MB or smaller'),
    )

    const { container } = render(
      <EvidenceUploadField
        category="dispute"
        label="Evidence Link"
        value=""
        onChange={onChange}
      />,
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: { files: [file] },
    })

    expect(
      await screen.findByText('Evidence files must be 5 MB or smaller'),
    ).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
