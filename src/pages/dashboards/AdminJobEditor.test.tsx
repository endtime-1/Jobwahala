import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const update = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api', () => ({ apiUpdateAdminJobContent: update }))

import AdminJobEditor from './AdminJobEditor'

describe('editing a job as an admin', () => {
  it('sends only what changed, with the reason, and asks for a refresh', async () => {
    update.mockResolvedValue({ success: true })
    const onSaved = vi.fn()
    render(<AdminJobEditor job={{ id: 'job-1', title: 'B2B SALES EXCUTIVE', description: 'Text' }} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit text' }))
    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'B2B SALES EXECUTIVE' } })
    const save = screen.getByRole('button', { name: 'Save change' })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Why/), { target: { value: 'Typo, employer agreed' } })
    fireEvent.click(save)

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith('job-1', { title: 'B2B SALES EXECUTIVE', reason: 'Typo, employer agreed' })
  })

  it('shows the error when saving fails', async () => {
    update.mockRejectedValue(new Error('Nothing changed'))
    render(<AdminJobEditor job={{ id: 'job-1', title: 'A', description: 'B' }} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit text' }))
    fireEvent.change(screen.getByLabelText(/Why/), { target: { value: 'because' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing changed')
  })
})
