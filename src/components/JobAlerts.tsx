import { useCallback, useEffect, useState } from 'react'
import { Bell, BellRing, Mail, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiCreateSavedSearch, apiDeleteSavedSearch, apiGetSavedSearches, apiUpdateSavedSearch } from '../lib/api'
import { describeAlert, hasAlertCriteria, type AlertCriteria, type SavedSearch } from '../lib/jobAlerts'
import { getErrorMessage } from '../lib/errors'

type JobAlertsProps = {
  criteria: AlertCriteria
  isSignedIn: boolean
  isSeeker: boolean
}

export default function JobAlerts({ criteria, isSignedIn, isSeeker }: JobAlertsProps) {
  const [alerts, setAlerts] = useState<SavedSearch[]>([])
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiGetSavedSearches()
      setAlerts(Array.isArray(data.savedSearches) ? data.savedSearches : [])
      if (typeof data.limit === 'number') setLimit(data.limit)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load your alerts.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSignedIn && isSeeker) void load()
  }, [isSignedIn, isSeeker, load])

  const save = async () => {
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      await apiCreateSavedSearch(criteria)
      setNotice('Alert saved. We will notify you when a matching job is posted.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save this alert.'))
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEmail = async (alert: SavedSearch) => {
    setError('')
    setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, emailAlerts: !item.emailAlerts } : item)))
    try {
      await apiUpdateSavedSearch(alert.id, { emailAlerts: !alert.emailAlerts })
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update this alert.'))
      await load()
    }
  }

  const remove = async (alert: SavedSearch) => {
    setError('')
    try {
      await apiDeleteSavedSearch(alert.id)
      setAlerts((current) => current.filter((item) => item.id !== alert.id))
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete this alert.'))
    }
  }

  if (!isSignedIn) {
    return (
      <section className="dashboard-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-text-main">
          <Bell className="h-4 w-4 text-secondary" /> Never miss a role: get an alert when a job matches your search.
        </p>
        <Link to="/login" className="btn btn-outline btn-sm justify-center">
          Log in to set alerts
        </Link>
      </section>
    )
  }

  if (!isSeeker) return null

  const canSave = hasAlertCriteria(criteria)
  const atLimit = alerts.length >= limit

  return (
    <section className="dashboard-panel space-y-4 p-4 sm:p-5" aria-label="Job alerts">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-text-main">
            <BellRing className="h-4 w-4 text-secondary" /> Job alerts
          </h2>
          <p className="mt-1 text-xs font-medium text-text-muted">
            {canSave
              ? `Alert me about: ${describeAlert(criteria)}`
              : 'Type a keyword or pick a job type above, then save it as an alert.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave || isSaving || atLimit}
          className="btn btn-primary btn-sm justify-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Alert me'}
        </button>
      </div>

      {atLimit && <p className="text-xs font-semibold text-text-muted">You have {limit} alerts, the maximum. Remove one to add another.</p>}
      {notice && <p className="text-xs font-bold text-success">{notice}</p>}
      {error && <p className="text-xs font-bold text-error">{error}</p>}

      {isLoading && alerts.length === 0 ? (
        <div className="h-10 animate-pulse rounded-xl bg-surface-alt/60" />
      ) : alerts.length > 0 ? (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-border bg-white px-3 py-2"
            >
              <span className="text-sm font-bold text-text-main">{describeAlert(alert)}</span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={alert.emailAlerts}
                  onClick={() => void toggleEmail(alert)}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-black uppercase tracking-wider ${
                    alert.emailAlerts ? 'border-secondary/40 bg-secondary-light text-secondary' : 'border-surface-border text-text-muted'
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" /> Email {alert.emailAlerts ? 'on' : 'off'}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(alert)}
                  aria-label={`Delete alert ${describeAlert(alert)}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-text-muted hover:text-error"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
