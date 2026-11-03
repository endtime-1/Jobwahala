import { useEffect, useRef, useState, type ReactNode } from 'react'

const prefersNoMotion = () =>
  typeof window === 'undefined' ||
  typeof IntersectionObserver === 'undefined' ||
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

type RevealProps = {
  children: ReactNode
  className?: string
  delay?: number
}

export default function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(prefersNoMotion)

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [shown])

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
