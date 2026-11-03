import { useEffect, useState } from 'react'
import { BadgeCheck, Banknote, Handshake, Hammer, Lock } from 'lucide-react'

const STEPS = [
  {
    icon: Handshake,
    label: 'Agree',
    title: 'Agree on the work',
    body: 'Scope, amount and milestones are written into an agreement both sides accept.',
    status: 'Agreement signed',
    where: 'Nothing has moved yet',
    escrow: 0,
  },
  {
    icon: Lock,
    label: 'Fund',
    title: 'Employer funds escrow',
    body: 'The employer pays by mobile money or card. The money is held by JobWahala - not by either side.',
    status: 'Milestone funded',
    where: 'Held safely in escrow',
    escrow: 100,
  },
  {
    icon: Hammer,
    label: 'Work',
    title: 'Do the work, in one place',
    body: 'Chat, share files and track milestones together. The freelancer starts knowing the money is real.',
    status: 'In progress',
    where: 'Held safely in escrow',
    escrow: 100,
  },
  {
    icon: BadgeCheck,
    label: 'Approve',
    title: 'Employer approves',
    body: 'Happy? Approve the milestone. Not happy? Open a dispute and an admin reviews both sides.',
    status: 'Approved',
    where: 'Released from escrow',
    escrow: 40,
  },
  {
    icon: Banknote,
    label: 'Get paid',
    title: 'Paid to your MoMo',
    body: 'Payout goes to the MTN MoMo, Telecel Cash, AirtelTigo or bank account you added.',
    status: 'Paid out',
    where: 'In the freelancer wallet',
    escrow: 0,
  },
] as const

const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export default function MoneyPath() {
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(() => !reducedMotion())

  useEffect(() => {
    if (!auto) return
    const timer = window.setInterval(() => setActive((current) => (current + 1) % STEPS.length), 3400)
    return () => window.clearInterval(timer)
  }, [auto])

  const step = STEPS[active]

  const choose = (index: number) => {
    setAuto(false)
    setActive(index)
  }

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
      <div>
        <ol className="space-y-2" aria-label="How a payment moves">
          {STEPS.map((item, index) => {
            const Icon = item.icon
            const isActive = index === active
            return (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => choose(index)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all ${
                    isActive
                      ? 'border-secondary/40 bg-white shadow-premium-md'
                      : 'border-transparent hover:bg-white/60'
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 flex-none items-center justify-center rounded-2xl transition-colors ${
                      isActive ? 'bg-secondary text-white' : 'bg-surface-alt text-text-muted'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-black text-text-main">
                      {index + 1}. {item.title}
                    </span>
                    {isActive && (
                      <span className="mt-1 block text-sm font-medium leading-relaxed text-text-muted">{item.body}</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="mx-auto w-full max-w-sm" aria-live="polite">
        <div className="rounded-[2.2rem] border-[6px] border-primary bg-primary p-1 shadow-premium-2xl">
          <div className="overflow-hidden rounded-[1.8rem] bg-white">
            <div className="bg-gradient-to-br from-primary to-secondary-dark px-5 pb-5 pt-6 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Example project</p>
              <p className="mt-1 text-lg font-black">Logo and brand kit</p>
              <p className="mt-3 text-3xl font-black tracking-tight">GHS 1,500</p>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between rounded-2xl bg-surface-alt/60 px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-widest text-text-light">Status</span>
                <span className="text-sm font-black text-text-main">{step.status}</span>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5 text-text-muted">
                    <Lock className="h-3.5 w-3.5" /> Escrow
                  </span>
                  <span className="text-text-main">{step.where}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-secondary to-success transition-all duration-700"
                    style={{ width: `${step.escrow}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-1.5" aria-hidden>
                {STEPS.map((item, index) => (
                  <span
                    key={item.label}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${index <= active ? 'bg-secondary' : 'bg-surface-alt'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs font-semibold text-text-light">
          Illustration of the flow - amounts are an example.
        </p>
      </div>
    </div>
  )
}
