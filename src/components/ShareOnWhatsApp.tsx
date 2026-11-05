import { Share2 } from 'lucide-react'
import { whatsappShareUrl, type ShareableJob } from '../lib/whatsapp'

type Props = {
  job: ShareableJob
  /** "icon" is a small round button for job cards; "labelled" says "Share on WhatsApp". */
  variant?: 'icon' | 'labelled'
  className?: string
}

/** Opens WhatsApp with the job already written out: title, company, location, pay and the link. */
export default function ShareOnWhatsApp({ job, variant = 'icon', className = '' }: Props) {
  const href = whatsappShareUrl(job)
  const label = `Share ${job.title} on WhatsApp`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title="Share on WhatsApp"
      // On a job card the whole card is a link: sharing must not also open the job.
      onClick={(event) => event.stopPropagation()}
      className={
        variant === 'labelled'
          ? `inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#1ebe5b] ${className}`
          : `inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg text-text-light transition hover:bg-[#25d366]/10 hover:text-[#1ebe5b] ${className}`
      }
    >
      <Share2 className={variant === 'labelled' ? 'h-4 w-4' : 'h-4 w-4'} aria-hidden />
      {variant === 'labelled' ? 'Share on WhatsApp' : <span className="sr-only">Share on WhatsApp</span>}
    </a>
  )
}
