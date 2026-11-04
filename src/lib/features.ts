import { useEffect, useSyncExternalStore } from 'react'
import { apiGetPlatformConfig } from './api'

type Features = { loaded: boolean; freelanceEnabled: boolean }

// Hidden until the server says otherwise, so freelance links never flash on screen while it loads.
let state: Features = { loaded: false, freelanceEnabled: false }
let started = false
const listeners = new Set<() => void>()

const setState = (next: Features) => {
  state = next
  listeners.forEach((listener) => listener())
}

const start = () => {
  if (started) return
  started = true
  Promise.resolve()
    .then(() => apiGetPlatformConfig())
    .then((res: { config?: { freelanceEnabled?: boolean } }) =>
      setState({ loaded: true, freelanceEnabled: Boolean(res?.config?.freelanceEnabled) }),
    )
    // If the check fails, stay on the safe side: freelance stays hidden.
    .catch(() => setState({ loaded: true, freelanceEnabled: false }))
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useFeatures(): Features {
  useEffect(start, [])
  return useSyncExternalStore(subscribe, () => state, () => state)
}

/** Pages that only exist while freelance gigs are switched on. */
const FREELANCE_PATH = /^\/(freelancers|proposals|agreements)(\/|\?|#|$)/
export const isFreelancePath = (href: string) => FREELANCE_PATH.test(href)

/** For tests: set the flags without a network call. */
export const setFeaturesForTests = (next: Partial<Features>) => {
  started = true
  setState({ ...state, loaded: true, ...next })
}
