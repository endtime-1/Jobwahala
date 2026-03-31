import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Sparkles, X } from 'lucide-react'

export type ProposalDraft = {
  title: string
  summary: string
  amount: string
  timeline: string
  expiresAt: string
  message: string
}

type ProposalComposerModalProps = {
  isOpen: boolean
  heading: string
  subtitle: string
  defaultValue?: Partial<ProposalDraft>
  isSubmitting?: boolean
  isGenerating?: boolean
  error?: string
  submitLabel?: string
  onGenerate?: (draft: ProposalDraft) => Promise<Partial<ProposalDraft> | void> | void
  onClose: () => void
  onSubmit: (draft: ProposalDraft) => Promise<void> | void
}

const initialDraft: ProposalDraft = {
  title: '',
  summary: '',
  amount: '',
  timeline: '',
  expiresAt: '',
  message: '',
}

export default function ProposalComposerModal({
  isOpen,
  heading,
  subtitle,
  defaultValue,
  isSubmitting = false,
  isGenerating = false,
  error = '',
  submitLabel = 'Send Proposal',
  onGenerate,
  onClose,
  onSubmit,
}: ProposalComposerModalProps) {
  const [draft, setDraft] = useState<ProposalDraft>(initialDraft)
  const [assistantError, setAssistantError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setAssistantError('')
    setDraft({
      ...initialDraft,
      ...defaultValue,
    })
  }, [defaultValue, isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#101a2b]/45 p-4 backdrop-blur-md sm:items-center">
      <div className="dashboard-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] p-5 shadow-premium-xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-surface-border/60 pb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Proposal Composer</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-text-main">{heading}</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-surface-border bg-white text-text-light transition-colors hover:text-text-main"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault()
            await onSubmit(draft)
          }}
          className="space-y-5"
        >
          {onGenerate ? (
            <div className="rounded-[1.6rem] border border-primary/10 bg-primary/5 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Copilot Assist</p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-text-muted">
                    Generate a stronger first draft from the current proposal context and any hints you already entered.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setAssistantError('')
                      const nextDraft = await onGenerate(draft)

                      if (nextDraft) {
                        setDraft((current) => ({
                          ...current,
                          ...nextDraft,
                        }))
                      }
                    } catch (nextError: any) {
                      setAssistantError(nextError?.message || 'Unable to generate a proposal draft right now.')
                    }
                  }}
                  disabled={isGenerating}
                  className="btn btn-outline btn-sm shrink-0 gap-2 rounded-2xl border-primary/15 bg-white text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? 'Generating...' : 'Generate AI Draft'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-3 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Proposal Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Project proposal title"
                className="h-14 font-bold"
                required
              />
            </div>

            <div className="space-y-3 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Terms Summary</label>
              <textarea
                value={draft.summary}
                onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
                placeholder="Outline the scope, deliverables, and expectations."
                className="min-h-[160px] py-4 font-bold"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Amount</label>
              <input
                type="text"
                value={draft.amount}
                onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                placeholder="GHS 5,000"
                className="h-14 font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Timeline</label>
              <input
                type="text"
                value={draft.timeline}
                onChange={(event) => setDraft((current) => ({ ...current, timeline: event.target.value }))}
                placeholder="3 weeks"
                className="h-14 font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Expires On</label>
              <input
                type="date"
                value={draft.expiresAt}
                onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value }))}
                className="h-14 font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Negotiation Note</label>
              <input
                type="text"
                value={draft.message}
                onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))}
                placeholder="Optional note to explain these terms"
                className="h-14 font-bold"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
              {error}
            </p>
          ) : null}

          {assistantError ? (
            <p className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
              {assistantError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn btn-outline btn-lg rounded-2xl">
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-lg flex items-center justify-center gap-3 rounded-2xl font-black uppercase tracking-widest disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : submitLabel}
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
