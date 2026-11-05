import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiUpdateProfile } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

/** Job seekers choose whether employers on a Business plan can find them in the CV database. Off unless they switch it on. */
export default function CvVisibilityToggle() {
  const { user, refreshUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const visible = Boolean(user?.jobSeekerProfile?.visibleToEmployers)

  const change = async (next: boolean) => {
    setError('')
    setBusy(true)
    try {
      await apiUpdateProfile({ visibleToEmployers: next })
      await refreshUser()
    } catch (err) {
      setError(getErrorMessage(err, 'We could not save that choice.'))
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <section className="dashboard-panel mb-8 p-4 sm:p-6" aria-label="Let employers find me">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={visible} disabled={busy} onChange={(event) => void change(event.target.checked)} className="mt-1" />
        <span>
          <span className="block text-base font-black text-text-main">Let employers find my CV</span>
          <span className="block text-sm font-medium text-text-muted">
            Employers on a Business plan can find your name, skills and CV. Your email and phone number stay private. You can switch this off at any time.
          </span>
        </span>
      </label>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </section>
  )
}
