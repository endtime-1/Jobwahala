import type { ReactNode } from 'react'

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE = /\+?\d[\d\s-]{7,13}\d/g

const ghanaNumber = (raw: string) => {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('233')) return digits
  if (digits.startsWith('0')) return `233${digits.slice(1)}`
  return digits
}

/**
 * Makes the contact details in "How to apply" easy to use: an email address opens the mail app, and a phone number on a
 * WhatsApp line opens WhatsApp (any other number opens the dialler). Everything else stays as written.
 */
export const linkContacts = (text: string): ReactNode[] =>
  text.split('\n').flatMap((line, lineIndex, lines) => {
    const whatsapp = /whatsapp/i.test(line)
    const parts: ReactNode[] = []
    let last = 0
    const matches = [...Array.from(line.matchAll(EMAIL), (m) => ({ kind: 'email' as const, m })), ...Array.from(line.matchAll(PHONE), (m) => ({ kind: 'phone' as const, m }))].sort(
      (a, b) => (a.m.index ?? 0) - (b.m.index ?? 0),
    )

    for (const { kind, m } of matches) {
      const start = m.index ?? 0
      if (start < last) continue
      parts.push(line.slice(last, start))
      const href = kind === 'email' ? `mailto:${m[0]}` : whatsapp ? `https://wa.me/${ghanaNumber(m[0])}` : `tel:${m[0].replace(/\s/g, '')}`
      parts.push(
        <a key={`${lineIndex}-${start}`} href={href} className="text-primary underline" {...(whatsapp && kind === 'phone' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {m[0]}
        </a>,
      )
      last = start + m[0].length
    }
    parts.push(line.slice(last))
    if (lineIndex < lines.length - 1) parts.push('\n')
    return parts
  })
