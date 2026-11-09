import { describe, expect, it } from 'vitest'
import { prerender, prerenderPaths } from '../prerender'

const words = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length

describe('pages made at build time', () => {
  it.each(prerenderPaths)('%s has real words and one heading', (path) => {
    const page = prerender(path)

    expect(words(page.html)).toBeGreaterThan(80)
    expect(page.html.match(/<h1/g)).toHaveLength(1)
  })

  it('covers the about, terms and privacy pages (the blog is rendered by the API from the database)', () => {
    for (const path of ['/about', '/terms', '/privacy']) expect(prerenderPaths).toContain(path)
    expect(prerenderPaths.some((path) => path.startsWith('/blog'))).toBe(false)
  })
})
