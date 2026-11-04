import { useEffect, useState, type ReactNode } from 'react'
import SEO from '../components/SEO'
import CvBuilderSection from '../components/landing/CvBuilderSection'
import EmployerCard from '../components/landing/EmployerCard'
import Faq from '../components/landing/Faq'
import FinalCta, { LegalLinks } from '../components/landing/FinalCta'
import Hero from '../components/landing/Hero'
import MarketPulse from '../components/landing/MarketPulse'
import MatchLab from '../components/landing/MatchLab'
import MoneyPath from '../components/landing/MoneyPath'
import CountryStrip from '../components/landing/CountryStrip'
import HeroVisual from '../components/landing/HeroVisual'
import OldVsNew from '../components/landing/OldVsNew'
import PathCards from '../components/landing/PathCards'
import Reveal from '../components/landing/Reveal'
import TrustGrid from '../components/landing/TrustGrid'
import type { Audience, HiringCompany, LandingCounts, LandingJob } from '../components/landing/types'
import { apiGetHiringCompanies, apiGetJobs, apiGetPlatformStats } from '../lib/api'

function Section({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="py-14 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-20">
      <div className="container">
        <Reveal className="mb-8 max-w-2xl sm:mb-12">
          <p className="flex items-center gap-2 text-sm font-extrabold text-secondary">
            <span className="h-1 w-6 rounded-full bg-gold" aria-hidden />
            {eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight text-text-main sm:text-4xl">{title}</h2>
          {intro && <p className="mt-3 text-base font-medium leading-relaxed text-text-muted">{intro}</p>}
        </Reveal>
        <Reveal delay={80}>{children}</Reveal>
      </div>
    </section>
  )
}

export default function Landing() {
  const [audience, setAudience] = useState<Audience>('talent')
  const [jobs, setJobs] = useState<LandingJob[]>([])
  const [counts, setCounts] = useState<LandingCounts | null>(null)
  const [companies, setCompanies] = useState<HiringCompany[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    apiGetJobs()
      .then((res: { jobs?: LandingJob[] }) => {
        if (!cancelled) setJobs(Array.isArray(res.jobs) ? res.jobs : [])
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setJobsLoading(false)
      })

    apiGetPlatformStats()
      .then((res: { success?: boolean; stats?: { counts?: LandingCounts } }) => {
        if (!cancelled && res.success && res.stats?.counts) setCounts(res.stats.counts)
      })
      .catch(() => undefined)

    apiGetHiringCompanies()
      .then((res: { companies?: HiringCompany[] }) => {
        if (!cancelled && Array.isArray(res.companies)) setCompanies(res.companies)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="on-home">
      <SEO
        title="Jobs and freelance work across Africa with escrow-protected payments"
        description="Find jobs and freelance gigs across Africa, or hire people you can trust. Payments are held in escrow until the work is approved, then paid to mobile money or bank."
        keywords="jobs in africa, freelance africa, hire freelancers africa, escrow payments, mobile money freelance, remote work africa, jobwahala"
      />

      <section className="relative isolate overflow-hidden bg-primary pb-16 pt-36 text-white sm:pb-24 sm:pt-40 xl:pt-44">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(900px 520px at 90% 0%, rgba(47,109,246,0.5), transparent 60%), radial-gradient(640px 420px at 0% 100%, rgba(255,197,49,0.16), transparent 60%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 -z-10 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden
        />
        <div className="container">
          <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
            <Hero audience={audience} onAudienceChange={setAudience} />
            <HeroVisual />
          </div>
        </div>
        <div className="heritage-strip absolute inset-x-0 bottom-0" aria-hidden />
      </section>

      <CountryStrip />

      <Section eyebrow="Start here" title="Where do you want to begin?">
        <PathCards />
      </Section>

      <Section eyebrow="On the board" title="Open roles.">
        <MarketPulse jobs={jobs} counts={counts} companies={companies} />
      </Section>

      <section className="bg-primary py-16 text-white sm:py-24">
        <div className="container">
          <Reveal className="mb-10 max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-extrabold text-gold">
              <span className="h-1 w-6 rounded-full bg-gold" aria-hidden />
              Why people switch
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              Finding work should not feel like a gamble.
            </h2>
            <p className="mt-3 text-base font-medium leading-relaxed text-white/70 sm:text-lg">
              Most people have applied for a job that turned out to be fake, or never heard back. Companies, too, struggle to be taken seriously. We built JobWahala so real jobs and real employers find each other.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <OldVsNew />
          </Reveal>
        </div>
      </section>

      <Section
        eyebrow="Try it now"
        title={audience === 'talent' ? 'What are you good at?' : 'Hiring, step by step.'}
        intro={
          audience === 'talent'
            ? 'Type a skill and see the open roles that fit. No sign up needed.'
            : 'From job post to paid in three steps, with your money protected the whole way.'
        }
      >
        <div className="mx-auto max-w-3xl">
          {audience === 'talent' ? <MatchLab jobs={jobs} isLoading={jobsLoading} /> : <EmployerCard />}
        </div>
      </Section>

      <Section
        eyebrow="For contract and freelance work"
        title="Paid projects are protected too."
        intro="When a job is a one-off project, the money is held safely and released as work is approved. Tap through a project to see how."
      >
        <MoneyPath />
      </Section>

      <Section
        eyebrow="Built for trust"
        title="So nobody gets cheated."
        intro="Real company pages, verification and a way to report problems are not extras here. They are how the platform works."
      >
        <TrustGrid />
      </Section>

      <Section
        eyebrow="Free CV builder"
        title="No CV yet? Start with a few notes."
        intro="Most applications fail at the first step: a missing or messy CV. Our builder turns your rough notes into a clean, professional one."
      >
        <CvBuilderSection />
      </Section>

      <Section eyebrow="Good to know" title="Questions people ask first.">
        <Faq />
      </Section>

      <section className="pb-24 pt-6 sm:pb-28">
        <div className="container">
          <Reveal>
            <FinalCta />
          </Reveal>
          <LegalLinks />
        </div>
      </section>
    </div>
  )
}
