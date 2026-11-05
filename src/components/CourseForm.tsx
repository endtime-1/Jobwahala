import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { SKILLS } from '../content/skills'
import { courseCategories, courseFormats, courseLevels, skillLabel } from '../lib/courses'
import { emptyCourseForm, toCoursePayload, type CourseFormValues } from '../lib/courseForm'
import { getErrorMessage } from '../lib/errors'

type Props = {
  initial?: CourseFormValues
  isEditing?: boolean
  onSubmit: (payload: ReturnType<typeof toCoursePayload>) => Promise<void>
  onCancel: () => void
}

export default function CourseForm({ initial = emptyCourseForm, isEditing = false, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<CourseFormValues>(initial)
  const [newDate, setNewDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (patch: Partial<CourseFormValues>) => setForm((current) => ({ ...current, ...patch }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (form.skills.length === 0) {
      setError('Choose at least one skill the course teaches.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await onSubmit(toCoursePayload(form))
    } catch (err) {
      setError(getErrorMessage(err, 'We could not save the course. Please check it and try again.'))
    } finally {
      setBusy(false)
    }
  }

  const addSkill = (slug: string) => {
    if (slug && !form.skills.includes(slug) && form.skills.length < 8) set({ skills: [...form.skills, slug] })
  }

  const field = 'mt-1 w-full text-sm font-semibold'

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-surface-border bg-white p-5 sm:p-6">
      <h3 className="text-lg font-black text-text-main">{isEditing ? 'Edit course' : 'New course'}</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-bold text-text-main md:col-span-2">
          Course title
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} required minLength={5} maxLength={120} className={field} />
        </label>
        <label className="block text-sm font-bold text-text-main md:col-span-2">
          One-line summary
          <input value={form.summary} onChange={(e) => set({ summary: e.target.value })} required minLength={10} maxLength={200} className={field} />
        </label>
        <label className="block text-sm font-bold text-text-main md:col-span-2">
          Full description
          <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} required minLength={20} maxLength={5000} rows={5} className={field} />
        </label>

        <label className="block text-sm font-bold text-text-main">
          Category
          <select value={form.category} onChange={(e) => set({ category: e.target.value })} className={field}>
            {courseCategories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold text-text-main">
          Level
          <select value={form.level} onChange={(e) => set({ level: e.target.value })} className={field}>
            {courseLevels.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-text-main">
            <input type="checkbox" checked={form.isFree} onChange={(e) => set({ isFree: e.target.checked })} />
            This course is free
          </label>
          {form.isFree ? null : (
            <label className="block text-sm font-bold text-text-main">
              Price (GHS)
              <input type="number" min={1} inputMode="numeric" value={form.priceGhs} onChange={(e) => set({ priceGhs: e.target.value })} required className={field} />
            </label>
          )}
        </div>
        <label className="block text-sm font-bold text-text-main">
          Duration (weeks)
          <input type="number" min={1} max={156} inputMode="numeric" value={form.durationWeeks} onChange={(e) => set({ durationWeeks: e.target.value })} className={field} />
        </label>

        <label className="block text-sm font-bold text-text-main">
          Format
          <select value={form.format} onChange={(e) => set({ format: e.target.value })} className={field}>
            {courseFormats.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </label>
        {form.format === 'ONLINE' ? null : (
          <label className="block text-sm font-bold text-text-main">
            Where are classes held?
            <input value={form.location} onChange={(e) => set({ location: e.target.value })} required maxLength={120} placeholder="e.g. Osu, Accra" className={field} />
          </label>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-text-main">Start dates</legend>
        <label className="flex items-center gap-2 text-sm font-bold text-text-main">
          <input type="checkbox" checked={form.rollingStart} onChange={(e) => set({ rollingStart: e.target.checked })} />
          Learners can start any time
        </label>
        {form.rollingStart ? null : (
          <>
            <div className="flex gap-2">
              <input type="date" aria-label="Add a start date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-11 w-48 text-sm font-semibold" />
              <button
                type="button"
                disabled={!newDate || form.startDates.includes(newDate)}
                onClick={() => {
                  set({ startDates: [...form.startDates, newDate].sort() })
                  setNewDate('')
                }}
                className="btn btn-outline btn-sm bg-white disabled:opacity-60"
              >
                Add date
              </button>
            </div>
            <ul className="flex flex-wrap gap-2">
              {form.startDates.map((date) => (
                <li key={date}>
                  <button type="button" onClick={() => set({ startDates: form.startDates.filter((value) => value !== date) })} aria-label={`Remove start date ${date}`} className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-3 py-1 text-xs font-bold text-text-main">
                    {date} <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-text-main">Skills this course teaches (up to 8)</legend>
        <select aria-label="Add a skill" value="" onChange={(e) => addSkill(e.target.value)} className="h-11 w-full max-w-sm text-sm font-semibold">
          <option value="">Choose a skill to add</option>
          {SKILLS.filter((skill) => !form.skills.includes(skill.slug)).map((skill) => (
            <option key={skill.slug} value={skill.slug}>
              {skill.name}
            </option>
          ))}
        </select>
        <ul className="flex flex-wrap gap-2">
          {form.skills.map((slug) => (
            <li key={slug}>
              <button type="button" onClick={() => set({ skills: form.skills.filter((value) => value !== slug) })} aria-label={`Remove skill ${skillLabel(slug)}`} className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">
                {skillLabel(slug)} <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-bold text-text-main">
          <input type="checkbox" checked={form.certificateOffered} onChange={(e) => set({ certificateOffered: e.target.checked })} />
          Learners get a certificate
        </label>
        <label className="block text-sm font-bold text-text-main">
          Enrolment link (optional if you take enquiries)
          <input type="url" value={form.enrolUrl} onChange={(e) => set({ enrolUrl: e.target.value })} placeholder="https://" className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-text-main">
          <input type="checkbox" checked={form.enquiryEnabled} onChange={(e) => set({ enquiryEnabled: e.target.checked })} />
          Let learners send enquiries on JobWahala
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-bold text-error">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm px-6 disabled:opacity-60">
          {busy ? 'Saving...' : isEditing ? 'Save changes' : 'Save course'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-outline btn-sm bg-white">
          Cancel
        </button>
      </div>
      <p className="text-xs font-medium text-text-light">New courses are checked by JobWahala before learners can see them. Changing the title, description, price or link sends a live course back for a quick check.</p>
    </form>
  )
}
