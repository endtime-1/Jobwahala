import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, SlidersHorizontal, X } from 'lucide-react'
import CourseCard from '../components/CourseCard'
import SEO from '../components/SEO'
import { SKILLS } from '../content/skills'
import { apiListCourses } from '../lib/api'
import {
  categoryName,
  courseCategories,
  courseFilterParams,
  courseFormats,
  courseLevels,
  emptyCourseFilters,
  hasCourseFilters,
  levelLabel,
  formatLabel,
  priceFilterOptions,
  skillLabel,
  type Course,
  type CourseFilters,
} from '../lib/courses'
import { getErrorMessage } from '../lib/errors'

const selectClass = 'mt-1 h-11 w-full rounded-xl border border-surface-border bg-white px-3 text-sm font-semibold text-text-main'

/** The filters in use, as small removable chips. */
const chipsFor = (filters: CourseFilters) => {
  const chips: { key: string; label: string; clear: Partial<CourseFilters> }[] = []
  if (filters.search.trim()) chips.push({ key: 'search', label: `"${filters.search.trim()}"`, clear: { search: '' } })
  if (filters.category) chips.push({ key: 'category', label: categoryName(filters.category), clear: { category: '' } })
  if (filters.skill) chips.push({ key: 'skill', label: skillLabel(filters.skill), clear: { skill: '' } })
  if (filters.level) chips.push({ key: 'level', label: levelLabel(filters.level), clear: { level: '' } })
  if (filters.format) chips.push({ key: 'format', label: formatLabel(filters.format), clear: { format: '' } })
  if (filters.location.trim()) chips.push({ key: 'location', label: filters.location.trim(), clear: { location: '' } })
  if (filters.price) chips.push({ key: 'price', label: priceFilterOptions.find((option) => option.value === filters.price)?.label ?? filters.price, clear: { price: '' } })
  if (filters.verified) chips.push({ key: 'verified', label: 'Verified providers', clear: { verified: false } })
  return chips
}

export default function Courses() {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<CourseFilters>(() => ({
    ...emptyCourseFilters,
    search: searchParams.get('search') ?? '',
    category: courseCategories.some((category) => category.slug === searchParams.get('category')) ? (searchParams.get('category') as string) : '',
    skill: SKILLS.some((skill) => skill.slug === searchParams.get('skill')) ? (searchParams.get('skill') as string) : '',
  }))
  const [courses, setCourses] = useState<Course[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const params = useMemo(() => courseFilterParams(filters), [filters])

  useEffect(() => {
    let cancelled = false
    // A short pause so typing in a box does not search on every letter.
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      apiListCourses(params)
        .then((data: { courses?: Course[]; total?: number }) => {
          if (cancelled) return
          setCourses(Array.isArray(data.courses) ? data.courses : [])
          setTotal(data.total ?? data.courses?.length ?? 0)
          setError('')
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(getErrorMessage(err, 'We could not load courses right now. Please try again.'))
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [params])

  const update = (patch: Partial<CourseFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const chips = chipsFor(filters)

  return (
    <div className="pb-24">
      <SEO
        title="Courses and training in Ghana"
        description="Find courses from training providers in Ghana. Compare price, duration, format and start dates, then enquire. Free courses and verified providers."
        canonical="https://jobwahala.com/courses"
      />

      <section className="relative isolate overflow-hidden bg-primary pb-10 pt-28 text-white sm:pb-14 sm:pt-32 xl:pt-36">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(900px 480px at 90% 0%, rgba(47,109,246,0.5), transparent 60%), radial-gradient(600px 380px at 0% 100%, rgba(255,197,49,0.16), transparent 60%)' }}
          aria-hidden
        />
        <div className="container">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-gold sm:text-[13px]">
            <BookOpen className="h-4 w-4" aria-hidden /> Learn a skill employers ask for
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Courses <span className="text-gold">in Ghana</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-medium leading-snug text-white/80">Compare courses from training providers. See the price, how long it takes and when it starts before you enquire.</p>

          <div role="search" className="mt-7 grid max-w-3xl gap-3 rounded-2xl bg-white p-3 shadow-premium-md sm:grid-cols-2">
            <input
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              placeholder="Course, skill or provider, e.g. Excel"
              aria-label="Search courses"
              className="h-12 w-full rounded-xl border-0 bg-surface-alt/60 px-4 text-base font-semibold text-text-main outline-none"
            />
            <input
              value={filters.location}
              onChange={(e) => update({ location: e.target.value })}
              placeholder="Town, e.g. Accra"
              aria-label="Location"
              className="h-12 w-full rounded-xl border-0 bg-surface-alt/60 px-4 text-base font-semibold text-text-main outline-none"
            />
          </div>
        </div>
      </section>

      <div className="container mt-8 grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside aria-label="Filters" className="self-start lg:sticky lg:top-28">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="course-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-extrabold text-text-main lg:hidden"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters
            </span>
            {chips.length > 0 ? <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-black text-white">{chips.length}</span> : null}
          </button>

          <div id="course-filters" className={`${filtersOpen ? 'mt-3 block' : 'hidden'} space-y-5 rounded-2xl border border-surface-border bg-white p-5 lg:mt-0 lg:block`}>
            <label className="block text-sm font-bold text-text-main">
              Category
              <select value={filters.category} onChange={(e) => update({ category: e.target.value })} className={selectClass}>
                <option value="">Any category</option>
                {courseCategories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-text-main">
              Skill you want to learn
              <select value={filters.skill} onChange={(e) => update({ skill: e.target.value })} className={selectClass}>
                <option value="">Any skill</option>
                {SKILLS.map((skill) => (
                  <option key={skill.slug} value={skill.slug}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-text-main">
              Price
              <select value={filters.price} onChange={(e) => update({ price: e.target.value })} className={selectClass}>
                {priceFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-text-main">
              How you learn
              <select value={filters.format} onChange={(e) => update({ format: e.target.value })} className={selectClass}>
                <option value="">Online or in person</option>
                {courseFormats.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-text-main">
              Level
              <select value={filters.level} onChange={(e) => update({ level: e.target.value })} className={selectClass}>
                <option value="">Any level</option>
                {courseLevels.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm font-bold text-text-main">
              <input type="checkbox" checked={filters.verified} onChange={(e) => update({ verified: e.target.checked })} />
              Verified providers only
            </label>
          </div>
        </aside>

        <section aria-label="Courses" className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p aria-live="polite" className="mr-2 text-sm font-extrabold text-text-main">
              {isLoading ? 'Searching...' : error ? '' : `${total} ${total === 1 ? 'course' : 'courses'}`}
            </p>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => update(chip.clear)}
                aria-label={`Remove filter ${chip.label}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary hover:bg-secondary/20"
              >
                {chip.label} <X className="h-3 w-3" aria-hidden />
              </button>
            ))}
            {hasCourseFilters(filters) ? (
              <button type="button" onClick={() => setFilters(emptyCourseFilters)} className="text-xs font-black uppercase tracking-widest text-primary hover:underline">
                Clear filters
              </button>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
              {error}
            </p>
          ) : null}

          {isLoading ? (
            <ul aria-label="Loading courses" className="mt-4 space-y-4">
              <li className="sr-only">Loading courses...</li>
              {[0, 1, 2].map((placeholder) => (
                <li key={placeholder} aria-hidden className="h-40 animate-pulse rounded-2xl border border-surface-border bg-white" />
              ))}
            </ul>
          ) : null}

          {!isLoading && !error && courses.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-surface-border bg-white p-10 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-secondary" aria-hidden />
              <p className="mt-3 text-lg font-extrabold text-text-main">{hasCourseFilters(filters) ? 'No courses match those filters yet.' : 'No courses are listed yet.'}</p>
              <p className="mx-auto mt-1 max-w-md text-sm font-medium text-text-muted">
                {hasCourseFilters(filters) ? 'Try fewer filters.' : 'Training providers are joining. Check back soon.'}
              </p>
              <p className="mt-4 text-sm font-semibold text-text-muted">
                Run a training business?{' '}
                <Link to="/onboarding?role=employer" className="font-bold text-primary hover:underline">
                  List your courses
                </Link>
              </p>
            </div>
          ) : null}

          {!isLoading ? (
            <ul aria-label="Results" className="mt-4 space-y-4">
              {courses.map((course) => (
                <li key={course.id}>
                  <CourseCard course={course} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  )
}
