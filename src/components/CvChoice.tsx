import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CvFiles } from './CvManager'
import { apiGetMyCvFiles } from '../lib/api'

export type CvChoiceValue = 'UPLOADED' | 'BUILDER' | 'NONE'

type Props = {
  value: CvChoiceValue | null
  onChange: (value: CvChoiceValue) => void
}

/**
 * "Which CV do you want to send?" on the apply form. Offers only the CVs the member really has, starts on
 * the uploaded one (or the CV-builder one), and always allows sending none.
 */
export default function CvChoice({ value, onChange }: Props) {
  const [files, setFiles] = useState<CvFiles | null>(null)
  const report = useRef(onChange)

  useEffect(() => {
    report.current = onChange
  }, [onChange])

  useEffect(() => {
    let cancelled = false
    // Wrapped so a failure to ask (offline, or a test without this call) just means no picker.
    Promise.resolve()
      .then(() => apiGetMyCvFiles())
      .then((res: { uploaded?: CvFiles['uploaded']; builder?: CvFiles['builder'] }) => {
        if (cancelled) return
        const loaded = { uploaded: res.uploaded ?? null, builder: res.builder ?? null }
        setFiles(loaded)
        if (loaded.uploaded) report.current('UPLOADED')
        else if (loaded.builder) report.current('BUILDER')
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  if (!files) return null

  if (!files.uploaded && !files.builder) {
    return (
      <p className="rounded-2xl border border-surface-border bg-surface-alt/40 px-4 py-3 text-sm font-semibold text-text-muted">
        You have not added a CV yet. You can{' '}
        <Link to="/dashboard" className="font-bold text-primary hover:underline">
          upload one
        </Link>{' '}
        or{' '}
        <Link to="/cv-generator" className="font-bold text-primary hover:underline">
          make one
        </Link>{' '}
        to send with your applications.
      </p>
    )
  }

  const options: { value: CvChoiceValue; label: string; detail?: string }[] = [
    ...(files.uploaded ? [{ value: 'UPLOADED' as const, label: 'My uploaded CV', detail: files.uploaded.fileName }] : []),
    ...(files.builder ? [{ value: 'BUILDER' as const, label: 'My CV from the CV builder', detail: files.builder.fileName }] : []),
    { value: 'NONE' as const, label: 'Do not send a CV' },
  ]

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">CV to send</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm ${
            value === option.value ? 'border-secondary bg-secondary/5' : 'border-surface-border bg-white'
          }`}
        >
          <input
            type="radio"
            name="cv-choice"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-1"
          />
          <span>
            <span className="block font-bold text-text-main">{option.label}</span>
            {option.detail ? <span className="block text-xs font-medium text-text-muted">{option.detail}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
