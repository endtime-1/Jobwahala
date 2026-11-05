import { Bookmark } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSavedJobs } from '../lib/savedJobs'

type Props = {
  jobId: string
  /** "icon" is a small round bookmark for job cards; "labelled" is a full-width button with words. */
  variant?: 'icon' | 'labelled'
  className?: string
}

/**
 * Save or unsave a job. Job seekers save; a visitor who is not signed in is sent to log in;
 * employers and admins, who have no use for a saved list, do not see it.
 */
export default function SaveJobButton({ jobId, variant = 'icon', className = '' }: Props) {
  const { user, role } = useAuth()
  const { canSave, isSaved, toggle, error } = useSavedJobs()
  const navigate = useNavigate()

  if (user && !canSave) return null

  const saved = canSave && isSaved(jobId)
  const label = saved ? 'Remove from saved jobs' : 'Save this job'

  const onClick = (event: React.MouseEvent) => {
    // Cards are links; saving must not open the job.
    event.preventDefault()
    event.stopPropagation()
    if (!user || role !== 'SEEKER') {
      navigate('/login')
      return
    }
    void toggle(jobId)
  }

  if (variant === 'labelled') {
    return (
      <>
        <button
          type="button"
          onClick={onClick}
          aria-pressed={saved}
          className={`btn w-full rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all ${
            saved ? 'bg-secondary text-white shadow-secondary/20' : 'btn-outline border-surface-border text-text-muted hover:border-secondary hover:text-secondary'
          } ${className}`}
        >
          <Bookmark className={`h-4 w-4 ${saved ? 'fill-white' : ''}`} aria-hidden /> {saved ? 'Saved' : 'Save job'}
        </button>
        {error ? (
          <p role="alert" className="mt-2 text-xs font-bold text-error">
            {error}
          </p>
        ) : null}
      </>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-all ${
        saved
          ? 'border-secondary bg-secondary/10 text-secondary'
          : 'border-surface-border bg-surface text-text-muted hover:border-secondary hover:text-secondary'
      } ${className}`}
    >
      <Bookmark className={`h-5 w-5 ${saved ? 'fill-secondary' : ''}`} aria-hidden />
    </button>
  )
}
