import { useState, type FormEvent } from 'react'
import { MapPin, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buildJobSearchPath } from '../../lib/jobSearch'

export default function HeroSearch() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [town, setTown] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    navigate(buildJobSearchPath(keyword, town))
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Search jobs"
      className="mt-6 flex flex-col gap-2 rounded-[1.6rem] border border-surface-border bg-white p-2 shadow-premium-md sm:flex-row sm:items-center"
    >
      <label className="relative flex-1">
        <span className="sr-only">Job title or keyword</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" aria-hidden />
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Job title or keyword"
          enterKeyHint="search"
          className="h-12 w-full rounded-2xl border-0 bg-surface-alt/50 pl-11 pr-3 text-[15px] font-semibold"
        />
      </label>
      <label className="relative flex-1">
        <span className="sr-only">Town or city</span>
        <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" aria-hidden />
        <input
          value={town}
          onChange={(event) => setTown(event.target.value)}
          placeholder="Town or city"
          enterKeyHint="search"
          className="h-12 w-full rounded-2xl border-0 bg-surface-alt/50 pl-11 pr-3 text-[15px] font-semibold"
        />
      </label>
      <button type="submit" className="btn btn-primary h-12 justify-center px-7">
        Search jobs
      </button>
    </form>
  )
}
