import { Check, X } from 'lucide-react'

const OLD_WAY = [
  'Job posts that turn out to be fake',
  'Being asked to pay money just to apply',
  'Applying and never hearing back',
  'No way to tell a real company from a scam',
]

const NEW_WAY = [
  'Employers have company pages and can be verified',
  'Every job shows the pay and location up front',
  'Track each application and see when it moves',
  'Report any suspicious job with one click',
]

export default function OldVsNew() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-9">
        <p className="text-sm font-extrabold text-white/50">The usual way</p>
        <ul className="mt-5 space-y-4">
          {OLD_WAY.map((item) => (
            <li key={item} className="flex items-start gap-3 text-base font-semibold text-white/60 sm:text-lg">
              <span className="mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-error/20 text-error">
                <X className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-gold via-[#ffd45e] to-[#f2b01c] p-6 text-primary shadow-[0_30px_80px_-30px_rgba(255,197,49,0.6)] sm:p-9">
        <p className="text-sm font-extrabold text-primary/70">On JobWahala</p>
        <ul className="mt-5 space-y-4">
          {NEW_WAY.map((item) => (
            <li key={item} className="flex items-start gap-3 text-base font-extrabold sm:text-lg">
              <span className="mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-gold">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
