import { useState } from 'react'
import { getInitials } from '../lib/display'
import { tintFor } from '../lib/companyTint'

type CompanyLogoProps = {
  name: string
  logoUrl?: string | null
  /** Size and shape classes for the tile, e.g. "h-12 w-12 rounded-2xl text-base". */
  className?: string
}

export default function CompanyLogo({ name, logoUrl, className = 'h-12 w-12 rounded-2xl text-base' }: CompanyLogoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(logoUrl) && failedUrl !== logoUrl

  return (
    <div
      className={`flex flex-none items-center justify-center overflow-hidden font-black shadow-sm ${
        showImage ? 'border border-surface-border bg-white' : tintFor(name)
      } ${className}`}
    >
      {showImage ? (
        <img
          src={logoUrl as string}
          alt={`${name} logo`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(logoUrl ?? null)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <span aria-hidden>{getInitials(name)}</span>
      )}
    </div>
  )
}
