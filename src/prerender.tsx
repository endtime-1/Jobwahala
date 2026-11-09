import { renderToString } from 'react-dom/server'
import { HelmetProvider, type HelmetServerState } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import About from './pages/About'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import { blogPosts } from './data/blogData'

/**
 * Build-time rendering of the pages that do not depend on the signed-in person or the database.
 * scripts/prerender.mjs writes each one into dist/prerendered/, and nginx serves it to everyone (bots and people),
 * so the words are in the HTML before any JavaScript runs. These are the very same components the app shows.
 */
export const prerenderPaths = ['/about', '/terms', '/privacy', '/blog', ...blogPosts.map((post) => `/blog/${post.id}`)]

export type PrerenderedPage = { html: string; head: Record<string, string> }

export const prerender = (path: string): PrerenderedPage => {
  const helmetContext: { helmet?: HelmetServerState | null } = {}
  // Components that read the address (the canonical link, share links) see the page being rendered.
  const location = { href: `https://www.jobwahala.com${path}`, pathname: path, origin: 'https://www.jobwahala.com' }
  const needsWindow = typeof window === 'undefined'
  if (needsWindow) (globalThis as unknown as { window: unknown }).window = { location }

  try {
    const html = renderToString(
      <HelmetProvider context={helmetContext}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:id" element={<BlogPost />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    )
    const helmet = helmetContext.helmet
    return {
      html,
      head: {
        title: helmet?.title?.toString() ?? '',
        meta: helmet?.meta?.toString() ?? '',
        link: helmet?.link?.toString() ?? '',
      },
    }
  } finally {
    if (needsWindow) delete (globalThis as unknown as { window?: unknown }).window
  }
}
