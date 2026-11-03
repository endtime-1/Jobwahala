import { useMemo, useState, type KeyboardEvent } from 'react'
import { ArrowRight, Clock, MapPin, Plus, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { parseSkills, rankJobsForSkills } from '../../lib/matchPreview'
import { companyOf, recentAge, type LandingJob } from './types'

const SUGGESTIONS = ['Customer service', 'Excel', 'Accounting', 'Graphic design', 'Writing', 'Sales', 'React', 'Hospitality']

type MatchLabProps = {
  jobs: LandingJob[]
  isLoading: boolean
}

export default function MatchLab({ jobs, isLoading }: MatchLabProps) {
  const [skills, setSkills] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  const matches = useMemo(() => rankJobsForSkills(skills, jobs, 3), [skills, jobs])
  const newest = useMemo(
    () =>
      [...jobs]
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 2),
    [jobs],
  )

  const addSkills = (raw: string) => {
    const next = parseSkills([...skills, raw].join(','))
    setSkills(next)
    setDraft('')
  }

  const toggleSuggestion = (skill: string) =>
    setSkills((current) =>
      current.some((item) => item.toLowerCase() === skill.toLowerCase())
        ? current.filter((item) => item.toLowerCase() !== skill.toLowerCase())
        : parseSkills([...current, skill].join(',')),
    )

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) {
      event.preventDefault()
      addSkills(draft)
    } else if (event.key === 'Backspace' && !draft && skills.length) {
      setSkills(skills.slice(0, -1))
    }
  }

  return (
    <div className="rounded-[2rem] border border-white/80 bg-white/85 p-4 shadow-premium-xl backdrop-blur-xl sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Match Lab · no signup</p>
          <h2 className="text-lg font-black leading-tight text-text-main sm:text-xl">What are you good at?</h2>
        </div>
      </div>

      <label htmlFor="match-lab-input" className="sr-only">
        Add your skills
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-surface-border bg-surface-alt/40 p-2.5 focus-within:border-secondary focus-within:bg-white">
        {skills.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-white">
            {skill}
            <button
              type="button"
              aria-label={`Remove ${skill}`}
              onClick={() => setSkills(skills.filter((item) => item !== skill))}
              className="rounded-full p-0.5 hover:bg-white/25"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id="match-lab-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={skills.length ? 'Add another…' : 'e.g. Excel, customer service'}
          enterKeyHint="done"
          className="min-h-9 min-w-[8rem] flex-1 bg-transparent px-1 text-sm font-semibold text-text-main outline-none placeholder:text-text-light"
        />
        <button
          type="button"
          onClick={() => draft.trim() && addSkills(draft)}
          disabled={!draft.trim()}
          aria-label="Add skill"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => {
          const active = skills.some((item) => item.toLowerCase() === suggestion.toLowerCase())
          return (
            <button
              key={suggestion}
              type="button"
              aria-pressed={active}
              onClick={() => toggleSuggestion(suggestion)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                active
                  ? 'border-secondary bg-secondary-light text-secondary'
                  : 'border-surface-border bg-white text-text-muted hover:border-secondary/40 hover:text-text-main'
              }`}
            >
              {suggestion}
            </button>
          )
        })}
      </div>

      <div className="mt-5 space-y-3" aria-live="polite">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-surface-alt/60" />
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-border p-5 text-center">
            <p className="text-sm font-bold text-text-main">New roles land here first.</p>
            <p className="mt-1 text-xs font-medium text-text-muted">Create a profile now and employers can find you.</p>
          </div>
        ) : skills.length === 0 ? (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-text-light">Open roles</p>
            {newest.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
            <p className="text-center text-xs font-semibold text-text-muted">Add a skill above to see your match score.</p>
          </>
        ) : matches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-border p-5 text-center">
            <p className="text-sm font-bold text-text-main">No open role matches that yet.</p>
            <p className="mt-1 text-xs font-medium text-text-muted">
              Create a profile and employers who post later can find you.
            </p>
            <Link to="/onboarding?role=seeker" className="mt-3 inline-flex items-center gap-1 text-sm font-black text-secondary hover:underline">
              Create my profile <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          matches.map(({ job, score, matched }) => <JobRow key={job.id} job={job} score={score} matched={matched} />)
        )}
      </div>

      {jobs.length > 0 && (
        <Link to="/jobs" className="mt-4 flex items-center justify-center gap-1 text-sm font-black text-secondary hover:underline">
          See all {jobs.length} open {jobs.length === 1 ? 'role' : 'roles'} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}

function JobRow({ job, score, matched }: { job: LandingJob; score?: number; matched?: string[] }) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block rounded-2xl border border-surface-border bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-premium-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-black text-text-main">{job.title}</p>
          <p className="truncate text-xs font-semibold text-text-muted">{companyOf(job)}</p>
        </div>
        {score !== undefined && (
          <span className="flex-none rounded-xl bg-success/12 px-2.5 py-1 text-sm font-black text-success">{score}%</span>
        )}
      </div>

      {score !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-alt" aria-hidden>
          <div className="h-full rounded-full bg-gradient-to-r from-secondary to-success" style={{ width: `${score}%` }} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-text-light">
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {job.location}
          </span>
        )}
        {recentAge(job.createdAt) && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {recentAge(job.createdAt)}
          </span>
        )}
        {matched?.length ? <span className="text-secondary">Matches: {matched.slice(0, 3).join(', ')}</span> : null}
      </div>
    </Link>
  )
}
