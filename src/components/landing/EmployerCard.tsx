import { ArrowRight, FileText, ShieldCheck, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

const STEPS = [
  {
    icon: FileText,
    title: 'Post it in minutes',
    body: 'Describe the role and let AI draft the details. Your listing goes live right away.',
  },
  {
    icon: ShieldCheck,
    title: 'Review matched people',
    body: 'Applicants arrive with a fit score and the reasons behind it, so shortlisting is quick.',
  },
  {
    icon: Wallet,
    title: 'Fund, then release',
    body: 'Fund a milestone into escrow. Release it when the work is approved - not before.',
  },
]

export default function EmployerCard() {
  return (
    <div className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-premium-xl backdrop-blur-xl sm:p-6">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Hiring on JobWahala</p>
      <h2 className="mt-1 text-lg font-black text-text-main sm:text-xl">From job post to paid, in three steps.</h2>

      <ol className="mt-5 space-y-4">
        {STEPS.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className="flex gap-4">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-secondary-light text-secondary">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15px] font-black text-text-main">
                <span className="mr-1.5 text-text-light">{index + 1}.</span>
                {title}
              </p>
              <p className="mt-0.5 text-sm font-medium leading-relaxed text-text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link to="/onboarding?role=employer" className="btn btn-primary mt-6 w-full justify-center">
        Start hiring free <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
