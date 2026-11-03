import { describe, expect, it } from 'vitest'
import { isProtectedUploadUrl, resolveSignedUrl } from './evidenceAccess'

describe('isProtectedUploadUrl', () => {
  it('recognises private uploads, relative or absolute', () => {
    expect(isProtectedUploadUrl('/api/uploads/verification/1-a.pdf')).toBe(true)
    expect(isProtectedUploadUrl('https://www.jobwahala.com/api/uploads/dispute/1-a.png')).toBe(true)
    expect(isProtectedUploadUrl('http://localhost:5173/api/uploads/message/1-a.webp')).toBe(true)
  })

  it('leaves logos, other sites and empty values alone', () => {
    expect(isProtectedUploadUrl('/api/uploads/logo/1-a.png')).toBe(false)
    expect(isProtectedUploadUrl('https://example.com/portfolio.pdf')).toBe(false)
    expect(isProtectedUploadUrl('/api/uploads/verification/a/b.pdf')).toBe(false)
    expect(isProtectedUploadUrl('')).toBe(false)
    expect(isProtectedUploadUrl(null)).toBe(false)
  })
})

describe('resolveSignedUrl', () => {
  it('keeps same-site paths as they are', () => {
    expect(resolveSignedUrl('/api/uploads/message/a.png?exp=1&sig=2', '/api')).toBe('/api/uploads/message/a.png?exp=1&sig=2')
  })

  it('points at the API server when the app talks to a separate one', () => {
    expect(resolveSignedUrl('/api/uploads/message/a.png?exp=1&sig=2', 'https://api.example.com/api')).toBe(
      'https://api.example.com/api/uploads/message/a.png?exp=1&sig=2',
    )
  })
})
