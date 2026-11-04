import { useState, type FormEvent } from 'react'
import { ChevronDown, MapPin, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buildJobSearchPath, jobFieldOptions, jobTypeOptions } from '../../lib/jobSearch'

const selectClass =
  'h-12 w-full appearance-none rounded-2xl border-0 bg-surface-alt/50 px-4 text-[15px] font-semibold text-text-main'

export default function HeroSearch() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [town, setTown] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    navigate(buildJobSearchPath(keyword, town, { category, type }))
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Search jobs"
      className="mt-6 grid gap-2 rounded-[1.6rem] bg-white p-2 shadow-premium-xl sm:grid-cols-2"
    >
      <label className="relative">
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
      <label className="relative">
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
      <label className="relative">
        <span className="sr-only">Field</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className={selectClass}>
          <option value="">All fields</option>
          {jobFieldOptions.map((field) => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" aria-hidden />
      </label>
      <label className="relative">
        <span className="sr-only">Job type</span>
        <select value={type} onChange={(event) => setType(event.target.value)} className={selectClass}>
          <option value="">All job types</option>
          {jobTypeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" aria-hidden />
      </label>
      <button type="submit" className="btn btn-gold h-12 justify-center px-7 sm:col-span-2">
        Search jobs
      </button>
    </form>
  )
}
