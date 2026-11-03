import { describe, expect, it } from 'vitest'
import { buildProfileShare, profileWhatsAppMessage, whatsAppShareUrl } from './shareProfile'

const base = { id: 'abc', name: 'Ama Mensah', skills: ['Figma', 'Canva'], origin: 'https://www.jobwahala.com' }

describe('buildProfileShare', () => {
  it('uses the tagline and bio when present', () => {
    const share = buildProfileShare({ ...base, tagline: 'Brand designer', bio: 'I design logos.' })

    expect(share.title).toBe('Ama Mensah — Brand designer')
    expect(share.description).toBe('I design logos.')
    expect(share.url).toBe('https://www.jobwahala.com/freelancers/abc')
  })

  it('falls back to skills so a bare profile still shares well', () => {
    const share = buildProfileShare(base)

    expect(share.title).toBe('Ama Mensah — Figma · Canva')
    expect(share.description).toContain('Skills: Figma, Canva.')
    expect(share.description).toContain('escrow')
  })

  it('describes the person for search engines', () => {
    const { jsonLd } = buildProfileShare(base)

    expect(jsonLd['@type']).toBe('Person')
    expect(jsonLd.knowsAbout).toEqual(['Figma', 'Canva'])
  })

  it('clips long bios for link previews', () => {
    const share = buildProfileShare({ ...base, bio: 'word '.repeat(200) })

    expect(share.description.length).toBeLessThanOrEqual(200)
  })
})

describe('WhatsApp sharing', () => {
  it('builds a wa.me link carrying the profile address', () => {
    const url = new URL(whatsAppShareUrl(profileWhatsAppMessage('Ama', 'https://www.jobwahala.com/freelancers/abc')))

    expect(url.origin).toBe('https://wa.me')
    expect(url.searchParams.get('text')).toContain('https://www.jobwahala.com/freelancers/abc')
  })
})
