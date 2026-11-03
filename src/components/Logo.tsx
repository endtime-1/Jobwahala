import { useId } from 'react'

type LogoMarkProps = {
  size?: number
  className?: string
}

/**
 * The JobWahala mark: a "j" that is also a person (dot for the head, hooked stem for the body),
 * with a coin-style gold dot for value and secured payment. Same artwork as /logo-mark.svg.
 */
export function LogoMark({ size = 40, className = '' }: LogoMarkProps) {
  const gradientId = `jw-${useId().replace(/:/g, '')}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="JobWahala"
      className={`flex-none ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14306b" />
          <stop offset="1" stopColor="#2f6df6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <g transform="translate(-1 -1)">
        <circle cx="40" cy="15.5" r="6.6" fill="#ffc531" />
        <circle cx="40" cy="15.5" r="3.2" fill="none" stroke="#c98a00" strokeWidth="1.6" />
        <path
          d="M40 28V42c0 6-4.4 10-10.6 10-4.6 0-8-2.4-9.4-6.2"
          fill="none"
          stroke="#fff"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

type LogoProps = {
  /** "light" for white backgrounds, "dark" for navy or photo backgrounds. */
  tone?: 'light' | 'dark'
  size?: number
  className?: string
}

export default function Logo({ tone = 'light', size = 36, className = '' }: LogoProps) {
  const isDark = tone === 'dark'

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span
        className={`font-black tracking-tight ${isDark ? 'text-white' : 'text-text-main'}`}
        style={{ fontSize: Math.round(size * 0.58), letterSpacing: '-0.03em' }}
      >
        Job<span className={isDark ? 'text-[#7aa2ff]' : 'text-secondary'}>Wahala</span>
      </span>
    </span>
  )
}
