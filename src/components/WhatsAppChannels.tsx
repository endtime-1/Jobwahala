import { MessageCircle } from 'lucide-react'
import { getWhatsAppChannels, type WhatsAppChannel } from '../lib/whatsapp'

type Props = {
  /** Which channels to offer. Leave out to offer every channel that has been set up. */
  only?: WhatsAppChannel['key'][]
  variant?: 'panel' | 'footer'
}

/** Links to the JobWahala WhatsApp channels. Shows nothing until a channel link has been set. */
export default function WhatsAppChannels({ only, variant = 'panel' }: Props) {
  const channels = getWhatsAppChannels().filter((channel) => !only || only.includes(channel.key))
  if (channels.length === 0) return null

  if (variant === 'footer') {
    return (
      <>
        {channels.map((channel) => (
          <a key={channel.key} href={channel.url} target="_blank" rel="noopener noreferrer" className="text-base font-medium text-white/65 transition-colors hover:text-gold">
            WhatsApp: {channel.label}
          </a>
        ))}
      </>
    )
  }

  return (
    <section aria-label="WhatsApp channels" className="dashboard-panel p-5 sm:p-6">
      <div className="mb-4 border-b border-surface-border/50 pb-4">
        <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-main">
          <MessageCircle className="h-4 w-4 text-[#25d366]" aria-hidden /> Follow us on WhatsApp
        </h3>
      </div>
      <ul className="space-y-2">
        {channels.map((channel) => (
          <li key={channel.key}>
            <a
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-white px-4 py-3 hover:border-[#25d366]"
            >
              <span>
                <span className="block text-sm font-extrabold text-text-main">{channel.label}</span>
                <span className="block text-xs font-medium text-text-muted">{channel.description}</span>
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-[#1ebe5b]">Join</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
