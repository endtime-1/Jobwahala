import { useEffect, useState } from 'react'

const rawApiUrl = import.meta.env.VITE_API_URL?.trim()
const API_ROOT = rawApiUrl ? rawApiUrl.replace(/\/$/, '') : '/api'

// Signed links last 5 minutes; images on screen get a fresh one a little before that.
const REFRESH_AFTER_MS = 4 * 60 * 1000

const PRIVATE_UPLOAD_PATH = /^\/api\/uploads\/(verification|dispute|message|cv)\/[^/]+$/

/** True for uploaded ID documents, dispute evidence and message attachments (not logos or pasted links). */
export const isProtectedUploadUrl = (value: string | null | undefined) => {
  if (!value) return false

  try {
    return PRIVATE_UPLOAD_PATH.test(new URL(value, 'http://placeholder.invalid').pathname)
  } catch {
    return false
  }
}

/** Turns the site path returned by the server into an address the browser can open. */
export const resolveSignedUrl = (signedPath: string, apiRoot = API_ROOT) => {
  if (!/^https?:\/\//i.test(apiRoot)) return signedPath

  return new URL(signedPath, new URL(apiRoot).origin).toString()
}

export const requestSignedUrl = async (url: string) => {
  const token = localStorage.getItem('jobwahala_token')

  if (!token) {
    throw new Error('Sign in to open this file')
  }

  const response = await fetch(`${API_ROOT}/uploads/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  })
  const data = await response.json().catch(() => null)

  if (!response.ok || !data?.url) {
    throw new Error(data?.message || 'You do not have access to this file')
  }

  return data.protected ? resolveSignedUrl(data.url) : (data.url as string)
}

/**
 * Opens a private file in a new tab. The tab is opened straight away (so pop-up blockers allow it)
 * and sent to the short-lived signed link as soon as the server approves.
 */
export const openProtectedFile = async (url: string, onError?: (message: string) => void) => {
  const tab = window.open('', '_blank')
  if (tab) tab.opener = null

  try {
    const signed = await requestSignedUrl(url)

    if (tab) {
      tab.location.href = signed
    } else {
      window.location.assign(signed)
    }
  } catch (error) {
    tab?.close()
    const message = error instanceof Error ? error.message : 'Unable to open this file'

    if (onError) onError(message)
    else window.alert(message)
  }
}

/** A usable address for showing a private image inline; null while it is being fetched. */
export const useProtectedUrl = (url: string | null | undefined) => {
  const [signed, setSigned] = useState<{ source: string; url: string } | null>(null)
  const protectedFile = isProtectedUploadUrl(url)

  useEffect(() => {
    if (!url || !protectedFile) return undefined

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const refresh = () => {
      requestSignedUrl(url)
        .then((next) => {
          if (cancelled) return
          setSigned({ source: url, url: next })
          timer = setTimeout(refresh, REFRESH_AFTER_MS)
        })
        .catch(() => {
          if (!cancelled) setSigned(null)
        })
    }

    refresh()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [url, protectedFile])

  if (!url) return null
  if (!protectedFile) return url

  return signed?.source === url ? signed.url : null
}
