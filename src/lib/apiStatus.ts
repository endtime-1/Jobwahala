export const API_UNAVAILABLE_MESSAGE =
  'Unable to reach JobWahala right now. The backend API appears unavailable. Run npm run dev:backend in the project root, or npm run dev:all to start both apps, then try again.'

const rawApiUrl = import.meta.env.VITE_API_URL?.trim()
const API_ROOT = rawApiUrl ? rawApiUrl.replace(/\/$/, '') : '/api'

export type ApiStatus =
  | {
      kind: 'healthy'
      message: ''
      updatedAt: number
    }
  | {
      kind: 'unreachable'
      message: string
      updatedAt: number
    }

let currentStatus: ApiStatus = {
  kind: 'healthy',
  message: '',
  updatedAt: Date.now(),
}

const listeners = new Set<() => void>()

const emitChange = () => {
  listeners.forEach((listener) => listener())
}

export const subscribeApiStatus = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getApiStatus = () => currentStatus

export const isApiUnavailableMessage = (message?: string | null) =>
  (message || '').trim() === API_UNAVAILABLE_MESSAGE

export const markApiHealthy = () => {
  if (currentStatus.kind === 'healthy') return

  currentStatus = {
    kind: 'healthy',
    message: '',
    updatedAt: Date.now(),
  }
  emitChange()
}

export const markApiUnreachable = (message = API_UNAVAILABLE_MESSAGE) => {
  if (currentStatus.kind === 'unreachable' && currentStatus.message === message) return

  currentStatus = {
    kind: 'unreachable',
    message,
    updatedAt: Date.now(),
  }
  emitChange()
}

export const checkApiHealth = async () => {
  try {
    const response = await globalThis.fetch(`${API_ROOT.replace(/\/api$/, '')}/health`, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) {
      markApiUnreachable()
      return false
    }

    markApiHealthy()
    return true
  } catch {
    markApiUnreachable()
    return false
  }
}
