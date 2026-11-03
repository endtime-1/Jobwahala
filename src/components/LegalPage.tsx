import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SEO from './SEO'

export type LegalSection = { heading: string; body: ReactNode }

type LegalPageProps = {
  title: string
  description: string
  updated: string
  intro: string
  sections: LegalSection[]
}

export default function LegalPage({ title, description, updated, intro, sections }: LegalPageProps) {
  return (
    <div className="py-16 md:py-24">
      <SEO title={title} description={description} />
      <div className="container max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-text-main md:text-5xl">{title}</h1>
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-text-light">Last updated {updated}</p>
        <p className="mt-8 text-base leading-8 text-text-muted">{intro}</p>

        <nav aria-label="Sections" className="mt-10 rounded-2xl border border-surface-border bg-surface-alt/30 p-5">
          <ol className="grid gap-2 text-sm font-semibold text-primary sm:grid-cols-2">
            {sections.map((section, index) => (
              <li key={section.heading}>
                <a href={`#section-${index + 1}`} className="hover:underline">
                  {index + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-10">
          {sections.map((section, index) => (
            <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-24">
              <h2 className="text-xl font-black text-text-main">
                {index + 1}. {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-text-muted">{section.body}</div>
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
