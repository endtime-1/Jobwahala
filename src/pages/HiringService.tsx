import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardList, SearchCheck, ShieldCheck, UserCheck } from 'lucide-react'
import SEO from '../components/SEO'
import PageHero from '../components/PageHero'
import { useAuth } from '../context/AuthContext'
import { apiHiringInfo, apiMyHiringRequests } from '../lib/api'
import { STATUS_LABEL, fmtDate, type HiringInfo, type RequestSummary } from '../lib/hiring'

const STEPS = [
  { icon: ClipboardList, title: 'Tell us the role', text: 'Describe the job, the pay, where it is and what you need. It takes about five minutes.' },
  { icon: ShieldCheck, title: 'We agree the terms', text: 'We contact you, agree a fixed fee, and assign a named recruiter.' },
  { icon: SearchCheck, title: 'We find and screen', text: 'Your recruiter searches JobWahala, contacts people, and checks each one against what you need.' },
  { icon: UserCheck, title: 'You choose', text: 'You get a shortlist with CVs and a short note on each person. Invite to interview, mark not suitable, or mark hired.' },
]

/** The Hiring Service: JobWahala staff recruit for the employer. Anyone can read how it works; an employer starts a request here. */
export default function HiringService() {
  const { user, role } = useAuth()
  const [info, setInfo] = useState<HiringInfo | null>(null)
  const [requests, setRequests] = useState<RequestSummary[]>([])
  const isEmployer = role === 'EMPLOYER'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = (await apiHiringInfo()) as { info: HiringInfo }
        if (!cancelled) setInfo(data.info)
      } catch {
        // The page reads fine without the price.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isEmployer) return
    let cancelled = false
    void (async () => {
      try {
        const data = (await apiMyHiringRequests()) as { requests: RequestSummary[] }
        if (!cancelled) setRequests(data.requests)
      } catch {
        // Optional.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEmployer])

  const days = info?.guaranteeDays ?? 90
  const cta = isEmployer ? (
    <Link to="/hiring-service/new" className="btn btn-gold btn-lg justify-center">Let JobWahala hire for you</Link>
  ) : user ? (
    <p className="text-sm font-semibold text-white/75">The Hiring Service is for employer accounts.</p>
  ) : (
    <Link to="/signup?role=employer" className="btn btn-gold btn-lg justify-center">Sign up to start a request</Link>
  )

  return (
    <div className="pb-20 pt-24 xl:pt-28">
      <SEO title="Hiring Service: we recruit for you" description="Too busy to hire? JobWahala recruiters find and screen candidates for you, and send you a shortlist. With a free replacement guarantee." />
      <div className="container max-w-5xl">
        <PageHero eyebrow="Hiring Service" title="We recruit." accent="You hire.">
          <p className="mt-4 max-w-2xl text-lg font-medium text-white/75">
            Too busy to read hundreds of CVs? A JobWahala recruiter finds and screens candidates for you and sends you a shortlist, each with a short note.
          </p>
          <p className="mt-5 text-2xl font-black text-gold">{info?.fromPriceGhs ? `From GHS ${info.fromPriceGhs.toLocaleString('en-GH')}` : 'Ask us for a quote'}</p>
          <p className="text-sm font-medium text-white/60">{info?.fromPriceGhs ? 'The fee depends on the role. We agree it with you before we start.' : 'We agree a fixed fee with you before we start.'}</p>
          <div className="mt-6">{cta}</div>
        </PageHero>

        <section aria-labelledby="steps-heading" className="mt-12">
          <h2 id="steps-heading" className="text-3xl font-black tracking-tight text-text-main">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="dashboard-panel p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-black text-white">{index + 1}</span>
                <h3 className="mt-3 flex items-center gap-2 text-base font-black text-text-main"><Icon className="h-4 w-4 text-secondary" aria-hidden /> {title}</h3>
                <p className="mt-1 text-sm font-medium leading-6 text-text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="guarantee-heading" className="dashboard-panel mt-10 p-6 sm:p-8">
          <h2 id="guarantee-heading" className="flex items-center gap-2 text-2xl font-black text-text-main"><ShieldCheck className="h-6 w-6 text-success" aria-hidden /> Our replacement guarantee</h2>
          <p className="mt-2 text-base font-medium leading-7 text-text-muted">
            If someone you hire through the service leaves, we search again at no extra cost. The guarantee lasts <strong className="text-text-main">{days} days</strong> from the day your hire starts.
          </p>
          <ul className="mt-4 space-y-2 text-sm font-semibold text-text-main">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden /> Every candidate has agreed to be put forward before you see them.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden /> A named recruiter works on your request, and you can see its progress at any time.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden /> Only you and your recruiter can see the shortlist and the candidates&apos; details.</li>
          </ul>
        </section>

        {isEmployer && requests.length > 0 ? (
          <section aria-labelledby="my-requests" className="mt-12">
            <h2 id="my-requests" className="text-2xl font-black text-text-main">Your requests</h2>
            <ul className="mt-4 space-y-3">
              {requests.map((request) => (
                <li key={request.id}>
                  <Link to={`/hiring-service/${request.id}`} className="dashboard-panel flex flex-col gap-2 p-4 transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="block text-base font-black text-text-main">{request.roleTitle}</span>
                      <span className="text-xs font-semibold text-text-muted">{request.reference} · {request.location} · sent {fmtDate(request.createdAt)}</span>
                    </span>
                    <span className="text-xs font-black uppercase tracking-widest text-secondary">{STATUS_LABEL[request.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="faq-heading" className="mt-12 max-w-3xl">
          <h2 id="faq-heading" className="text-3xl font-black tracking-tight text-text-main">Questions</h2>
          <dl className="mt-4 space-y-4">
            {[
              ['Who are the candidates?', 'People with a JobWahala account. Your recruiter searches the profiles that people chose to make visible, and the people who apply to your job post, and asks each person before putting them forward.'],
              ['How much does it cost?', info?.fromPriceGhs ? `From GHS ${info.fromPriceGhs.toLocaleString('en-GH')}. We agree a fixed fee for your role before any work starts, and you can see it on your request page.` : 'We agree a fixed fee for your role before any work starts, and you can see it on your request page.'],
              ['What if my hire leaves?', `Within ${days} days of their start date, we search again for free.`],
              ['Can I cancel?', 'Yes, before work starts. After that, please contact us.'],
            ].map(([q, a]) => (
              <div key={q}>
                <dt className="text-base font-black text-text-main">{q}</dt>
                <dd className="mt-1 text-sm font-medium leading-6 text-text-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}
