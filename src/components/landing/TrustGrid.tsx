import { BadgeCheck, MessageCircle, Scale, ShieldCheck } from 'lucide-react'

const PILLARS = [
  {
    icon: BadgeCheck,
    title: 'Employers you can check',
    body: 'Companies have their own page with their logo, details and open roles. Employers and job seekers can verify their identity, and verified accounts wear a badge.',
    tone: 'bg-secondary-light text-secondary',
  },
  {
    icon: ShieldCheck,
    title: 'Safer applying',
    body: 'Every job shows the pay and location up front. You never pay to apply, and you can report any suspicious job so our team can review it.',
    tone: 'bg-success/12 text-success',
  },
  {
    icon: MessageCircle,
    title: 'Everything in one thread',
    body: 'Messages, files and proposals live together, so there is always a record of what was agreed between you and the employer.',
    tone: 'bg-primary/10 text-primary',
  },
  {
    icon: Scale,
    title: 'Protection for paid projects',
    body: 'For one-off projects, money is held in escrow and released on approval. If something goes wrong, open a dispute and an admin records a decision.',
    tone: 'bg-accent/15 text-accent',
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
