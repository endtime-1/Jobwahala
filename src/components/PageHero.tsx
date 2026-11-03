import type { ReactNode } from 'react'

type PageHeroProps = {
  eyebrow: string
  title: string
  /** Shown in gold after the title. */
  accent?: string
  children?: ReactNode
  className?: string
}

export const heroBackground =
  'radial-gradient(700px 360px at 100% 0%, rgba(47,109,246,0.5), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(255,197,49,0.16), transparent 60%), #101a2b'

/** The dark header at the top of content pages, so every page starts with the same bold look. */
export default function PageHero({ eyebrow, title, accent, children, className = '' }: PageHeroProps) {
  return (
    <header
      className={`relative overflow-hidden rounded-[2rem] px-5 py-9 text-white sm:px-9 sm:py-12 ${className}`}
      style={{ background: heroBackground }}
    >
      <div className="heritage-strip absolute inset-x-0 top-0" aria-hidden />
      <p className="page-eyebrow">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
        {title}
        {accent ? <> <span className="text-gold">{accent}</span></> : null}
      </h1>
      {children}
    </header>
  )
}
