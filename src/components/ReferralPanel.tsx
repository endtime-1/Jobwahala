import { useEffect, useState } from 'react'
import { Copy, Gift, MessageCircle } from 'lucide-react'
import { apiGetMyReferral } from '../lib/api'
import type { ReferralInfo } from '../lib/growth'

/** An employer's own referral link. When a company that signed up with it posts its first job, the employer earns a free featured listing. */
export default function ReferralPanel() {
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = (await apiGetMyReferral()) as { referral: ReferralInfo }
        if (!cancelled) setInfo(result.referral)
      } catch {
        // A convenience: the dashboard works without it.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!info) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Copying can be blocked; the link is still on the screen to select.
    }
  }

  return (
    <section aria-label="Refer an employer" className="dashboard-panel mb-8 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-black text-text-main">
        <Gift className="h-4 w-4 text-secondary" aria-hidden /> Refer an employer, get a free featured listing
      </h2>
      <p className="mt-1 text-xs font-medium text-text-muted">
        Share your link. When a company you referred posts its first job, you get one featured credit.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input readOnly aria-label="Your referral link" value={info.url} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm font-semibold text-text-main" />
        <div className="flex gap-2">
          <button type="button" onClick={() => void copy()} className="btn btn-outline btn-sm">
            <Copy className="h-4 w-4" aria-hidden /> {copied ? 'Copied' : 'Copy link'}
          </button>
          <a href={info.whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#25d366] bg-white px-4 py-2 text-sm font-extrabold text-[#128c4a] transition-colors hover:bg-[#25d366] hover:text-white">
            <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
          </a>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-text-muted">
        {info.referred} {info.referred === 1 ? 'company' : 'companies'} joined with your link · {info.rewarded} posted a job · {info.creditsEarned} free featured {info.creditsEarned === 1 ? 'credit' : 'credits'} earned
      </p>
    </section>
  )
}
