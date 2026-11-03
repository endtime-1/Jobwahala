import { Rocket } from 'lucide-react'
import { Link } from 'react-router-dom'

const footerColumns = [
  {
    title: 'For Talent',
    links: [
      ['Browse Jobs', '/jobs'],
      ['Freelance Gigs', '/freelancers'],
      ['My Workspace', '/dashboard'],
    ],
  },
  {
    title: 'For Employers',
    links: [
      ['Post a Job', '/onboarding?role=employer'],
      ['Find Freelancers', '/freelancers'],
      ['Hiring Hub', '/dashboard'],
    ],
  },
  {
    title: 'Platform',
    links: [
      ['Agreements', '/agreements'],
      ['Messages', '/messaging'],
      ['Help and Support', '/support'],
      ['Terms of Service', '/terms'],
      ['Privacy Policy', '/privacy'],
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.56)_0%,rgba(255,255,255,0.82)_100%)] py-16 backdrop-blur-2xl">
      <div className="container">
        <div className="rounded-[2.5rem] border border-white/60 bg-white/74 p-10 shadow-premium-lg">
          <div className="grid grid-cols-1 gap-12 xl:grid-cols-[1.4fr_repeat(3,1fr)]">
            <div className="max-w-sm">
              <Link to="/" className="inline-flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#101a2b_0%,#2f6df6_100%)] text-white shadow-premium-sm">
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-black tracking-tight text-text-main">
                    Job<span className="text-secondary">Wahala</span>
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-light">
                    Work infrastructure for Africa
                  </p>
                </div>
              </Link>

              <p className="mt-6 text-sm font-medium leading-relaxed text-text-muted">
                A calmer, smarter workspace for jobs, freelance projects, agreements, and the teams building across the continent.
              </p>
            </div>

            {footerColumns.map((column) => (
              <div key={column.title}>
                <h4 className="text-[10px] font-black uppercase tracking-[0.24em] text-text-light">
                  {column.title}
                </h4>
                <div className="mt-5 flex flex-col gap-4">
                  {column.links.map(([label, href]) => (
                    <Link
                      key={label}
                      to={href}
                      className="text-sm font-bold text-text-main transition-colors hover:text-secondary"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-surface-border pt-6 text-xs font-medium text-text-light md:flex-row md:items-center md:justify-between">
            <p>Copyright {new Date().getFullYear()} JobWahala. Built for modern mobile-first work.</p>
            <div className="flex flex-wrap items-center gap-6 uppercase tracking-[0.18em]">
              <Link to="/privacy" className="hover:text-text-main">Privacy</Link>
              <Link to="/terms" className="hover:text-text-main">Terms</Link>
              <Link to="/support" className="hover:text-text-main">Support</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
