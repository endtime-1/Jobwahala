import { Link } from 'react-router-dom'
import { Award, CalendarDays, Hourglass, MapPin, Star } from 'lucide-react'
import CompanyLogo from './CompanyLogo'
import VerifiedBadge from './VerifiedBadge'
import { durationText, formatLabel, levelLabel, priceLabel, skillLabel, startText, type Course } from '../lib/courses'

/** One course in a list: title, who runs it, the price first, then how long, how, and when. */
export default function CourseCard({ course, compact = false }: { course: Course; compact?: boolean }) {
  const facts = [
    { icon: Hourglass, text: durationText(course.durationWeeks) },
    { icon: MapPin, text: course.format === 'ONLINE' ? 'Online' : [formatLabel(course.format), course.location].filter(Boolean).join(' · ') },
    { icon: CalendarDays, text: startText(course) },
  ].filter((fact) => fact.text)

  return (
    <article className="rounded-2xl border border-surface-border bg-white p-5 transition-all hover:border-secondary/40 hover:shadow-premium-md sm:p-6">
      <div className="flex items-start gap-4">
        <CompanyLogo name={course.provider.name} logoUrl={course.provider.logoUrl} className="h-12 w-12 flex-none rounded-2xl text-base" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-secondary">
            {levelLabel(course.level)}
            {course.featured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-[11px] normal-case tracking-normal text-primary">
                <Star className="h-3 w-3" aria-hidden /> Featured
              </span>
            ) : null}
          </p>
          <h3 className="mt-1 text-lg font-extrabold leading-snug tracking-tight text-text-main">
            <Link to={`/courses/${course.slug}`} className="hover:text-secondary hover:underline">
              {course.title}
            </Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold text-text-muted">
            <Link to={`/providers/${course.provider.id}`} className="hover:text-secondary hover:underline">
              {course.provider.name}
            </Link>
            <VerifiedBadge type="employer" status={course.provider.isVerified ? 'APPROVED' : 'UNVERIFIED'} hideWhenUnverified showText={false} />
          </p>
        </div>
        <p className={`flex-none rounded-xl px-3 py-1.5 text-base font-black ${course.isFree ? 'bg-success/10 text-success' : 'bg-surface-alt text-text-main'}`}>{priceLabel(course)}</p>
      </div>

      {compact ? null : <p className="mt-3 line-clamp-2 text-sm font-medium leading-relaxed text-text-muted">{course.summary}</p>}

      <ul aria-label="Course details" className="mt-4 flex flex-wrap gap-2">
        {facts.map(({ icon: Icon, text }) => (
          <li key={text} className="inline-flex items-center gap-1.5 rounded-xl bg-surface-alt px-3 py-1.5 text-sm font-bold text-text-muted">
            <Icon className="h-3.5 w-3.5 text-secondary" aria-hidden /> {text}
          </li>
        ))}
        {course.certificateOffered ? (
          <li className="inline-flex items-center gap-1.5 rounded-xl bg-surface-alt px-3 py-1.5 text-sm font-bold text-text-muted">
            <Award className="h-3.5 w-3.5 text-secondary" aria-hidden /> Certificate
          </li>
        ) : null}
      </ul>

      {compact || course.skills.length === 0 ? null : (
        <p className="mt-3 text-xs font-semibold text-text-light">Teaches: {course.skills.slice(0, 4).map(skillLabel).join(', ')}</p>
      )}
    </article>
  )
}
