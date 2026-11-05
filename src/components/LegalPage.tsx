import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SEO from './SEO'
import PageHero from './PageHero'

export type LegalSection = { heading: string; body: ReactNode }

type LegalPageProps = {
  title: string
  description: string
  updated: string
  intro: string
  sections: LegalSection[]
  /** Shown in a banner at the top while the text is still waiting for a lawyer. */
  draftNotice?: ReactNode
}

export default function LegalPage({ title, description, updated, intro, sections, draftNotice }: LegalPageProps) {
  return (
    <div className="pb-20 pt-24 xl:pt-28">
      <SEO title={title} description={description} />
      <div className="container max-w-4xl">
        <PageHero eyebrow="Legal" title={title}>
          <p className="mt-4 text-sm font-semibold text-white/60">Last updated {updated}</p>
        </PageHero>
        {draftNotice ? (
          <div role="note" aria-label="Draft notice" className="mt-8 rounded-2xl border-2 border-gold bg-gold/15 p-5 text-base font-semibold leading-7 text-text-main">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Draft for legal review</p>
            <div className="mt-2">{draftNotice}</div>
          </div>
        ) : null}
        <p className="mt-8 text-lg leading-8 text-text-muted">{intro}</p>

        <nav aria-label="Sections" className="mt-10 rounded-2xl border border-surface-border bg-surface-alt/30 p-5">
          <ol className="grid gap-2 text-sm font-semibold text-primary sm:grid-cols-2">
            {sections.map((section, index) => (
              <li key={section.heading}>
                <a href={`#section-${index + 1}`} className="inline-block py-1.5 hover:underline">
                  {index + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-10">
          {sections.map((section, index) => (
            <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-24">
              <h2 className="text-2xl font-black text-text-main">
                {index + 1}. {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-base leading-8 text-text-muted">{section.body}</div>
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-surface-border pt-6 text-sm text-text-muted">
          Questions? Visit our{' '}
          <Link to="/support" className="font-bold text-primary hover:underline">
            Support centre
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
