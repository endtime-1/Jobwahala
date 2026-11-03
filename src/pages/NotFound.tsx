import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, LifeBuoy, Users } from 'lucide-react'
import SEO from '../components/SEO'
import PageHero from '../components/PageHero'

const SHORTCUTS = [
  { to: '/jobs', label: 'Browse jobs', icon: Briefcase },
  { to: '/freelancers', label: 'Find freelancers', icon: Users },
  { to: '/support', label: 'Get help', icon: LifeBuoy },
]

export default function NotFound() {
  return (
    <div className="container pb-24 pt-32 xl:pt-36">
      <SEO
        title="Page Not Found — JobWahala"
        description="The page you're looking for doesn't exist. Navigate back to JobWahala."
      />
      <PageHero eyebrow="Error 404" title="We can't find that" accent="page.">
        <p className="mt-4 max-w-xl text-base font-medium text-white/75 sm:text-lg">
          The link may be old, or the page may have moved. Here is where most people go next.
        </p>
        <Link to="/" className="btn btn-gold btn-lg mt-7 px-8">
          Back to the home page <ArrowRight className="h-5 w-5" />
        </Link>
      </PageHero>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {SHORTCUTS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-4 rounded-2xl border border-surface-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-premium-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <Icon className="h-6 w-6" />
            </span>
            <span className="flex-1 text-lg font-extrabold text-text-main">{label}</span>
            <ArrowRight className="h-5 w-5 text-text-light transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  )
}
