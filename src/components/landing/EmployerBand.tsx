import { ArrowRight, Building2, LayoutDashboard, MessagesSquare } from 'lucide-react'
import { Link } from 'react-router-dom'

const BENEFITS = [
  {
    icon: Building2,
    title: 'A company page people trust',
    body: 'Your logo, details and open roles in one place, so candidates know who you are.',
  },
  {
    icon: LayoutDashboard,
    title: 'Review applicants on one board',
    body: 'Every applicant arrives with a fit score and the reasons behind it. Shortlist in a click.',
  },
  {
    icon: MessagesSquare,
    title: 'Talk to candidates in one place',
    body: 'Messages and files stay together, so nothing gets lost across chat apps.',
  },
]

// An example of the applicant board. The names and scores are illustrative only.
const EXAMPLE_APPLICANTS = [
  { initials: 'A', label: 'Applicant A', fit: 91 },
  { initials: 'B', label: 'Applicant B', fit: 76 },
  { initials: 'C', label: 'Applicant C', fit: 64 },
]

export default function EmployerBand() {
  return (
    <div
      className="overflow-hidden rounded-[2rem] p-6 text-white sm:p-10 lg:p-12"
      style={{
        background:
          'radial-gradient(700px 360px at 100% 0%, rgba(47,109,246,0.55), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(255,197,49,0.16), transparent 60%), #101a2b',
      }}
    >
      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-gold">
            <span className="h-1 w-6 rounded-full bg-gold" aria-hidden />
            For companies
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Post your first job in minutes. <span className="text-gold">It is free.</span>
          </h2>
          <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-white/70 sm:text-lg">
            Reach people across Africa who are looking for real work, and show them a company they can trust.
          </p>

          <ul className="mt-7 space-y-5">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-base font-extrabold sm:text-lg">{title}</p>
                  <p className="mt-0.5 text-sm font-medium text-white/65 sm:text-base">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <Link to="/onboarding?role=employer" className="btn btn-gold btn-lg mt-8 justify-center px-8">
            Post a job free <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        <div className="rounded-3xl bg-white p-5 text-primary shadow-premium-2xl sm:p-6" aria-label="Example applicant board">
          <p className="text-sm font-bold text-text-muted">Example: applicants for a Customer Support Agent role</p>
          <ul className="mt-4 space-y-3">
            {EXAMPLE_APPLICANTS.map((applicant) => (
              <li key={applicant.label} className="flex items-center gap-3 rounded-2xl border border-surface-border p-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-secondary/10 text-base font-extrabold text-secondary">
                  {applicant.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-extrabold">{applicant.label}</p>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-alt">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${applicant.fit}%` }} />
                  </div>
                </div>
                <span className="rounded-full bg-gold px-3 py-1 text-sm font-extrabold">{applicant.fit}% fit</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-medium text-text-light">Illustration only. Scores come from each applicant&apos;s profile and your job post.</p>
        </div>
      </div>
    </div>
  )
}
