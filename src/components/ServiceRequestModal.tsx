import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, BriefcaseBusiness, Sparkles } from 'lucide-react'
import { apiCreateServiceRequest, apiGetServiceRequestCoaching } from '../lib/api'

interface ServiceRequestModalProps {
  isOpen: boolean
  onClose: () => void
  serviceId: string
  serviceTitle: string
  freelancerName: string
}

const initialForm = {
  message: '',
  budget: '',
  timeline: '',
}

type ServiceRequestCoaching = {
  score: number
  headline: string
  strengths: string[]
  gaps: string[]
  suggestedMessage: string
  suggestedBudget: string
  suggestedTimeline: string
}

export default function ServiceRequestModal({
  isOpen,
  onClose,
  serviceId,
  serviceTitle,
  freelancerName,
}: ServiceRequestModalProps) {
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const [coaching, setCoaching] = useState<ServiceRequestCoaching | null>(null)
  const [isCoachingLoading, setIsCoachingLoading] = useState(false)
  const [coachingError, setCoachingError] = useState('')

  const resetState = () => {
    setForm(initialForm)
    setIsSubmitting(false)
    setIsSuccess(false)
    setError('')
    setCoaching(null)
    setIsCoachingLoading(false)
    setCoachingError('')
  }

  useEffect(() => {
    if (!isOpen) return

    setIsCoachingLoading(true)
    setCoachingError('')

    apiGetServiceRequestCoaching(serviceId)
      .then((data) => {
        setCoaching((data.coaching || null) as ServiceRequestCoaching | null)
      })
      .catch((err: any) => {
        setCoachingError(err.message || 'Unable to load service request coaching right now.')
      })
      .finally(() => {
        setIsCoachingLoading(false)
      })
  }, [isOpen, serviceId])

  if (!isOpen) return null

  const handleClose = () => {
    resetState()
    onClose()
  }

  const applySuggestedDraft = () => {
    if (!coaching) return

    setForm((current) => ({
      ...current,
      message: coaching.suggestedMessage || current.message,
      budget: coaching.suggestedBudget || current.budget,
      timeline: coaching.suggestedTimeline || current.timeline,
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await apiCreateServiceRequest(serviceId, form)
      setIsSuccess(true)
      setTimeout(() => {
        handleClose()
      }, 1800)
    } catch (err: any) {
      setError(err.message || 'Unable to send your service request right now.')
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
      <div className="absolute inset-0 bg-text-main/60 backdrop-blur-md animate-in fade-in duration-300" onClick={handleClose}></div>
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl m-auto shrink-0 relative z-10 shadow-premium-2xl animate-in zoom-in duration-300">
        <div className="p-10">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-black text-text-main tracking-tighter uppercase flex items-center gap-3">
                <BriefcaseBusiness className="h-8 w-8 text-secondary" /> Request Service
              </h2>
              <p className="mt-3 text-sm font-semibold text-text-muted">
                Send a scoped project brief for <span className="text-text-main">{serviceTitle}</span> to {freelancerName}.
              </p>
            </div>
            <button onClick={handleClose} className="p-3 hover:bg-surface-alt rounded-2xl transition-all">
              <X className="h-6 w-6 text-text-light" />
            </button>
          </div>

          {isSuccess ? (
            <div className="text-center py-10 animate-in zoom-in duration-300">
              <div className="h-20 w-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-6">
                <Send className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-black mb-2 text-text-main">Request Sent</h3>
              <p className="text-text-muted font-medium">The freelancer can now review this request from their dashboard.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="rounded-[2rem] border border-secondary/15 bg-secondary/5 p-5 sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-secondary">
                      <Sparkles className="h-4 w-4" /> Service Match Coach
                    </p>
                    <h3 className="mt-3 text-lg font-black text-text-main">
                      Build a tighter request before you send it.
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-text-muted">
                      Use AI suggestions to sharpen scope, budget, and timeline for {serviceTitle}.
                    </p>
                  </div>
                  {coaching ? (
                    <span className="badge bg-secondary text-white border-none text-[9px] uppercase tracking-widest">
                      {coaching.score}% fit
                    </span>
                  ) : null}
                </div>

                {isCoachingLoading ? (
                  <p className="mt-4 text-sm font-semibold text-text-light">
                    Loading request coaching for this service...
                  </p>
                ) : coaching ? (
                  <div className="mt-5 space-y-4">
                    <p className="text-sm font-semibold leading-relaxed text-text-main">
                      {coaching.headline}
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-surface-border bg-white/80 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-light">Strengths</p>
                        <div className="mt-2 space-y-2">
                          {coaching.strengths.map((item) => (
                            <p key={item} className="text-sm font-semibold leading-relaxed text-text-main">
                              {item}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-surface-border bg-white/80 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-light">Tighten before sending</p>
                        <div className="mt-2 space-y-2">
                          {coaching.gaps.map((item) => (
                            <p key={item} className="text-sm font-semibold leading-relaxed text-text-main">
                              {item}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={applySuggestedDraft}
                      className="btn btn-secondary btn-sm rounded-2xl px-5 text-[10px] font-black uppercase tracking-widest"
                    >
                      Use AI Request Draft
                    </button>
                  </div>
                ) : coachingError ? (
                  <p className="mt-4 text-sm font-semibold text-error">
                    {coachingError}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light block">Budget</label>
                  <input
                    type="text"
                    value={form.budget}
                    onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))}
                    placeholder="e.g. GHS 3,000 or Negotiable"
                    className="h-14 font-bold"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light block">Timeline</label>
                  <input
                    type="text"
                    value={form.timeline}
                    onChange={(event) => setForm((current) => ({ ...current, timeline: event.target.value }))}
                    placeholder="e.g. 2 weeks"
                    className="h-14 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light block">Project Brief</label>
                <textarea
                  required
                  value={form.message}
                  onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Describe what you need, expected deliverables, context, and success criteria..."
                  className="min-h-[180px] font-bold py-4"
                />
              </div>

              {error ? (
                <p className="text-sm font-semibold text-error bg-error/5 border border-error/10 rounded-2xl px-4 py-3">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary bg-secondary border-secondary text-white btn-lg w-full rounded-2xl shadow-secondary/20 flex items-center justify-center gap-3 font-black uppercase tracking-widest"
              >
                {isSubmitting ? 'Sending...' : 'Send Request'} <Send className="h-5 w-5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
