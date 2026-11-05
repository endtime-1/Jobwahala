import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import CourseCard from './CourseCard'
import { apiCoursesForJob } from '../lib/api'
import type { Course } from '../lib/courses'

/** "Build skills for this job": up to 3 courses that teach what the job asks for. Shows nothing when there are none. */
export default function CoursesForJob({ jobId }: { jobId: string }) {
  const [state, setState] = useState<{ jobId: string; courses: Course[]; skills: string[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    // Wrapped so a failure (offline, or a test without this call) just means the section stays out of the way.
    Promise.resolve()
      .then(() => apiCoursesForJob(jobId))
      .then((data: { courses?: Course[]; skills?: string[] }) => {
        if (!cancelled) setState({ jobId, courses: data.courses ?? [], skills: data.skills ?? [] })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [jobId])

  if (!state || state.jobId !== jobId || state.courses.length === 0) return null

  return (
    <section aria-label="Build skills for this job" className="rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-text-main">
        <GraduationCap className="h-6 w-6 text-secondary" aria-hidden /> Build skills for this job
      </h2>
      {state.skills.length > 0 ? <p className="mt-2 text-sm font-semibold text-text-muted">Courses that teach {state.skills.slice(0, 3).join(', ')}.</p> : null}
      <ul className="mt-5 space-y-3">
        {state.courses.map((course) => (
          <li key={course.id}>
            <CourseCard course={course} compact />
          </li>
        ))}
      </ul>
      <p className="mt-4">
        <Link to="/courses" className="text-sm font-bold text-primary hover:underline">
          Browse all courses
        </Link>
      </p>
    </section>
  )
}
