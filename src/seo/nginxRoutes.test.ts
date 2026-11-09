import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const nginx = readFileSync(resolve(root, 'docker/nginx.conf'), 'utf8')
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8')

// The patterns inside the `map $uri $app_route { ... }` block, as real regular expressions.
const mapBlock = nginx.slice(nginx.indexOf('map $uri $app_route'), nginx.indexOf('server {'))
const patterns = [...mapBlock.matchAll(/"~(.+?)"\s+1;/g)].map((match) => new RegExp(match[1]))
const isAppRoute = (path: string) => patterns.some((pattern) => pattern.test(path))

// Every fixed path in the router (no parameters, no wildcard), and an example for each parameterised one.
const routerPaths = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])
const example = (path: string) => path.replace(/:[A-Za-z]+/g, 'example-1')

// Routes that nginx answers in a dedicated location (or that /:slug and * cover) are not in the map.
const handledElsewhere = new Set(['/', '/jobs', '/internships', '/courses', '/:slug', '*'])

describe('nginx knows every page of the app', () => {
  it('finds the routes it checks', () => {
    expect(patterns.length).toBeGreaterThanOrEqual(3)
    expect(routerPaths.length).toBeGreaterThan(30)
  })

  it('treats every router path as a real page, so no real page ever answers 404', () => {
    const missing = routerPaths.filter((path) => !handledElsewhere.has(path)).filter((path) => !isAppRoute(example(path)))
    expect(missing).toEqual([])
  })

  it('answers 404 for addresses that are not pages', () => {
    for (const path of ['/nope-xyz', '/wp-login.php', '/jobs/a/b', '/admin/secret', '/random/deep/path']) expect(isAppRoute(path)).toBe(false)
  })
})

describe('the bot and domain rules in nginx', () => {
  it('lets every Google crawler (including the inspection tool) get the server-rendered pages', () => {
    const line = nginx.split('\n').find((row) => row.includes('Googlebot')) ?? ''
    for (const bot of ['Googlebot', 'Google-InspectionTool', 'GoogleOther', 'AdsBot-Google', 'Storebot-Google', 'bingbot']) expect(line).toContain(bot)
  })

  it('redirects the bare domain to www with a permanent redirect', () => {
    expect(nginx).toContain('if ($host = jobwahala.com)')
    expect(nginx).toContain('return 301 https://www.jobwahala.com$request_uri;')
  })

  it('tells crawlers to retry later (503 + Retry-After) when the API is down, instead of an error that looks permanent', () => {
    expect(nginx).toMatch(/error_page 502 503 504 = @backend_unavailable;/)
    expect(nginx).toMatch(/Retry-After 120/)
    // every location that proxies to the share pages has the fallback
    const crawlerLocations = nginx.split('\n  location ').filter((block) => block.includes('rewrite') && block.includes('/api/share/'))
    expect(crawlerLocations.length).toBeGreaterThan(8)
    for (const block of crawlerLocations) expect(block).toContain('@backend_unavailable')
  })

  it('serves the same server-rendered page to every visitor, bots and people alike (no different content for bots)', () => {
    const pageLocations = nginx.split('\n  location ').filter((block) => block.includes('rewrite') && block.includes('/api/share/'))
    expect(pageLocations.length).toBeGreaterThanOrEqual(12)
    for (const block of pageLocations) {
      expect(block).not.toContain('if ($is_link_crawler)')
      expect(block).toContain('proxy_pass $backend;')
    }
    // the home page and the jobs page are among them
    expect(nginx).toMatch(/location = \/ \{[^}]*\/api\/share\/pages\/home/)
    expect(nginx).toMatch(/location = \/jobs \{[^}]*\/api\/share\/pages\/jobs/)
  })

  it('still gives people the app when the API is down, and crawlers a 503', () => {
    const fallback = nginx.slice(nginx.indexOf('location @backend_unavailable'))
    expect(fallback).toMatch(/if \(\$is_link_crawler = 0\) \{\s*rewrite \^ \/index\.html break;/)
    expect(fallback).toContain('return 503')
  })

  it('serves the pages made at build time (about, terms, privacy, blog) from dist/prerendered', () => {
    expect(nginx).toContain('try_files /prerendered/$pre_page.html /index.html;')
    expect(nginx).toContain('try_files /prerendered/blog/$pre_post.html @app_page;')
    expect(nginx).toMatch(/pre_page>about\|terms\|privacy\|blog/)
  })

  it('sends http:// visits to https on the www address', () => {
    expect(nginx).toMatch(/if \(\$http_x_forwarded_proto = http\) \{\s*return 301 https:\/\/www\.jobwahala\.com\$request_uri;/)
  })

  it('serves the sitemap index and each sitemap it lists from the API', () => {
    expect(nginx).toContain('location = /sitemap.xml')
    expect(nginx).toContain('sitemap_part>static|landing|jobs|companies')
    expect(nginx).toContain('/api/share/sitemap/$sitemap_part')
  })

  it('serves the web health check without the API, and keeps the app shell for 404 pages', () => {
    expect(nginx).toContain('location = /_web_health')
    expect(nginx).toContain('error_page 404 /404.html;')
    expect(readFileSync(resolve(root, 'Dockerfile'), 'utf8')).toContain('cp /usr/share/nginx/html/index.html /usr/share/nginx/html/404.html')
  })
})
