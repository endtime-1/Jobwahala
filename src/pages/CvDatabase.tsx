import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import EvidenceLink from '../components/EvidenceLink'
import SEO from '../components/SEO'
import { apiSearchCvDatabase } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

type Entry = {
  id: string
  name: string
  skills: string | null
  experience: string
  careerStage: string | null
  institution: string | null
  programme: string | null
  cv: { url: string; fileName: string | null } | null
}
type Result = { total: number; page: number; entries: Entry[] }

const STAGES = [
  { value: '', label: 'Everyone' },
  { value: 'student', label: 'Students' },
  { value: 'nss', label: 'NSS personnel' },
  { value: 'graduate', label: 'Graduates' },
]

/** Business plans: search job seekers who chose to be found. Summaries only; contact details are never shown. */
export default function CvDatabase() {
  const [q, setQ] = useState('')
  const [stage, setStage] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Result | null>(null)
  const [needsPlan, setNeedsPlan] = useState(false)
  const [error, setError] = useState('')

  const search = useCallback(async (nextPage: number, query: string, nextStage: string) => {
    try {
      const params: Record<string, string> = { page: String(nextPage) }
      if (query.trim()) params.q = query.trim()
      if (nextStage) params.stage = nextStage
      setResult((await apiSearchCvDatabase(params)) as Result)
      setNeedsPlan(false)
      setError('')
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'PLAN_REQUIRED') setNeedsPlan(true)
      else setError(getErrorMessage(err, 'We could not search the CV database.'))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const first = (await apiSearchCvDatabase({ page: '1' })) as Result
        if (!cancelled) setResult(first)
      } catch (err) {
        if (cancelled) return
        if ((err as { code?: string }).code === 'PLAN_REQUIRED') setNeedsPlan(true)
        else setError(getErrorMessage(err, 'We could not search the CV database.'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    void search(1, q, stage)
  }
  const go = (next: number) => {
    setPage(next)
    void search(next, q, stage)
  }

  return (
    <div className="container max-w-4xl pb-24 pt-28">
      <SEO title="CV database" noindex />
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-text-main">CV database</h1>
        <p className="mt-2 text-base font-medium text-text-muted">Job seekers who chose to be found by employers. You see a summary and their CV; contact is through your jobs.</p>
      </header>

      {needsPlan ? (
        <div role="alert" className="rounded-2xl border border-gold/40 bg-gold/10 p-6">
          <p className="text-base font-bold text-text-main">The CV database is part of the Business plan.</p>
          <Link to="/plans" className="btn btn-primary btn-sm mt-4 inline-flex">
            See plans
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm font-bold text-text-main">
              Skills, course or experience
              <input value={q} onChange={(event) => setQ(event.target.value)} className="mt-1 w-full" placeholder="e.g. bookkeeping excel" />
            </label>
            <label className="block text-sm font-bold text-text-main">
              Who
              <select value={stage} onChange={(event) => setStage(event.target.value)} className="mt-1 h-11 w-full">
                {STAGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-primary btn-sm px-6">
              Search
            </button>
          </form>

          {error ? (
            <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
              {error}
            </p>
          ) : null}

          {result ? (
            <>
              <p className="mb-3 text-sm font-bold text-text-muted">{result.total} {result.total === 1 ? 'person' : 'people'} found</p>
              <ul className="space-y-3">
                {result.entries.map((entry) => (
                  <li key={entry.id} className="rounded-2xl border border-surface-border bg-white p-5">
                    <h2 className="text-base font-extrabold text-text-main">{entry.name}</h2>
                    {entry.programme || entry.institution ? <p className="text-sm font-semibold text-text-muted">{[entry.programme, entry.institution].filter(Boolean).join(' · ')}</p> : null}
                    {entry.skills ? <p className="mt-2 text-sm font-semibold text-text-main">Skills: {entry.skills}</p> : null}
                    {entry.experience ? <p className="mt-1 text-sm font-medium text-text-muted">{entry.experience}</p> : null}
                    {entry.cv ? (
                      <EvidenceLink href={entry.cv.url} className="mt-3 inline-block text-sm font-bold text-primary hover:underline">
                        Open CV{entry.cv.fileName ? ` (${entry.cv.fileName})` : ''}
                      </EvidenceLink>
                    ) : (
                      <p className="mt-3 text-xs font-semibold text-text-light">No CV file</p>
                    )}
                  </li>
                ))}
              </ul>
              {result.total > 20 ? (
                <div className="mt-6 flex gap-3">
                  <button type="button" disabled={page <= 1} onClick={() => go(page - 1)} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
                    Previous
                  </button>
                  <button type="button" disabled={page * 20 >= result.total} onClick={() => go(page + 1)} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
                    Next
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
