import { BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'

/** On the employer dashboard: a way in to listing courses. */
export default function ProviderLinkPanel() {
  return (
    <section aria-label="Training courses" className="dashboard-panel flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      <div>
        <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-main">
          <BookOpen className="h-4 w-4 text-secondary" aria-hidden /> Do you run training courses?
        </h3>
        <p className="mt-1 text-xs font-medium leading-relaxed text-text-muted">List them on JobWahala and see how many people look at them.</p>
      </div>
      <Link to="/provider" className="btn btn-outline btn-sm bg-white">
        Manage courses
      </Link>
    </section>
  )
}
