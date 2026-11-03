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
import Reveal from '../components/landing/Reveal'
import TrustGrid from '../components/landing/TrustGrid'
import type { Audience, HiringCompany, LandingCounts, LandingJob } from '../components/landing/types'
import { apiGetHiringCompanies, apiGetJobs, apiGetPlatformStats } from '../lib/api'

function Section({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="py-14 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-20">
      <div className="container">
        <Reveal className="mb-8 max-w-2xl sm:mb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-secondary">{eyebrow}</p>
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
    <div>
      <SEO
        title="Jobs and freelance work across Africa with escrow-protected payments"
        description="Find jobs and freelance gigs across Africa, or hire people you can trust. Payments are held in escrow until the work is approved, then paid to mobile money or bank."
        keywords="jobs in africa, freelance africa, hire freelancers africa, escrow payments, mobile money freelance, remote work africa, jobwahala"
      />

      <section className="relative overflow-hidden pb-12 pt-36 sm:pb-20 sm:pt-40 xl:pt-44">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-14">
            <Hero audience={audience} onAudienceChange={setAudience} />
            <div className="lg:pt-4">
              {audience === 'talent' ? <MatchLab jobs={jobs} isLoading={jobsLoading} /> : <EmployerCard />}
            </div>
          </div>
        </div>
      </section>

      <div className="heritage-strip" aria-hidden />

      <Section
        eyebrow="Follow the money"
        title="See where the money is at every step."
        intro="The number one worry on both sides is payment. So we made it visible: tap through a project and watch where the cedis sit."
      >
        <MoneyPath />
      </Section>

      <Section
        eyebrow="Built for trust"
        title="So nobody gets cheated."
        intro="Escrow, verification and a dispute desk are not extras here. They are how the platform works."
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

      <Section eyebrow="On the board" title="Open roles.">
        <MarketPulse jobs={jobs} counts={counts} companies={companies} />
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
