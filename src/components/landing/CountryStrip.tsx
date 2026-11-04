import { Link } from 'react-router-dom'
import { buildJobSearchPath } from '../../lib/jobSearch'

// Quick job-search shortcuts. They search the job board; they do not claim a presence in each country.
const PLACES = ['Ghana', 'Nigeria', 'Kenya', 'South Africa', 'Rwanda', 'Senegal', 'Tanzania', 'Uganda', 'Ethiopia', 'Egypt', 'Remote']

export default function CountryStrip() {
  const row = (hidden: boolean) =>
    PLACES.map((place) => (
      <Link
        key={`${place}-${hidden}`}
        to={buildJobSearchPath('', place)}
        tabIndex={hidden ? -1 : 0}
        className="group flex flex-none items-center gap-3 text-lg font-extrabold text-white/80 transition-colors hover:text-gold sm:text-xl"
      >
        {place}
        <span className="h-1.5 w-1.5 rounded-full bg-gold/70" aria-hidden />
      </Link>
    ))

  return (
    <section aria-label="Search jobs by country" className="border-y border-white/10 bg-[#0b1322] py-5">
      <div className="container mb-3">
        <p className="text-sm font-bold text-white/50">Search jobs in</p>
      </div>
      <div className="marquee overflow-hidden">
        <div className="marquee-track flex w-max items-center gap-8 pr-8">
          {row(false)}
          <span className="contents" aria-hidden>
            {row(true)}
          </span>
        </div>
      </div>
    </section>
  )
}
