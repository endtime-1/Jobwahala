import { Github, Linkedin, Rocket, Twitter } from 'lucide-react'
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
      ['Post a Job', '/jobs'],
      ['Find Freelancers', '/freelancers'],
      ['Hiring Hub', '/dashboard'],
    ],
  },
  {
    title: 'Platform',
    links: [
      ['Agreements', '/agreements'],
      ['Messages', '/messaging'],
      ['Security Notes', '#'],
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

              <div className="mt-8 flex items-center gap-3">
                {[Twitter, Linkedin, Github].map((Icon, index) => (
                  <button
                    key={index}
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-surface-border bg-white/86 text-text-muted shadow-premium-sm transition-all hover:-translate-y-0.5 hover:text-secondary"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
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
              <span>Privacy</span>
              <span>Terms</span>
              <span>Security</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
