import { API_UNAVAILABLE_MESSAGE, markApiHealthy, markApiUnreachable } from './apiStatus'

const rawApiUrl = import.meta.env.VITE_API_URL?.trim()
const API_ROOT = rawApiUrl ? rawApiUrl.replace(/\/$/, '') : '/api'

const fetch: typeof globalThis.fetch = async (input, init) => {
  try {
    const response = await globalThis.fetch(input, init)
    markApiHealthy()
    return response
  } catch (error) {
    markApiUnreachable()

    if (error instanceof Error) {
      throw new Error(API_UNAVAILABLE_MESSAGE)
    }

    throw new Error(API_UNAVAILABLE_MESSAGE)
  }
}

export type EvidenceUploadCategory = 'verification' | 'dispute' | 'message'

const maxEvidenceFileBytes = 5 * 1024 * 1024
const supportedEvidenceTypes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
])

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  return btoa(binary)
}

const handleUploadResponse = async (response: Response) => {
  const text = await response.text()
  let data: any = {}

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (!response.ok) {
    throw new Error(data.message || 'Unable to upload evidence right now')
  }

  return data
}

const normalizePublicEvidenceUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) {
    return url
  }

  if (typeof window !== 'undefined') {
    return new URL(url, window.location.origin).toString()
  }

  return url
}

export const uploadEvidenceFile = async (
  category: EvidenceUploadCategory,
  file: File,
) => {
  if (!supportedEvidenceTypes.has(file.type)) {
    throw new Error('Only PDF, PNG, JPG, and WEBP files are supported')
  }

  if (file.size > maxEvidenceFileBytes) {
    throw new Error('Evidence files must be 5 MB or smaller')
  }

  const token = localStorage.getItem('jobwahala_token')

  if (!token) {
    throw new Error('You need to be signed in to upload evidence')
  }

  const dataBase64 = arrayBufferToBase64(await file.arrayBuffer())
  const response = await fetch(`${API_ROOT}/uploads/evidence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      category,
      fileName: file.name,
      contentType: file.type,
      dataBase64,
    }),
  })

  const data = await handleUploadResponse(response)

  if (data?.file?.url) {
    data.file.url = normalizePublicEvidenceUrl(data.file.url)
  }

  return data
}

export const evidenceUploadConstraints = {
  maxEvidenceFileBytes,
  supportedContentTypes: Array.from(supportedEvidenceTypes),
} as const
