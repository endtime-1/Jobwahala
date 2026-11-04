import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

// Stock photography (Pexels licence), shown for mood.
const PATHS = [
  {
    to: '/jobs',
    image: '/people/woman-laptop.webp',
    alt: 'A woman working on a laptop',
    kicker: 'I am looking for a job',
    title: 'Find a real job, apply in minutes',
    body: 'Search open roles, check the company, and track your application.',
  },
  {
    to: '/onboarding?role=employer',
    image: '/people/man-office.webp',
    alt: 'A man standing confidently in an office',
    kicker: 'I am hiring for my company',
    title: 'Post jobs people can trust',
    body: 'Publish a role free, build your company page, and review applicants in one place.',
  },
]

export default function PathCards() {
  return (
    <div>
    <div className="grid gap-5 md:grid-cols-2">
      {PATHS.map((path) => (
        <Link
          key={path.to}
          to={path.to}
          className="group relative block aspect-[4/5] overflow-hidden rounded-[2rem] bg-primary shadow-premium-lg sm:aspect-[4/3] md:aspect-[4/3]"
        >
          <img
            src={path.image}
            alt={path.alt}
            width={560}
            height={700}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/55 to-transparent" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-7">
            <p className="text-sm font-extrabold text-gold">{path.kicker}</p>
            <h3 className="mt-1 text-2xl font-black leading-tight tracking-tight">{path.title}</h3>
            <p className="mt-2 text-sm font-medium text-white/75">{path.body}</p>
            <span className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-gold text-primary transition-transform group-hover:rotate-12">
              <ArrowUpRight className="h-5 w-5" />
            </span>
          </div>
        </Link>
      ))}
    </div>
    <p className="mt-5 text-center text-base font-medium text-text-muted">
      Also here: freelancers can list a service and get hired.{' '}
      <Link to="/freelancers" className="font-extrabold text-secondary hover:underline">
        See freelancers
      </Link>
    </p>
    </div>
  )
}
