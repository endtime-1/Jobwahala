import { useState } from 'react'
import { apiAdminImportJobs, type AdminImportResult } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

const input = 'mt-1 w-full rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm font-semibold text-text-main outline-none focus:border-primary'
const label = 'block text-[10px] font-black uppercase tracking-[0.2em] text-text-light'

const STATUS_STYLE: Record<string, string> = {
  created: 'bg-emerald-100 text-emerald-800',
  would_create: 'bg-sky-100 text-sky-800',
  skipped: 'bg-amber-100 text-amber-800',
  invalid: 'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = { created: 'Created', would_create: 'Will be created', skipped: 'Skipped', invalid: 'Problem' }

/** Admin: import jobs from a CSV for a recruiter or company. Shows a preview first; rows whose title already exists for the company are skipped. */
export default function AdminJobImport({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [company, setCompany] = useState({ name: '', website: '', email: '', phone: '' })
  const [defaultType, setDefaultType] = useState('Full-time')
  const [defaultClosingDate, setDefaultClosingDate] = useState('')
  const [result, setResult] = useState<AdminImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const readFile = async (file: File | undefined) => {
    if (!file) return
    setCsv(await file.text())
    setFileName(file.name)
    setResult(null)
  }

  const run = async (dryRun: boolean) => {
    setBusy(true)
    setError('')
    setCopied(false)
    try {
      const data = await apiAdminImportJobs({ csv, company, defaultType, defaultClosingDate, dryRun })
      setResult(data)
      if (!dryRun) onImported?.()
    } catch (caught) {
      setError(getErrorMessage(caught, 'The import failed.'))
    } finally {
      setBusy(false)
    }
  }

  const links = result?.lines.filter((line) => line.path).map((line) => `${window.location.origin}${line.path}`) ?? []
  const ready = csv.trim().length > 0 && defaultClosingDate !== ''

  const copyLinks = async () => {
    await navigator.clipboard.writeText(result?.lines.filter((line) => line.path).map((line) => `${line.title}: ${window.location.origin}${line.path}`).join('\n') ?? '')
    setCopied(true)
  }

  if (!open) {
    return (
      <div className="rounded-3xl border border-surface-border bg-white/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Recruiters</p>
            <h2 className="text-xl font-black text-text-main">Import jobs from CSV</h2>
            <p className="text-sm font-semibold text-text-muted">Post many jobs at once on behalf of a recruiter or company.</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="btn btn-primary px-5 py-2.5 text-xs">
            Import jobs from CSV
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-5 rounded-3xl border border-surface-border bg-white/80 p-6" aria-label="Import jobs from CSV">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-text-main">Import jobs from CSV</h2>
          <p className="max-w-3xl text-sm font-semibold text-text-muted">
            Columns used: Job title, Company, Location, Region, Category, Job type, Salary, Closing date, Description, How to apply. Any other column is ignored. Jobs are shown as posted by JobWahala on behalf
            of the company. A row whose title already exists for the company is skipped, so you can safely run the same file again.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-black text-text-muted">
          Close
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>
          Company name (empty = the name in the file)
          <input className={input} value={company.name} onChange={(event) => setCompany({ ...company, name: event.target.value })} />
        </label>
        <label className={label}>
          Company website (for a new company)
          <input className={input} value={company.website} placeholder="example.com" onChange={(event) => setCompany({ ...company, website: event.target.value })} />
        </label>
        <label className={label}>
          Company email (for a new company)
          <input className={input} type="email" value={company.email} onChange={(event) => setCompany({ ...company, email: event.target.value })} />
        </label>
        <label className={label}>
          Company phone or WhatsApp (optional)
          <input className={input} value={company.phone} onChange={(event) => setCompany({ ...company, phone: event.target.value })} />
        </label>
        <label className={label}>
          Job type when a row says "Not specified"
          <input className={input} value={defaultType} onChange={(event) => setDefaultType(event.target.value)} />
        </label>
        <label className={label}>
          Closing date when a row has none
          <input className={input} type="date" value={defaultClosingDate} onChange={(event) => setDefaultClosingDate(event.target.value)} />
        </label>
      </div>

      <div>
        <label className={label}>
          CSV file
          <input type="file" accept=".csv,text/csv" className={input} onChange={(event) => void readFile(event.target.files?.[0])} />
        </label>
        {fileName ? <p className="mt-1 text-xs font-semibold text-text-muted">{fileName} loaded ({csv.length.toLocaleString('en-GB')} characters)</p> : null}
      </div>

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy || !ready} onClick={() => void run(true)} className="rounded-xl border border-surface-border bg-white px-5 py-2.5 text-xs font-black text-text-main disabled:opacity-50">
          Preview
        </button>
        <button
          type="button"
          disabled={busy || !ready || !result || !result.dryRun || result.counts.created === 0}
          onClick={() => void run(false)}
          className="btn btn-primary px-5 py-2.5 text-xs disabled:opacity-50"
        >
          {result?.dryRun && result.counts.created > 0 ? `Import ${result.counts.created} job${result.counts.created === 1 ? '' : 's'}` : 'Import'}
        </button>
      </div>

      {result ? (
        <div className="space-y-3">
          <p className="text-sm font-bold text-text-main" role="status">
            {result.company.name} ({result.company.exists ? 'existing company' : 'new company'}):{' '}
            {result.dryRun ? `${result.counts.created} will be created` : `${result.counts.created} created`}, {result.counts.skipped} skipped, {result.counts.invalid} with problems.
          </p>
          <ul className="divide-y divide-surface-border rounded-2xl border border-surface-border bg-white">
            {result.lines.map((line) => (
              <li key={`${line.line}-${line.title}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 font-bold text-text-main">
                  {line.title || `(row ${line.line})`}
                  {line.reason ? <span className="block text-xs font-semibold text-text-muted">{line.reason}</span> : null}
                </span>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${STATUS_STYLE[line.status]}`}>{STATUS_LABEL[line.status]}</span>
                {line.path ? (
                  <a href={line.path} target="_blank" rel="noreferrer" className="text-xs font-black text-primary">
                    {window.location.origin}
                    {line.path}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
          {links.length > 0 ? (
            <button type="button" onClick={() => void copyLinks()} className="rounded-xl border border-surface-border bg-white px-4 py-2 text-xs font-black text-text-main">
              {copied ? 'Copied' : `Copy ${links.length} job links`}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
