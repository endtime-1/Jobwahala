import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EvidenceLink from './EvidenceLink'

const openProtectedFileMock = vi.fn()

vi.mock('../lib/evidenceAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/evidenceAccess')>()),
  openProtectedFile: (...args: unknown[]) => openProtectedFileMock(...args),
}))

describe('EvidenceLink', () => {
  beforeEach(() => {
    openProtectedFileMock.mockReset()
  })

  it('opens private uploads through a signed link instead of the stored address', () => {
    render(<EvidenceLink href="/api/uploads/verification/1-a.pdf">Open</EvidenceLink>)

    fireEvent.click(screen.getByRole('link', { name: 'Open' }))

    expect(openProtectedFileMock).toHaveBeenCalledWith('/api/uploads/verification/1-a.pdf')
  })

  it('lets links to other sites behave like normal links', () => {
    render(<EvidenceLink href="https://example.com/portfolio.pdf">Open</EvidenceLink>)
    const link = screen.getByRole('link', { name: 'Open' })

    fireEvent.click(link)

    expect(openProtectedFileMock).not.toHaveBeenCalled()
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })
})
