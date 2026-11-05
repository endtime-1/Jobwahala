import { useState } from 'react'
import { Star } from 'lucide-react'
import { apiSaveApplicationReview } from '../../../lib/api'
import { getErrorMessage } from '../../../lib/errors'
import type { ApplicantReview } from './types'

type Props = {
  applicationId: string
  applicantName: string
  review?: ApplicantReview | null
}

/** The employer's private 1-5 rating and notes on one applicant. The applicant never sees these. */
export default function ApplicantReviewBox({ applicationId, applicantName, review }: Props) {
  const [rating, setRating] = useState<number | null>(review?.rating ?? null)
  const [note, setNote] = useState(review?.note ?? '')
  const [saved, setSaved] = useState({ rating: review?.rating ?? null, note: review?.note ?? '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  const dirty = rating !== saved.rating || note.trim() !== saved.note.trim()

  const save = async () => {
    setBusy(true)
    setMessage('')
    setFailed(false)
    try {
      // Only what changed is sent, so a quick star tap never overwrites a note typed on another screen.
      const body: { rating?: number | null; note?: string } = {}
      if (rating !== saved.rating) body.rating = rating
      if (note.trim() !== saved.note.trim()) body.note = note.trim()
      await apiSaveApplicationReview(applicationId, body)
      setSaved({ rating, note: note.trim() })
      setNote(note.trim())
      setMessage('Saved')
    } catch (err) {
      setFailed(true)
      setMessage(getErrorMessage(err, 'We could not save that. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-surface-border bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Your private notes</p>
      <p className="mt-1 text-xs font-medium text-text-muted">Only you can see these. {applicantName} never does.</p>

      <div role="group" aria-label={`Rating for ${applicantName}`} className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            aria-pressed={rating !== null && value <= rating}
            onClick={() => setRating(rating === value ? null : value)}
            className="rounded p-1 text-gold hover:scale-110"
          >
            <Star className={`h-5 w-5 ${rating !== null && value <= rating ? 'fill-current' : ''}`} aria-hidden />
          </button>
        ))}
        {rating ? <span className="ml-2 text-xs font-bold text-text-muted">{rating} of 5</span> : <span className="ml-2 text-xs font-medium text-text-light">Not rated</span>}
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={2000}
        rows={3}
        aria-label={`Private notes about ${applicantName}`}
        placeholder="Things to remember, questions to ask..."
        className="mt-3 w-full rounded-xl border border-surface-border p-3 text-sm font-medium text-text-main"
      />

      <div className="mt-2 flex items-center gap-3">
        <button type="button" disabled={busy || !dirty} onClick={() => void save()} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
          {busy ? 'Saving...' : 'Save notes'}
        </button>
        {message ? (
          <span role={failed ? 'alert' : 'status'} className={`text-xs font-bold ${failed ? 'text-error' : 'text-success'}`}>
            {message}
          </span>
        ) : null}
      </div>
    </div>
  )
}
