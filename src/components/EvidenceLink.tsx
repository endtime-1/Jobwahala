import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { isProtectedUploadUrl, openProtectedFile, useProtectedUrl } from '../lib/evidenceAccess'

type EvidenceLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
}

/**
 * A link to an uploaded file. Private uploads (ID documents, dispute evidence, attachments) are
 * opened through a short-lived signed link; any other address behaves like a normal link.
 */
export default function EvidenceLink({ href, onClick, children, ...rest }: EvidenceLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)

    if (event.defaultPrevented || !isProtectedUploadUrl(href)) return

    event.preventDefault()
    void openProtectedFile(href)
  }

  return (
    <a {...rest} href={href} target="_blank" rel="noreferrer" onClick={handleClick}>
      {children}
    </a>
  )
}

type ProtectedImageProps = {
  src: string
  alt: string
  className?: string
}

/** An image whose source may be a private upload. */
export function ProtectedImage({ src, alt, className }: ProtectedImageProps) {
  const resolved = useProtectedUrl(src)

  if (!resolved) {
    return <div className={`${className ?? ''} animate-pulse bg-surface-alt`} role="img" aria-label={alt} />
  }

  return <img src={resolved} alt={alt} className={className} />
}
