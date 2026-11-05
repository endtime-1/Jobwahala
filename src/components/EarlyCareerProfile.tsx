import { useState, type FormEvent } from 'react'
import { GraduationCap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiUpdateProfile } from '../lib/api'
import { careerStageLabel, careerStages } from '../lib/earlyCareer'
import { getErrorMessage } from '../lib/errors'

/**
 * "I am a student / doing National Service / a graduate", with where and what they study. It decides which
 * internships and graduate jobs are shown first on the Internships & NSS page.
 */
export default function EarlyCareerProfile() {
  const { user, refreshUser } = useAuth()
  const profile = user?.jobSeekerProfile

  const [stage, setStage] = useState(profile?.careerStage ?? '')
  const [institution, setInstitution] = useState(profile?.institution ?? '')
  const [programme, setProgramme] = useState(profile?.programme ?? '')
  const [year, setYear] = useState(profile?.completionYear ? String(profile.completionYear) : '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setFailed(false)
    try {
      const completionYear = year.trim() === '' ? null : Number(year)
      await apiUpdateProfile({ careerStage: stage, institution, programme, completionYear })
      await refreshUser()
      setMessage('Saved')
    } catch (err) {
      setFailed(true)
      setMessage(getErrorMessage(err, 'We could not save that. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="dashboard-panel p-5 sm:p-6">
      <div className="mb-4 border-b border-surface-border/50 pb-4">
        <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-main">
          <GraduationCap className="h-4 w-4 text-secondary" aria-hidden /> Student, NSS or graduate?
        </h3>
        <p className="mt-1 text-xs font-medium leading-relaxed text-text-muted">
          Tell us, and we show the internships and graduate jobs that suit you first.{' '}
          <Link to="/internships" className="font-bold text-primary hover:underline">
            See Internships &amp; NSS
          </Link>
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-bold text-text-main">
          I am
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="mt-1 h-12 w-full text-base font-semibold">
            <option value="">Not saying</option>
            {careerStages.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {stage ? (
          <>
            <label className="block text-sm font-bold text-text-main">
              {stage === 'GRADUATE' || stage === 'NSS' ? 'Institution you graduated from' : 'Institution'}
              <input value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={120} placeholder="e.g. University of Ghana" className="mt-1 h-12 w-full text-base font-semibold" />
            </label>
            <label className="block text-sm font-bold text-text-main">
              Programme
              <input value={programme} onChange={(e) => setProgramme(e.target.value)} maxLength={120} placeholder="e.g. BSc Computer Science" className="mt-1 h-12 w-full text-base font-semibold" />
            </label>
            <label className="block text-sm font-bold text-text-main">
              {stage === 'STUDENT' ? 'Expected completion year' : 'Year completed'}
              <input
                type="number"
                inputMode="numeric"
                min={1990}
                max={new Date().getFullYear() + 8}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder={String(new Date().getFullYear())}
                className="mt-1 h-12 w-full text-base font-semibold"
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
          {busy ? 'Saving...' : 'Save'}
        </button>
        {message ? (
          <span role={failed ? 'alert' : 'status'} className={`text-xs font-bold ${failed ? 'text-error' : 'text-success'}`}>
            {message}
          </span>
        ) : stage ? (
          <span className="text-xs font-semibold text-text-muted">{careerStageLabel(stage)}</span>
        ) : null}
      </div>
    </form>
  )
}
