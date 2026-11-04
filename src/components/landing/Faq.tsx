import { ChevronDown } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useFeatures } from '../../lib/features'
import { FAQS as ALL_FAQS } from './faqs'


export default function Faq() {
  const { freelanceEnabled } = useFeatures()
  const FAQS = ALL_FAQS.filter((item) => !(freelanceEnabled && item.comingSoon))

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structured)}</script>
      </Helmet>
      {FAQS.map(({ q, a }) => (
        <details key={q} className="group rounded-2xl border border-surface-border bg-white/85 px-5 py-4 open:shadow-premium-sm">
          <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-black text-text-main">
            {q}
            <ChevronDown className="h-5 w-5 flex-none text-text-light transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-3 text-sm font-medium leading-relaxed text-text-muted">{a}</p>
        </details>
      ))}
    </div>
  )
}
