import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

/** Google only shows a site icon when it is square and a multiple of 48 pixels, and when the home page links to it. */
describe('the site icon Google shows in search results', () => {
  it('has a favicon.ico that holds the 192 px icon (192 is 4 x 48)', () => {
    const ico = readFileSync(resolve(root, 'public/favicon.ico'))
    expect(ico.readUInt16LE(2)).toBe(1) // an icon file
    expect(ico[6]).toBe(192)
    expect(ico[7]).toBe(192)
    const png = readFileSync(resolve(root, 'public/icon-192.png'))
    expect(ico.subarray(22).equals(png)).toBe(true)
  })

  it('is linked from the app page and from every server-rendered page', () => {
    for (const html of [read('index.html'), read('backend/src/utils/seoPages.ts')]) {
      expect(html).toContain('href="/favicon.ico"')
      expect(html).toContain('sizes="192x192" href="/icon-192.png"')
    }
  })
})
