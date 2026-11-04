import { BadgeCheck, Briefcase, Building2 } from 'lucide-react'

// Stock photography (Pexels licence), shown for mood. The floating cards are illustrative examples.
export default function HeroVisual() {
  return (
    <div className="relative mx-auto h-[24rem] w-full max-w-md sm:h-[30rem] lg:h-[40rem] lg:max-w-none">
      <div className="absolute inset-x-6 top-10 -z-10 h-3/4 rounded-full bg-secondary/30 blur-3xl" aria-hidden />

      <img
        src="/people/woman-desk.webp"
        alt="A woman laughing during a work call at her desk"
        width={560}
        height={700}
        className="absolute left-0 top-8 w-[52%] -rotate-3 rounded-3xl object-cover shadow-premium-2xl ring-2 ring-gold/80"
      />
      <img
        src="/people/man-suit.webp"
        alt="A man in a suit in conversation"
        width={560}
        height={700}
        className="absolute right-0 top-0 w-[44%] rotate-3 rounded-3xl object-cover shadow-premium-2xl ring-1 ring-white/25"
      />
      <img
        src="/people/woman-portrait.webp"
        alt="A smiling young woman"
        width={560}
        height={700}
        className="absolute bottom-0 right-6 w-[46%] -rotate-2 rounded-3xl object-cover shadow-premium-2xl ring-2 ring-gold/80"
      />

      <div className="float-card absolute -left-2 bottom-24 flex items-center gap-3 rounded-2xl border border-white/20 bg-primary/85 px-4 py-3 text-white shadow-premium-xl sm:-left-6">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gold text-primary">
          <Briefcase className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-extrabold leading-tight">New application</p>
          <p className="text-xs font-medium text-white/65">Customer Support Agent</p>
        </div>
      </div>

      <div className="float-card float-card--late absolute -right-1 top-1/2 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-primary shadow-premium-xl sm:-right-4">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-success/15 text-success">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-extrabold leading-tight">Verified employer</p>
          <p className="text-xs font-semibold text-text-muted">Company page and open roles</p>
        </div>
      </div>

      <div className="float-card absolute left-4 top-0 flex items-center gap-2 rounded-full bg-gold px-3.5 py-2 text-sm font-extrabold text-primary shadow-premium-lg sm:left-10">
        <BadgeCheck className="h-4 w-4" /> Real jobs
      </div>

      <p className="absolute -bottom-6 left-0 text-[11px] font-medium text-white/40">Examples for illustration. Photography: Pexels.</p>
    </div>
  )
}
