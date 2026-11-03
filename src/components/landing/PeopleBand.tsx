import { ArrowRight, BadgeCheck, Smartphone, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'

// Stock photography (Pexels licence). It sets the mood; it is not a list of members, so nothing
// here names a person or claims who they are.
const PHOTOS = [
  { src: '/people/woman-desk.webp', alt: 'A woman laughing during a work call at her desk' },
  { src: '/people/man-suit.webp', alt: 'A man in a suit in conversation' },
  { src: '/people/woman-laptop.webp', alt: 'A woman working on a laptop' },
  { src: '/people/man-laptop.webp', alt: 'A man working on a laptop outdoors' },
  { src: '/people/woman-portrait.webp', alt: 'A smiling young woman' },
  { src: '/people/man-office.webp', alt: 'A man standing confidently in an office' },
]

const PERKS = [
  { icon: WalletCards, text: 'Paid to mobile money or bank' },
  { icon: BadgeCheck, text: 'ID-verified people and companies' },
  { icon: Smartphone, text: 'Built for the phone in your hand' },
]

export default function PeopleBand() {
  return (
    <section className="relative overflow-hidden bg-primary py-16 text-white sm:py-24 [contain-intrinsic-size:auto_760px] [content-visibility:auto]">
      <div className="absolute inset-x-0 top-0 heritage-strip" aria-hidden />
      <div className="container grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[0.2em] text-gold">Talent without borders</p>
          <h2 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            From Accra to Nairobi to Lagos, <span className="text-gold">good work finds good people.</span>
          </h2>
          <p className="mt-5 max-w-lg text-base font-medium leading-relaxed text-white/75 sm:text-lg">
            Designers, developers, accountants, tutors and builders across the continent, working with employers who pay
            on time, because the money is secured before the work starts.
          </p>

          <ul className="mt-7 space-y-3">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-bold sm:text-base">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <Link to="/onboarding?role=seeker" className="btn btn-gold btn-lg mt-9 justify-center px-8">
            Join free in a minute <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4" aria-label="People at work across Africa">
          {[0, 1, 2].map((column) => (
            <div key={column} className={`flex flex-col gap-3 sm:gap-4 ${column === 1 ? 'mt-8 sm:mt-14' : ''}`}>
              {PHOTOS.slice(column * 2, column * 2 + 2).map((photo, index) => (
                <img
                  key={photo.src}
                  src={photo.src}
                  alt={photo.alt}
                  width={560}
                  height={700}
                  loading="lazy"
                  decoding="async"
                  className={`aspect-[4/5] w-full rounded-2xl object-cover sm:rounded-3xl ${
                    (column + index) % 2 === 0 ? 'ring-2 ring-gold/70' : 'ring-1 ring-white/15'
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="container mt-8 text-[12px] font-medium text-white/50">Photography: Pexels. Illustrative, not members.</p>
    </section>
  )
}
