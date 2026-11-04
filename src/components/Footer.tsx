import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Logo from './Logo'

const footerColumns = [
  {
    title: 'For job seekers',
    links: [
      ['Browse jobs', '/jobs'],
      ['Find freelance gigs', '/freelancers'],
      ['Build a free CV', '/cv-generator'],
      ['My dashboard', '/dashboard'],
    ],
  },
  {
    title: 'For employers',
    links: [
      ['Post a job', '/onboarding?role=employer'],
      ['Find freelancers', '/freelancers'],
      ['Proposals', '/proposals'],
      ['Agreements', '/agreements'],
    ],
  },
  {
    title: 'Learn and get help',
    links: [
      ['Guides and articles', '/blog'],
      ['Help centre', '/support'],
      ['Terms of service', '/terms'],
      ['Privacy policy', '/privacy'],
    ],
  },
]

export default function Footer() {
  return (
    <footer className="relative mt-8 bg-primary pb-36 text-white xl:pb-10">
      <div className="heritage-strip absolute inset-x-0 top-0" aria-hidden />
      <div className="container pt-14">
        <div className="flex flex-col gap-6 rounded-3xl bg-white/[0.06] p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              Ready to work <span className="text-gold">without the wahala?</span>
            </h2>
            <p className="mt-2 text-base font-medium text-white/70">
              Joining is free. Payment stays protected until the work is done.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/onboarding?role=seeker" className="btn btn-gold btn-lg justify-center px-7">
              Find work <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/onboarding?role=employer"
              className="btn btn-lg justify-center border-white/25 bg-white/10 px-7 text-white hover:bg-white/20"
            >
              Hire people
            </Link>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-10 lg:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div className="col-span-2 max-w-sm lg:col-span-1">
            <Link to="/" className="inline-flex">
              <Logo tone="dark" size={40} />
            </Link>
            <p className="mt-5 text-base font-medium leading-relaxed text-white/65">
              Jobs and freelance work across Africa, with payments held safely until the work is approved.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="text-base font-extrabold text-white">{column.title}</h3>
              <div className="mt-4 flex flex-col gap-3">
                {column.links.map(([label, href]) => (
                  <Link
                    key={label}
                    to={href}
                    className="text-base font-medium text-white/65 transition-colors hover:text-gold"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm font-medium text-white/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} JobWahala. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/support" className="hover:text-white">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
