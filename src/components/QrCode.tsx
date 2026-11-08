import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type Props = { value: string; label: string; size?: number; className?: string }

/** A QR code for a link, drawn as a crisp SVG picture (so it prints sharply at any size). */
export default function QrCode({ value, label, size = 200, className = '' }: Props) {
  const [source, setSource] = useState('')

  useEffect(() => {
    let cancelled = false
    void QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14306b', light: '#ffffff' } })
      .then((svg) => {
        if (!cancelled) setSource(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`)
      })
      .catch(() => {
        if (!cancelled) setSource('')
      })
    return () => {
      cancelled = true
    }
  }, [value])

  if (!source) return <div role="img" aria-label={`${label} (loading)`} style={{ width: size, height: size }} className={`animate-pulse rounded-xl bg-surface-alt ${className}`} />
  return <img src={source} alt={label} width={size} height={size} className={className} data-qr-value={value} />
}
