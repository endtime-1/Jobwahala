import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { blogPosts } from '../data/blogData'
import { prerender, prerenderPaths } from '../prerender'

const words = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length

describe('pages made at build time', () => {
  it.each(prerenderPaths)('%s has real words and one heading', (path) => {
    const page = prerender(path)

    expect(words(page.html)).toBeGreaterThan(80)
    expect(page.html.match(/<h1/g)).toHaveLength(1)
  })

  it('covers the about, terms, privacy and blog pages and every article', () => {
    for (const path of ['/about', '/terms', '/privacy', '/blog']) expect(prerenderPaths).toContain(path)
    for (const post of blogPosts) expect(prerenderPaths).toContain(`/blog/${post.id}`)
  })

  it('has every article in the sitemap', () => {
    const sitemap = readFileSync(resolve(__dirname, '../../backend/src/utils/sitemap.ts'), 'utf8')
    for (const post of blogPosts) expect(sitemap).toContain(`/blog/${post.id}`)
  })
})
