import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiGetSavedJobIds, apiSaveJob, apiUnsaveJob } from './api'
import { getErrorMessage } from './errors'

/**
 * Which jobs the signed-in job seeker has saved, shared by every job card and the Saved jobs page.
 * It is one small list of ids fetched once per sign-in; saving and unsaving update it straight away
 * and put it back if the server says no.
 */
type State = { ids: ReadonlySet<string>; loadedFor: string | null; error: string }

let state: State = { ids: new Set(), loadedFor: null, error: '' }
let loading: string | null = null
const listeners = new Set<() => void>()

const setState = (next: Partial<State>) => {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const load = async (userId: string) => {
  if (loading === userId || state.loadedFor === userId) return
  loading = userId
  try {
    const res = (await apiGetSavedJobIds()) as { ids?: string[] }
    setState({ ids: new Set(res.ids ?? []), loadedFor: userId, error: '' })
  } catch {
    // Not being able to load the hearts is not worth an error banner; they just show as unsaved.
    setState({ loadedFor: userId })
  } finally {
    loading = null
  }
}

export function useSavedJobs() {
  const { user, role } = useAuth()
  const snapshot = useSyncExternalStore(subscribe, () => state)
  const userId = user?.id ?? null
  const canSave = role === 'SEEKER'

  useEffect(() => {
    if (!userId || !canSave) {
      if (state.loadedFor !== null) setState({ ids: new Set(), loadedFor: null, error: '' })
      return
    }
    if (state.loadedFor !== null && state.loadedFor !== userId) setState({ ids: new Set(), loadedFor: null })
    void load(userId)
  }, [userId, canSave])

  const toggle = useCallback(async (jobId: string) => {
    const before = state.ids
    const wasSaved = before.has(jobId)
    const after = new Set(before)
    if (wasSaved) after.delete(jobId)
    else after.add(jobId)
    setState({ ids: after, error: '' })

    try {
      if (wasSaved) await apiUnsaveJob(jobId)
      else await apiSaveJob(jobId)
      return true
    } catch (err) {
      setState({ ids: before, error: getErrorMessage(err, 'We could not save that. Please try again.') })
      return false
    }
  }, [])

  /** After the Saved jobs page removes one from its own list. */
  const forget = useCallback((jobId: string) => {
    const next = new Set(state.ids)
    next.delete(jobId)
    setState({ ids: next })
  }, [])

  return { canSave, isSaved: (jobId: string) => snapshot.ids.has(jobId), toggle, forget, error: snapshot.error }
}

export const resetSavedJobsForTests = () => {
  state = { ids: new Set(), loadedFor: null, error: '' }
  loading = null
  listeners.forEach((listener) => listener())
}
