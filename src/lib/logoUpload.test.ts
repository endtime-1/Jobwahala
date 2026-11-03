import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maxLogoFileBytes, toSiteRelativeUrl, uploadLogoFile } from './evidenceUpload'

const png = (bytes = 8) => new File([new Uint8Array(bytes)], 'logo.png', { type: 'image/png' })

describe('toSiteRelativeUrl', () => {
  it('turns our own absolute address into a path that survives a domain change', () => {
    expect(toSiteRelativeUrl(`${window.location.origin}/api/uploads/logo/a.png`)).toBe('/api/uploads/logo/a.png')
    expect(toSiteRelativeUrl('/api/uploads/logo/a.png')).toBe('/api/uploads/logo/a.png')
  })

  it('keeps files hosted elsewhere (for example object storage) as they are', () => {
    expect(toSiteRelativeUrl('https://cdn.example.com/logo/a.png')).toBe('https://cdn.example.com/logo/a.png')
  })
})

describe('uploadLogoFile', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('jobwahala_token', 'tok')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ success: true, file: { url: '/api/uploads/logo/new.png' } }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the image as a logo and returns a site-relative address', async () => {
    const result = await uploadLogoFile(png())

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toMatchObject({ category: 'logo', contentType: 'image/png', fileName: 'logo.png' })
    expect(result.file.url).toBe('/api/uploads/logo/new.png')
  })

  it('refuses a PDF before any network call', async () => {
    const pdf = new File([new Uint8Array(8)], 'logo.pdf', { type: 'application/pdf' })

    await expect(uploadLogoFile(pdf)).rejects.toThrow(/PNG, JPG or WEBP/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses an image over 1 MB before any network call', async () => {
    await expect(uploadLogoFile(png(maxLogoFileBytes + 1))).rejects.toThrow(/1 MB or smaller/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
