import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerApplicantsPanel from '../pages/dashboards/employer/EmployerApplicantsPanel'
import { cvUploadConstraints, uploadCvFile } from '../lib/evidenceUpload'
import CvChoice, { type CvChoiceValue } from './CvChoice'
import CvManager from './CvManager'

const apiGetCvMock = vi.fn()
const apiSetUploadedMock = vi.fn()
const apiClearUploadedMock = vi.fn()
const apiClearBuilderMock = vi.fn()

vi.mock('../lib/api', () => ({
  apiGetMyCvFiles: (...args: unknown[]) => apiGetCvMock(...args),
  apiSetUploadedCv: (...args: unknown[]) => apiSetUploadedMock(...args),
  apiClearUploadedCv: (...args: unknown[]) => apiClearUploadedMock(...args),
  apiClearBuilderCv: (...args: unknown[]) => apiClearBuilderMock(...args),
}))

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const fileOf = (name: string, type: string, size = 1000) => {
  const file = new File(['x'.repeat(Math.min(size, 50))], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const cv = (fileName: string) => ({ url: `/api/uploads/cv/1-u${'a'.repeat(12)}-x-${fileName}`, fileName, savedAt: '2026-11-01T00:00:00.000Z' })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('jobwahala_token', 'tok')
  apiGetCvMock.mockResolvedValue({ uploaded: null, builder: null })
  apiSetUploadedMock.mockResolvedValue({ success: true })
  apiClearUploadedMock.mockResolvedValue({ success: true })
  apiClearBuilderMock.mockResolvedValue({ success: true })
})

describe('uploading a CV from the browser', () => {
  const stubFetch = (response: { ok: boolean; body: unknown }) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response.body), { status: response.ok ? 201 : 400 }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('sends a PDF or Word file as a private "cv" upload', async () => {
    const fetchMock = stubFetch({ ok: true, body: { file: { url: '/api/uploads/cv/x.pdf' } } })

    await uploadCvFile(fileOf('My CV.pdf', 'application/pdf'))

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/uploads\/evidence$/)
    expect(JSON.parse(init.body as string)).toMatchObject({ category: 'cv', fileName: 'My CV.pdf', contentType: 'application/pdf' })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    vi.unstubAllGlobals()
  })

  it('works out the type from the file ending when the phone leaves it blank', async () => {
    const fetchMock = stubFetch({ ok: true, body: { file: { url: '/api/uploads/cv/x.docx' } } })

    await uploadCvFile(fileOf('cv.docx', ''))

    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).contentType).toBe(DOCX)
    vi.unstubAllGlobals()
  })

  it('turns away other file types and big files before sending anything', async () => {
    const fetchMock = stubFetch({ ok: true, body: {} })

    await expect(uploadCvFile(fileOf('photo.png', 'image/png'))).rejects.toThrow(/PDF or a Word/)
    await expect(uploadCvFile(fileOf('cv.pdf', 'application/pdf', cvUploadConstraints.maxBytes + 1))).rejects.toThrow(/3 MB/)
    await expect(uploadCvFile(fileOf('cv.doc', ''))).rejects.toThrow(/PDF or a Word/)

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('shows the server\'s reason when it refuses the file', async () => {
    stubFetch({ ok: false, body: { message: 'PDFs with scripts or attachments cannot be accepted.' } })

    await expect(uploadCvFile(fileOf('cv.pdf', 'application/pdf'))).rejects.toThrow(/scripts or attachments/)
    vi.unstubAllGlobals()
  })
})

describe('My CV panel', () => {
  const renderManager = () =>
    render(
      <MemoryRouter>
        <CvManager />
      </MemoryRouter>,
    )

  it('says when there are no CVs yet, and points to the CV builder', async () => {
    renderManager()

    expect(await screen.findByRole('button', { name: /upload a cv/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cv builder/i })).toHaveAttribute('href', '/cv-generator')
    expect(screen.getByText(/only employers you apply to can download it/i)).toBeInTheDocument()
  })

  it('shows both CVs by name', async () => {
    apiGetCvMock.mockResolvedValue({ uploaded: cv('my-cv.pdf'), builder: cv('builder.docx') })

    renderManager()

    expect(await screen.findByText('my-cv.pdf')).toBeInTheDocument()
    expect(screen.getByText('builder.docx')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /replace my uploaded cv/i })).toBeInTheDocument()
  })

  it('removes one CV and reloads', async () => {
    apiGetCvMock.mockResolvedValueOnce({ uploaded: cv('my-cv.pdf'), builder: null }).mockResolvedValue({ uploaded: null, builder: null })
    renderManager()

    fireEvent.click(await screen.findByRole('button', { name: /remove uploaded cv/i }))

    await waitFor(() => expect(apiClearUploadedMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('my-cv.pdf')).not.toBeInTheDocument())
  })

  it('refuses a file that is not a PDF or Word document, with a plain message', async () => {
    renderManager()
    await screen.findByRole('button', { name: /upload a cv/i })

    fireEvent.change(screen.getByLabelText(/choose a cv file/i), { target: { files: [fileOf('photo.png', 'image/png')] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/PDF or a Word/)
    expect(apiSetUploadedMock).not.toHaveBeenCalled()
  })

  it('says so when the CVs cannot be loaded', async () => {
    apiGetCvMock.mockRejectedValue(new Error('offline'))

    renderManager()

    expect(await screen.findByRole('alert')).toHaveTextContent(/offline|could not load/i)
  })
})

describe('choosing which CV to send', () => {
  const Harness = ({ onChoice }: { onChoice: (value: CvChoiceValue) => void }) => {
    const [value, setValue] = useState<CvChoiceValue | null>(null)
    return (
      <MemoryRouter>
        <CvChoice
          value={value}
          onChange={(next) => {
            setValue(next)
            onChoice(next)
          }}
        />
      </MemoryRouter>
    )
  }

  it('offers only the CVs the member has, starting on the uploaded one, and always allows none', async () => {
    apiGetCvMock.mockResolvedValue({ uploaded: cv('my-cv.pdf'), builder: cv('builder.docx') })
    const onChoice = vi.fn()

    render(<Harness onChoice={onChoice} />)

    expect(await screen.findByLabelText(/my uploaded cv/i)).toBeChecked()
    expect(screen.getByLabelText(/cv from the cv builder/i)).not.toBeChecked()
    expect(screen.getByLabelText(/do not send a cv/i)).toBeInTheDocument()
    expect(onChoice).toHaveBeenCalledWith('UPLOADED')
  })

  it('starts on the CV-builder version when that is all there is', async () => {
    apiGetCvMock.mockResolvedValue({ uploaded: null, builder: cv('builder.docx') })
    const onChoice = vi.fn()

    render(<Harness onChoice={onChoice} />)

    expect(await screen.findByLabelText(/cv from the cv builder/i)).toBeChecked()
    expect(screen.queryByLabelText(/my uploaded cv/i)).not.toBeInTheDocument()
    expect(onChoice).toHaveBeenCalledWith('BUILDER')
  })

  it('lets the member switch, or send none', async () => {
    apiGetCvMock.mockResolvedValue({ uploaded: cv('my-cv.pdf'), builder: cv('builder.docx') })
    const onChoice = vi.fn()
    render(<Harness onChoice={onChoice} />)

    fireEvent.click(await screen.findByLabelText(/cv from the cv builder/i))
    expect(onChoice).toHaveBeenLastCalledWith('BUILDER')

    fireEvent.click(screen.getByLabelText(/do not send a cv/i))
    expect(onChoice).toHaveBeenLastCalledWith('NONE')
  })

  it('with no CVs at all, offers no choice and points to where to add one', async () => {
    const onChoice = vi.fn()

    render(<Harness onChoice={onChoice} />)

    expect(await screen.findByText(/have not added a cv yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /upload one/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(onChoice).not.toHaveBeenCalled()
  })

  it('shows no picker, and does not break, when the list cannot be loaded', async () => {
    apiGetCvMock.mockRejectedValue(new Error('offline'))

    const { container } = render(<Harness onChoice={vi.fn()} />)

    await waitFor(() => expect(apiGetCvMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})

describe('what an employer sees', () => {
  const applicant = (overrides: Record<string, unknown> = {}) => ({
    id: 'app-1',
    status: 'SUBMITTED',
    createdAt: '2026-11-01T00:00:00.000Z',
    coverLetter: 'Hello',
    seeker: { id: 's1', email: 'ama@example.com', jobSeekerProfile: { firstName: 'Ama', lastName: 'Mensah', skills: 'Front desk' } },
    ...overrides,
  })

  const renderPanel = (applicants: unknown[]) =>
    render(
      <MemoryRouter>
        <EmployerApplicantsPanel
          jobs={[{ id: 'job-1', title: 'Receptionist', status: 'ACTIVE', createdAt: '2026-11-01T00:00:00.000Z', _count: { applications: applicants.length } }]}
          applicants={applicants as never}
          selectedJobId="job-1"
          selectedJobTitle="Receptionist"
          isApplicantsLoading={false}
          onSelectJob={vi.fn()}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>,
    )

  it('links the CV that came with an application, by name and kind', () => {
    renderPanel([applicant({ cvSource: 'UPLOADED', cvFileUrl: '/api/uploads/cv/1-u-x-my-cv.pdf', cvFileName: 'my-cv.pdf' })])

    const link = screen.getByRole('link', { name: /download cv: my-cv\.pdf \(uploaded\)/i })
    expect(link).toHaveAttribute('href', '/api/uploads/cv/1-u-x-my-cv.pdf')
  })

  it('says which kind it was when it came from the CV builder', () => {
    renderPanel([applicant({ cvSource: 'BUILDER', cvFileUrl: '/api/uploads/cv/1-u-x-b.docx', cvFileName: 'b.docx' })])

    expect(screen.getByRole('link', { name: /made with the cv builder/i })).toBeInTheDocument()
  })

  it('says plainly when no CV was sent', () => {
    renderPanel([applicant()])

    expect(screen.getByText(/no cv was sent with this application/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /download cv/i })).not.toBeInTheDocument()
  })
})
