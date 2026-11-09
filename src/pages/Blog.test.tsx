import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ apiGetBlogPosts: vi.fn(), apiGetBlogPost: vi.fn() }))
vi.mock('../lib/api', () => api)

import Blog from './Blog'
import BlogPost from './BlogPost'

const card = {
  slug: 'spot-a-scam',
  title: 'How to spot a job scam',
  excerpt: 'Five signs of a fake job advert.',
  category: 'scam-alerts',
  categoryLabel: 'Scam alerts',
  coverImageUrl: '/api/uploads/logo/c.webp',
  coverImageAlt: 'A warning sign',
  authorName: 'JobWahala Editorial',
  publishedAt: '2026-11-01T09:00:00.000Z',
  readingMinutes: 3,
}
const categories = [
  { slug: 'cv-tips', label: 'CV tips' },
  { slug: 'scam-alerts', label: 'Scam alerts' },
]

const wrap = (path: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:id" element={<BlogPost />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  </QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  api.apiGetBlogPosts.mockResolvedValue({ categories, posts: [card] })
  api.apiGetBlogPost.mockResolvedValue({ post: { ...card, metaDescription: card.excerpt, html: '<h2>Sign one</h2><p>Never pay to apply.</p>' }, more: [] })
})

describe('the blog page', () => {
  it('lists articles with a link to each, and filters by category', async () => {
    render(wrap('/blog'))
    const link = await screen.findByRole('link', { name: 'How to spot a job scam' })
    expect(link).toHaveAttribute('href', '/blog/spot-a-scam')
    expect(screen.getByAltText('A warning sign')).toHaveAttribute('width', '800')

    fireEvent.click(screen.getByRole('button', { name: 'Scam alerts' }))
    await vi.waitFor(() => expect(api.apiGetBlogPosts).toHaveBeenLastCalledWith('scam-alerts'))
  })
})

describe('an article', () => {
  it('shows the title, author, cover, text, share buttons and the jobs and WhatsApp box', async () => {
    render(wrap('/blog/spot-a-scam'))
    expect(await screen.findByRole('heading', { level: 1, name: 'How to spot a job scam' })).toBeInTheDocument()
    expect(screen.getByText(/By JobWahala Editorial/)).toBeInTheDocument()
    expect(screen.getByAltText('A warning sign')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sign one' })).toBeInTheDocument()
    for (const name of ['WhatsApp', 'Facebook', 'LinkedIn', 'X']) expect(screen.getByRole('link', { name })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse open jobs' })).toHaveAttribute('href', '/jobs')
    expect(screen.getByRole('link', { name: /Follow our WhatsApp channel/ })).toHaveAttribute('href', expect.stringContaining('whatsapp.com'))
  })

  it('says so when the article does not exist', async () => {
    api.apiGetBlogPost.mockRejectedValue(new Error('Article not found'))
    render(wrap('/blog/nope'))
    expect(await screen.findByRole('heading', { name: /could not find that article/ })).toBeInTheDocument()
  })
})
