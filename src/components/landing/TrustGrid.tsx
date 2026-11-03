import { BadgeCheck, MessageCircle, Scale, ShieldCheck } from 'lucide-react'

const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Escrow on every paid project',
    body: 'Funds are secured before work starts and released only on approval. No more chasing payment on WhatsApp.',
    tone: 'bg-success/12 text-success',
  },
  {
    icon: BadgeCheck,
    title: 'Verified people',
    body: 'Job seekers can verify with their Ghana Card. Employers and freelancers can verify their business or track record. Verified accounts wear a badge.',
    tone: 'bg-secondary-light text-secondary',
  },
  {
    icon: Scale,
    title: 'A real dispute desk',
    body: 'If a project goes wrong, open a dispute from the agreement. Both sides add evidence and an admin records a decision.',
    tone: 'bg-accent/15 text-accent',
  },
  {
    icon: MessageCircle,
    title: 'Everything in one thread',
    body: 'Chat, files, proposals and milestones live together, so there is always a record of what was agreed.',
    tone: 'bg-primary/10 text-primary',
  },
]

export default function TrustGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PILLARS.map(({ icon: Icon, title, body, tone }) => (
        <div key={title} className="rounded-3xl border border-surface-border bg-white/80 p-6 shadow-premium-sm">
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
            <Icon className="h-6 w-6" />
          </span>
          <h3 className="mt-4 text-lg font-black text-text-main">{title}</h3>
          <p className="mt-2 text-sm font-medium leading-relaxed text-text-muted">{body}</p>
        </div>
      ))}
    </div>
  )
}
