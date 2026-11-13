// Writes the server-rendered version of the static pages into dist/prerendered/ (run after `vite build`).
// Each file is the built index.html with the page's real content and head tags put in, so the page is readable
// without JavaScript and the app still starts and takes over.
import { realpathSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'

// realpath gives the drive letter its real case on Windows; otherwise React can load twice (c:/ and C:) and hooks fail.
const root = realpathSync.native(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
const dist = join(root, 'dist')

const tagsOf = (html, pattern) => html.match(pattern) ?? []

/** Puts a rendered page into the built index.html. */
export const buildPrerenderedHtml = (indexHtml, page, footerHtml = '') => {
  let out = indexHtml
  // Replace the page's own title/description/canonical/social tags with the rendered ones.
  out = out.replace(/<title>[\s\S]*?<\/title>/, '')
  out = out.replace(/<meta (?:name="description"|property="og:[a-z:_]+"|name="twitter:[a-z:_]+")[^>]*>\s*/g, '')
  out = out.replace('</head>', () => `${page.head.title}${page.head.meta}${page.head.link}</head>`)
  // The home-page-only shell (two nested divs) goes; the page content takes its place.
  out = out.replace(/<div id="root">[\s\S]*?<\/div>\s*<\/div>/, () => `<div id="root">${page.html}${footerHtml}</div>`)
  return out
}

const footer = `<footer><nav aria-label="Footer"><a href="/">Home</a> · <a href="/jobs">Jobs</a> · <a href="/internships">Internships &amp; NSS</a> · <a href="/blog">Blog</a> · <a href="/about">About</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/support">Contact</a> · <a href="/hiring-service">Hiring Service</a></nav></footer>`

const run = async () => {
  const server = await createServer({
    root,
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  try {
    const indexHtml = await readFile(join(dist, 'index.html'), 'utf8')
    const { prerender, prerenderPaths } = await server.ssrLoadModule('/src/prerender.tsx')

    for (const path of prerenderPaths) {
      const page = prerender(path)
      // A page without its own title, description and canonical link must never ship.
      const expected = `rel="canonical" href="https://www.jobwahala.com${path}"`
      if (!page.head.title.includes('<title') || !page.head.link.includes(expected) || !page.head.meta.includes('name="description"')) {
        throw new Error(`prerender: ${path} is missing its title, description or canonical link`)
      }
      const html = buildPrerenderedHtml(indexHtml, page, footer)
      const file = join(dist, 'prerendered', `${path.replace(/^\//, '')}.html`)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, html)
      console.log(`prerendered ${path} (${page.html.length} bytes of content)`)
    }
  } finally {
    await server.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
