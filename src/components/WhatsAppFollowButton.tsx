import { whatsappChannelUrl } from '../lib/whatsapp'

/** The WhatsApp logo (lucide has no brand icons). */
export function WhatsAppIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.8a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26C2.17 6.45 6.6 2.03 12.05 2.03c2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c0 5.45-4.43 9.88-9.89 9.88zM20.5 3.5A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.65a11.88 11.88 0 0 0 5.75 1.47h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.45-8.42z" />
    </svg>
  )
}

type Props = { variant?: 'button' | 'footer' | 'banner'; className?: string }

/** "Follow on WhatsApp": links to the JobWahala channel. */
export default function WhatsAppFollowButton({ variant = 'button', className = '' }: Props) {
  const url = whatsappChannelUrl()

  if (variant === 'footer') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 text-base font-medium text-white/65 transition-colors hover:text-gold ${className}`}>
        <WhatsAppIcon /> Follow on WhatsApp
      </a>
    )
  }

  if (variant === 'banner') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#25d366] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-[#1ebe5b] ${className}`}
      >
        <WhatsAppIcon className="h-5 w-5" /> Follow our channel
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#25d366] bg-white px-4 py-2 text-sm font-extrabold text-[#128c4a] transition-colors hover:bg-[#25d366] hover:text-white ${className}`}
    >
      <WhatsAppIcon /> Follow on WhatsApp
    </a>
  )
}
