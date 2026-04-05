import { useState, type FormEvent } from 'react'
import { ShieldCheck, Send, Link2, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import VerifiedBadge from './VerifiedBadge'
import EvidenceUploadField from './EvidenceUploadField'

type VerificationState = {
  requiredType?: string | null
  verificationStatus?: string | null
  isVerified?: boolean
  latestVerificationRequest?: {
    id?: string
    type?: string
    status?: string
    details?: string
    documentUrl?: string | null
    reviewNote?: string | null
    reviewedAt?: string | null
    createdAt?: string
  } | null
  verificationHistory?: Array<{
    id?: string
    type?: string
    status?: string
    details?: string
    documentUrl?: string | null
    reviewNote?: string | null
    reviewedAt?: string | null
    createdAt?: string
  }>
}

type VerificationPanelProps = {
  type: 'seeker' | 'employer' | 'freelancer'
  verification?: VerificationState | null
  isSubmitting: boolean
  onSubmit: (payload: { details: string; documentUrl?: string }) => Promise<void> | void
}

const copyForType = {
  seeker: {
    title: 'Identity Verification',
    description: 'Verify your identity to increase trust with employers and unlock a stronger profile signal.',
  },
  employer: {
    title: 'Business Verification',
    description: 'Verify your company to show candidates that your jobs come from a trusted hiring team.',
  },
  freelancer: {
    title: 'Professional Verification',
    description: 'Verify your professional profile so clients can trust your services before they reach out.',
  },
} as const

export default function VerificationPanel({
  type,
  verification,
  isSubmitting,
  onSubmit,
}: VerificationPanelProps) {
  const [details, setDetails] = useState('')
  const [documentUrl, setDocumentUrl] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const status = verification?.verificationStatus || 'UNVERIFIED'
  const latestRequest = verification?.latestVerificationRequest || null
  const history = verification?.verificationHistory || []
  const priorHistory = latestRequest
    ? history.filter((entry) => entry.id !== latestRequest.id)
    : history
  const isVerified = Boolean(verification?.isVerified)
  const isPending = status === 'PENDING'
  const needsInfo = status === 'NEEDS_INFO'
  const isRejected = status === 'REJECTED'
  const copy = copyForType[type]
  const openForm = () => {
    setDetails((current) => current || latestRequest?.details || '')
    setDocumentUrl((current) => current || latestRequest?.documentUrl || '')
    setIsExpanded(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit({
      details,
      documentUrl: documentUrl || undefined,
    })
    setDetails('')
    setDocumentUrl('')
    setIsExpanded(false)
  }

  return (
    <div className="dashboard-panel p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-surface-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/10 text-success">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-black text-[10px] uppercase tracking-widest text-text-main">{copy.title}</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-text-muted">{copy.description}</p>
          </div>
        </div>
        {(isVerified || isPending || needsInfo) ? (
          <VerifiedBadge
            type={type}
            status={isVerified ? 'APPROVED' : needsInfo ? 'NEEDS_INFO' : 'PENDING'}
            showText
          />
        ) : null}
      </div>

      {isVerified ? (
        <div className="rounded-2xl border border-success/10 bg-success/5 p-4">
          <p className="text-sm font-black text-text-main">Verification is active.</p>
          <p className="mt-2 text-xs font-semibold text-text-muted">
            Your account now shows a trusted verification badge across supported public surfaces.
          </p>
          {latestRequest?.reviewedAt ? (
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-success">
              Approved {new Date(latestRequest.reviewedAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>
      ) : null}

      {isPending ? (
        <div className="rounded-2xl border border-accent/15 bg-accent/5 p-4">
          <p className="text-sm font-black text-text-main">Verification is under review.</p>
          <p className="mt-2 text-xs font-semibold text-text-muted">
            Submitted {latestRequest?.createdAt ? new Date(latestRequest.createdAt).toLocaleDateString() : 'recently'}.
          </p>
          {latestRequest?.documentUrl ? (
            <a
              href={latestRequest.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
            >
              <Link2 className="h-3.5 w-3.5" /> Review linked evidence
            </a>
          ) : null}
        </div>
      ) : null}

      {(status === 'UNVERIFIED' || isRejected || needsInfo) ? (
        <div className="space-y-4">
          <div className={`rounded-2xl border p-4 ${
            isRejected
              ? 'border-error/10 bg-error/5'
              : needsInfo
                ? 'border-secondary/10 bg-secondary/5'
                : 'border-surface-border bg-surface-alt/20'
          }`}>
            <p className="text-sm font-black text-text-main">
              {isRejected
                ? 'Verification needs another pass.'
                : needsInfo
                  ? 'More verification detail is required.'
                  : 'Verification has not been requested yet.'}
            </p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-text-muted">
              {needsInfo
                ? latestRequest?.reviewNote || 'An admin requested more detail before this verification can be approved.'
                : isRejected
                ? latestRequest?.reviewNote || 'Update your evidence and submit a stronger request.'
                : 'Share enough detail for the admin team to confirm your account.'}
            </p>
            {latestRequest?.documentUrl ? (
              <a
                href={latestRequest.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
              >
                <Link2 className="h-3.5 w-3.5" /> Review linked evidence
              </a>
            ) : null}
          </div>

          {isExpanded ? (
            <form onSubmit={(event) => void handleSubmit(event)} className="rounded-2xl border border-surface-border bg-white p-4">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                Verification Details
              </label>
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                required
                minLength={20}
                className="min-h-[120px] w-full rounded-3xl border border-surface-border bg-surface px-4 py-3 text-sm text-text-main outline-none focus:border-primary"
                placeholder="Explain how the team can verify your identity, business, or professional track record."
              />
              <div className="mt-4">
                <EvidenceUploadField
                  category="verification"
                  label="Evidence Link"
                  value={documentUrl}
                  onChange={setDocumentUrl}
                  disabled={isSubmitting}
                  placeholder="https://..."
                  helperText="Share a secure evidence link or upload a PDF/image directly."
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="text-[10px] font-black uppercase tracking-widest text-text-light hover:text-text-main"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary btn-sm font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
                >
                  Submit Request <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              {(type === 'seeker' || type === 'freelancer') ? (
                <Link
                  to="/verify-identity"
                  className="btn btn-secondary btn-sm font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 border-none bg-slate-900 text-white hover:bg-slate-800"
                >
                  <Zap className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                  Verify with Ghana Card
                </Link>
              ) : null}
              <button
                type="button"
                onClick={openForm}
                disabled={isSubmitting}
                className="btn btn-primary btn-sm font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
              >
                {needsInfo ? 'Update Verification' : isRejected ? 'Resubmit Verification' : type === 'employer' ? 'Request Business Verification' : 'Manual Verification Request'}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {priorHistory.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
              Previous verification submissions
            </p>
            <span className="badge bg-surface-alt text-text-main">
              {priorHistory.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {priorHistory.map((entry, index) => (
              <div key={entry.id || `${entry.status || 'verification'}-${index}`} className="rounded-2xl border border-surface-border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                    {(entry.type || copy.title) + ' / ' + (entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'Recently')}
                  </p>
                  <span className={`badge ${
                    entry.status === 'APPROVED'
                      ? 'bg-success text-white'
                      : entry.status === 'REJECTED'
                        ? 'bg-error text-white'
                        : entry.status === 'NEEDS_INFO'
                          ? 'bg-secondary text-white'
                          : 'bg-primary text-white'
                  }`}>
                    {entry.status || 'PENDING'}
                  </span>
                </div>
                {entry.details ? (
                  <p className="mt-3 text-xs font-medium leading-relaxed text-text-muted">{entry.details}</p>
                ) : null}
                {entry.reviewNote ? (
                  <p className="mt-3 rounded-2xl border border-surface-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted">
                    Review note: {entry.reviewNote}
                  </p>
                ) : null}
                {entry.documentUrl ? (
                  <a
                    href={entry.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Review linked evidence
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
