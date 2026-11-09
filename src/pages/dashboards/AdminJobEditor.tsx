import { type FormEvent, useState } from 'react'
import { apiUpdateAdminJobContent } from '../../lib/api'

type AdminJobEditorProps = {
  job: { id: string; title: string; description: string }
  onSaved: () => void
}

/** Lets an admin fix a typo in a job's title or text (with the employer's permission). The change and the reason go in the admin action log. */
export default function AdminJobEditor({ job, onSaved }: AdminJobEditorProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(job.title)
  const [description, setDescription] = useState(job.description)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const field = 'w-full rounded-xl border border-surface-border bg-white px-4 py-2 text-sm font-semibold text-text-main'

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiUpdateAdminJobContent(job.id, {
        ...(title.trim() !== job.title ? { title: title.trim() } : {}),
        ...(description.trim() !== job.description ? { description: description.trim() } : {}),
        reason: reason.trim(),
      })
      setOpen(false)
      setReason('')
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the change')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-surface-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted transition-all hover:border-primary hover:text-primary"
      >
        Edit text
      </button>
    )
  }

  return (
    <form onSubmit={save} className="mt-4 w-full space-y-3 rounded-2xl border border-surface-border bg-white p-4" aria-label={`Edit ${job.title}`}>
      <p className="text-xs font-bold text-text-muted">Only fix mistakes, and only with the employer&apos;s permission. This change is saved in the action log with your reason.</p>
      <label className="block text-xs font-black text-text-main">
        Job title
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} className={`${field} mt-1`} />
      </label>
      <label className="block text-xs font-black text-text-main">
        Job text
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={8} maxLength={5000} className={`${field} mt-1`} />
      </label>
      <label className="block text-xs font-black text-text-main">
        Why (saved in the log)
        <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Typo, employer agreed by WhatsApp" className={`${field} mt-1`} />
      </label>
      {error ? <p role="alert" className="text-xs font-bold text-red-600">{error}</p> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={saving || reason.trim().length < 3} className="btn btn-primary px-5 py-2 text-xs disabled:opacity-50">
          {saving ? 'Saving…' : 'Save change'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-surface-border px-5 py-2 text-xs font-black text-text-muted">
          Cancel
        </button>
      </div>
    </form>
  )
}
