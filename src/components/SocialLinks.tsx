import { Facebook, Instagram, Linkedin } from 'lucide-react'
import type { ReactNode } from 'react'
import { resolveSocialLinks, type SocialKey } from '../content/social'
import { WhatsAppIcon } from './WhatsAppFollowButton'

const Svg = ({ d, className }: { d: string; className: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d={d} />
  </svg>
)

const icons: Record<SocialKey, (className: string) => ReactNode> = {
  whatsapp: (className) => <WhatsAppIcon className={className} />,
  linkedin: (className) => <Linkedin className={className} aria-hidden />,
  facebook: (className) => <Facebook className={className} aria-hidden />,
  instagram: (className) => <Instagram className={className} aria-hidden />,
  tiktok: (className) => <Svg className={className} d="M16.6 2h-3.1v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.2a6 6 0 1 0 5.1 5.9V8.6a7.4 7.4 0 0 0 4.3 1.4V6.9a4.3 4.3 0 0 1-4.3-4.9z" />,
  x: (className) => <Svg className={className} d="M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.8L5.2 22H2l7.7-8.8L1.5 2h6.7l4.7 6.2L18.9 2zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20z" />,
}

type Props = { variant?: 'footer' | 'about'; className?: string }

/** Round icon links to JobWahala's social profiles. A network with no link set is not shown; with none set, nothing is. */
export default function SocialLinks({ variant = 'footer', className = '' }: Props) {
  const links = resolveSocialLinks(import.meta.env)
  if (links.length === 0) return null

  const style =
    variant === 'footer'
      ? 'h-10 w-10 border border-white/20 bg-white/10 text-white hover:bg-gold hover:text-primary'
      : 'h-12 w-12 border border-surface-border bg-white text-primary hover:bg-primary hover:text-white'

  return (
    <ul aria-label="JobWahala on social media" className={`flex flex-wrap items-center gap-3 ${className}`}>
      {links.map((link) => (
        <li key={link.key}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer me"
            aria-label={`JobWahala on ${link.label}`}
            title={link.label}
            className={`inline-flex items-center justify-center rounded-full transition-colors ${style}`}
          >
            {icons[link.key](variant === 'footer' ? 'h-5 w-5' : 'h-6 w-6')}
          </a>
        </li>
      ))}
    </ul>
  )
}
