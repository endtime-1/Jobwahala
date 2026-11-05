/** Google OAuth client id (public). Empty means "Continue with Google" is off for this build. */
export const getGoogleClientId = () => ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '').trim()

type GoogleId = {
  initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: string; auto_select?: boolean }) => void
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } }
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'
let loading: Promise<GoogleId> | null = null

/** Loads Google's sign-in script the first time it is needed, so pages that never show the button do not pay for it. */
export const loadGoogleIdentity = (): Promise<GoogleId> => {
  const ready = window.google?.accounts?.id
  if (ready) return Promise.resolve(ready)
  if (loading) return loading

  loading = new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else reject(new Error('Google sign-in did not load.'))
    }
    script.onerror = () => reject(new Error('Google sign-in did not load.'))
    document.head.appendChild(script)
  }).catch((error) => {
    loading = null
    throw error
  })
  return loading
}

export const resetGoogleLoaderForTests = () => {
  loading = null
}
