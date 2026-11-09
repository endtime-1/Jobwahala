import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasRichStructure, htmlToMarkdown } from '../lib/htmlToMarkdown'

const api = vi.hoisted(() => ({
  apiAdminBlogList: vi.fn(),
  apiAdminBlogCreate: vi.fn(),
  apiAdminBlogUpdate: vi.fn(),
  apiAdminBlogDelete: vi.fn(),
  apiAdminBlogPreview: vi.fn(),
}))
const upload = vi.hoisted(() => vi.fn())
vi.mock('../lib/api', () => api)
vi.mock('../lib/evidenceUpload', () => ({ uploadLogoFile: upload }))

import AdminBlogPanel from './AdminBlogPanel'

const categories = [
  { slug: 'cv-tips', label: 'CV tips' },
  { slug: 'scam-alerts', label: 'Scam alerts' },
]

beforeEach(() => {
  vi.clearAllMocks()
  api.apiAdminBlogList.mockResolvedValue({ categories, posts: [] })
  api.apiAdminBlogCreate.mockImplementation(async (input: object) => ({ post: { id: 'p1', state: 'DRAFT', status: 'DRAFT', publishAt: null, ...input } }))
})

describe('pasted rich text becomes Markdown', () => {
  it('keeps headings, bold, lists and links', () => {
    const md = htmlToMarkdown('<h1>Title</h1><p>Some <strong>bold</strong> and <em>soft</em> text with a <a href="https://x.test">link</a>.</p><h3>Steps</h3><ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol>')
    expect(md).toContain('## Title')
    expect(md).toContain('**bold**')
    expect(md).toContain('*soft*')
    expect(md).toContain('[link](https://x.test)')
    expect(md).toContain('### Steps')
    expect(md).toContain('- One\n- Two')
    expect(md).toContain('1. First')
  })

  it('only converts HTML that carries structure', () => {
    expect(hasRichStructure('<span>just text</span>')).toBe(false)
    expect(hasRichStructure('<p>Hello <b>you</b></p>')).toBe(true)
  })
})

describe('the blog panel', () => {
  it('writes a post, makes the slug from the title, and saves it as a draft', async () => {
    render(<AdminBlogPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /New post/ }))

    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'How to Spot a Job Scam' } })
    expect((screen.getByLabelText(/URL slug/) as HTMLInputElement).value).toBe('how-to-spot-a-job-scam')
    fireEvent.change(screen.getByLabelText(/Meta description/), { target: { value: 'Learn the five signs of a fake job advert in Ghana.' } })
    fireEvent.change(screen.getByLabelText('Article'), { target: { value: '## Signs\nNever pay to apply.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }))

    await waitFor(() => expect(api.apiAdminBlogCreate).toHaveBeenCalled())
    expect(api.apiAdminBlogCreate.mock.calls[0][0]).toMatchObject({ slug: 'how-to-spot-a-job-scam', status: 'DRAFT', category: 'cv-tips', body: '## Signs\nNever pay to apply.' })
    expect(await screen.findByText('Saved as a draft.')).toBeInTheDocument()
  })

  it('publishes, and shows the server error when the slug is taken', async () => {
    api.apiAdminBlogCreate.mockRejectedValue(new Error('Another article already uses that address. Change the URL slug.'))
    render(<AdminBlogPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /New post/ }))
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Same title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(api.apiAdminBlogCreate.mock.calls[0][0]).toMatchObject({ status: 'PUBLISHED' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Another article already uses that address')
  })

  it('lists posts with their state', async () => {
    api.apiAdminBlogList.mockResolvedValue({
      categories,
      posts: [{ id: 'a', slug: 'later', title: 'Coming soon', category: 'cv-tips', state: 'SCHEDULED', status: 'PUBLISHED', publishAt: '2099-01-01T09:00:00.000Z', wordCount: 300, body: '', metaDescription: '', coverImageUrl: null, coverImageAlt: null, authorName: 'A', updatedAt: '2026-11-01' }],
    })
    render(<AdminBlogPanel />)
    expect(await screen.findByText('Coming soon')).toBeInTheDocument()
    expect(screen.getByText('SCHEDULED')).toBeInTheDocument()
  })

  it('shows a live preview made by the server, and inserts an uploaded image with its description', async () => {
    api.apiAdminBlogPreview.mockResolvedValue({ html: '<h2>Signs</h2><p>Never pay to apply.</p>' })
    upload.mockResolvedValue({ file: { url: '/api/uploads/logo/pic.webp' } })
    render(<AdminBlogPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /New post/ }))
    fireEvent.change(screen.getByLabelText('Article'), { target: { value: 'Start' } })

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByRole('heading', { name: 'Signs' })).toBeInTheDocument()
    expect(api.apiAdminBlogPreview).toHaveBeenCalledWith('Start')

    // an image needs its description first
    const file = new File([new Uint8Array(4)], 'pic.webp', { type: 'image/webp' })
    fireEvent.change(screen.getByLabelText('Insert an image'), { target: { files: [file] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Describe the image first')

    fireEvent.change(screen.getByLabelText('Image description'), { target: { value: 'A job advert with a warning' } })
    fireEvent.change(screen.getByLabelText('Insert an image'), { target: { files: [file] } })
    await waitFor(() => expect((screen.getByLabelText('Article') as HTMLTextAreaElement).value).toContain('![A job advert with a warning](/api/uploads/logo/pic.webp)'))
  })
})
