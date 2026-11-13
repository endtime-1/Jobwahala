import { renderToString } from 'react-dom/server'
import { HelmetProvider, type HelmetServerState } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import About from './pages/About'
import HiringService from './pages/HiringService'
import Support from './pages/Support'
import { AuthContext, type AuthContextType } from './context/AuthContext'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

/**
 * Build-time rendering of the pages that do not depend on the signed-in person or the database.
 * scripts/prerender.mjs writes each one into dist/prerendered/, and nginx serves it to everyone (bots and people),
 * so the words are in the HTML before any JavaScript runs. These are the very same components the app shows.
 */
export const prerenderPaths = ['/about', '/terms', '/privacy', '/support', '/hiring-service']

/** What a visitor who is not signed in sees; the app takes over in the browser and fills in the real person. */
const signedOut = { user: null, token: null, isLoading: false, isOnboarded: false, userName: '', userEmail: '', role: null } as unknown as AuthContextType

export type PrerenderedPage = { html: string; head: Record<string, string> }

export const prerender = (path: string): PrerenderedPage => {
  const helmetContext: { helmet?: HelmetServerState | null } = {}
  // Components that read the address (the canonical link, share links) see the page being rendered.
  const location = { href: `https://www.jobwahala.com${path}`, pathname: path, origin: 'https://www.jobwahala.com' }
  const needsWindow = typeof window === 'undefined'
  if (needsWindow) (globalThis as unknown as { window: unknown }).window = { location }

  try {
    const html = renderToString(
      <AuthContext.Provider value={signedOut}>
      <HelmetProvider context={helmetContext}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/support" element={<Support />} />
            <Route path="/hiring-service" element={<HiringService />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
      </AuthContext.Provider>,
    )
    // React 19 writes the page's <title>, <meta> and <link> tags at the start of the output; older Helmet put them in the context.
    const lead = /^(?:<title[^>]*>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*>)+/.exec(html)?.[0] ?? ''
    const helmet = helmetContext.helmet
    const fromLead = (pattern: RegExp) => (lead.match(pattern) ?? []).join('')
    return {
      html: html.slice(lead.length),
      head: {
        title: fromLead(/<title[^>]*>[\s\S]*?<\/title>/g) || helmet?.title?.toString() || '',
        meta: fromLead(/<meta\b[^>]*>/g) || helmet?.meta?.toString() || '',
        link: fromLead(/<link\b[^>]*>/g) || helmet?.link?.toString() || '',
      },
    }
  } finally {
    if (needsWindow) delete (globalThis as unknown as { window?: unknown }).window
  }
}
