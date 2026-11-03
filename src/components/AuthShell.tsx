import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import Logo from './Logo'

// Stock photography (Pexels licence): sets the mood, not a list of members.
const PHOTOS = [
  { src: '/people/woman-desk.webp', alt: 'A woman laughing during a work call' },
  { src: '/people/man-office.webp', alt: 'A man standing confidently in an office' },
  { src: '/people/woman-portrait.webp', alt: 'A smiling young woman' },
]

type AuthAsideProps = {
  headline: string
  accent: string
  points: string[]
}

/** The dark brand panel shown beside sign-in and sign-up forms on large screens. */
export function AuthAside({ headline, accent, points }: AuthAsideProps) {
  return (
    <aside
      className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex lg:w-[50%] xl:p-14"
      style={{
        background:
          'radial-gradient(700px 420px at 100% 0%, rgba(47,109,246,0.45), transparent 60%), radial-gradient(520px 320px at 0% 100%, rgba(255,197,49,0.16), transparent 60%), #101a2b',
      }}
    >
      <div className="heritage-strip absolute inset-x-0 top-0" aria-hidden />
      <Link to="/" className="relative z-10 inline-flex">
        <Logo tone="dark" size={38} />
      </Link>

      <div className="relative z-10 mt-10">
        <h2 className="text-5xl font-black leading-[1.05] tracking-tight xl:text-6xl">
          {headline} <span className="text-gold">{accent}</span>
        </h2>
        <ul className="mt-8 space-y-3.5">
          {points.map((point) => (
            <li key={point} className="flex items-center gap-3 text-base font-semibold text-white/85">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold text-primary">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 mt-10">
        <div className="grid grid-cols-3 gap-3">
          {PHOTOS.map((photo, index) => (
            <img
              key={photo.src}
              src={photo.src}
              alt={photo.alt}
              width={560}
              height={700}
              loading="lazy"
              decoding="async"
              className={`aspect-[4/5] w-full rounded-2xl object-cover ${index === 1 ? 'mt-6 ring-1 ring-white/20' : 'ring-2 ring-gold/70'}`}
            />
          ))}
        </div>
        <p className="mt-4 text-xs font-medium text-white/50">
          © {new Date().getFullYear()} JobWahala · Photography: Pexels, illustrative
        </p>
      </div>
    </aside>
  )
}

type AuthMobileBannerProps = {
  linkTo: string
  linkLabel: string
  tagline: string
}

/** Slim brand header above the form on phones and tablets. */
export function AuthMobileBanner({ linkTo, linkLabel, tagline }: AuthMobileBannerProps) {
  return (
    <div
      className="relative overflow-hidden px-5 pb-8 pt-7 text-white lg:hidden"
      style={{
        background:
          'radial-gradient(420px 220px at 100% 0%, rgba(47,109,246,0.5), transparent 60%), #101a2b',
      }}
    >
      <div className="heritage-strip absolute inset-x-0 top-0" aria-hidden />
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex">
          <Logo tone="dark" size={34} />
        </Link>
        <Link to={linkTo} className="rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-primary">
          {linkLabel}
        </Link>
      </div>
      <p className="mt-6 text-3xl font-black leading-tight tracking-tight">{tagline}</p>
    </div>
  )
}
