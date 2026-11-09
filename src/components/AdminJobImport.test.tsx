import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { linkContacts } from '../lib/applyInstructions'

const api = vi.hoisted(() => ({ apiAdminImportJobs: vi.fn() }))
vi.mock('../lib/api', () => api)

import AdminJobImport from './AdminJobImport'

const preview = {
  company: { id: null, name: 'Strategic Jobs Africa', exists: false },
  dryRun: true,
  counts: { created: 2, skipped: 1, invalid: 0 },
  lines: [
    { line: 2, title: 'Scouts', status: 'would_create' },
    { line: 3, title: 'Recruiters', status: 'would_create' },
    { line: 4, title: 'Sales Girl', status: 'skipped', reason: 'A job with this title already exists for this company' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  api.apiAdminImportJobs.mockResolvedValueOnce(preview)
})

describe('the CSV import tool', () => {
  it('previews first, then imports, and lists the links of the created jobs', async () => {
    const onImported = vi.fn()
    render(<AdminJobImport onImported={onImported} />)
    fireEvent.click(screen.getByRole('button', { name: 'Import jobs from CSV' }))

    const file = new File(['Job title,Description\nScouts,Find riders'], 'jobs.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('Job title,Description\nScouts,Find riders') })
    fireEvent.change(screen.getByLabelText(/CSV file/), { target: { files: [file] } })
    fireEvent.change(screen.getByLabelText(/Company name/), { target: { value: 'Strategic Jobs Africa' } })
    fireEvent.change(screen.getByLabelText(/Closing date/), { target: { value: '2026-12-09' } })

    const previewButton = screen.getByRole('button', { name: 'Preview' })
    await waitFor(() => expect(previewButton).toBeEnabled())
    fireEvent.click(previewButton)

    expect(await screen.findByText(/2 will be created, 1 skipped/)).toBeInTheDocument()
    expect(api.apiAdminImportJobs.mock.calls[0][0]).toMatchObject({ dryRun: true, defaultType: 'Full-time', defaultClosingDate: '2026-12-09' })
    expect(screen.getByText('A job with this title already exists for this company')).toBeInTheDocument()

    api.apiAdminImportJobs.mockResolvedValueOnce({
      ...preview,
      dryRun: false,
      lines: preview.lines.map((line, index) => (line.status === 'skipped' ? line : { ...line, status: 'created', id: `j${index}`, path: `/jobs/j${index}` })),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 jobs' }))

    expect(await screen.findByText(/2 created, 1 skipped/)).toBeInTheDocument()
    expect(api.apiAdminImportJobs.mock.calls[1][0]).toMatchObject({ dryRun: false })
    expect(onImported).toHaveBeenCalled()
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/jobs/j0', '/jobs/j1'])
    expect(screen.getByRole('button', { name: 'Copy 2 job links' })).toBeInTheDocument()
  })
})

describe('the import from a company in the Growth section', () => {
  it('asks for no company details and sends the company id', async () => {
    api.apiAdminImportJobs.mockReset()
    api.apiAdminImportJobs.mockResolvedValue({ ...preview })
    render(<AdminJobImport startOpen fixedCompany={{ id: 'growth-1', name: 'SBP Africa' }} />)

    expect(screen.getByText('Jobs will be posted on behalf of SBP Africa.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Company name/)).not.toBeInTheDocument()

    const file = new File(['x'], 'jobs.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('Job title,Description' + String.fromCharCode(10) + 'Scouts,Find riders') })
    fireEvent.change(screen.getByLabelText(/CSV file/), { target: { files: [file] } })
    fireEvent.change(screen.getByLabelText(/Closing date/), { target: { value: '2026-12-09' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    await waitFor(() => expect(api.apiAdminImportJobs).toHaveBeenCalled())
    expect(api.apiAdminImportJobs.mock.calls[0][0].company).toMatchObject({ id: 'growth-1', name: 'SBP Africa' })
  })
})

describe('contact details in "How to apply"', () => {
  it('links email addresses and WhatsApp numbers', () => {
    render(<div>{linkContacts('Send CV to:\nWhatsApp: 0547125675\nEmail: recruitment@sbpafrica.group\nCall 024 400 0000')}</div>)
    expect(screen.getByRole('link', { name: '0547125675' })).toHaveAttribute('href', 'https://wa.me/233547125675')
    expect(screen.getByRole('link', { name: 'recruitment@sbpafrica.group' })).toHaveAttribute('href', 'mailto:recruitment@sbpafrica.group')
    expect(screen.getByRole('link', { name: '024 400 0000' })).toHaveAttribute('href', 'tel:0244000000')
    expect(screen.getByText(/Send CV to:/)).toBeInTheDocument()
  })
})
