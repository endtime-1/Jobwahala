import { X, Send, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { apiCreateReport } from '../lib/api'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'job' | 'service' | 'user'
  targetId: string
  targetName: string
}

export default function ReportModal({ isOpen, onClose, type, targetId, targetName }: ReportModalProps) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await apiCreateReport(type, targetId, reason, details)
      setIsSubmitting(false)
      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        setReason('')
        setDetails('')
        onClose()
      }, 2000)
    } catch (err: any) {
      setIsSubmitting(false)
      setError(err.message || 'Unable to submit report right now.')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-text-main/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg relative z-10 shadow-premium-2xl animate-in zoom-in duration-300 overflow-hidden">
        <div className="p-10">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-black text-text-main tracking-tighter uppercase flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-error" /> Report {type}
            </h2>
            <button onClick={onClose} className="p-3 hover:bg-surface-alt rounded-2xl transition-all">
              <X className="h-6 w-6 text-text-light" />
            </button>
          </div>

          {isSuccess ? (
            <div className="text-center py-10 animate-in zoom-in duration-300">
               <div className="h-20 w-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-6">
                 <Send className="h-10 w-10" />
               </div>
               <h3 className="text-2xl font-black mb-2 text-text-main">Report Transmitted</h3>
               <p className="text-text-muted font-medium">Our trust and safety team will review this protocol.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-light mb-4 italic">Reporting: {targetName}</p>
                <div className="space-y-4">
                  {['Suspicious Activity', 'Misleading Information', 'Harassment', 'Spam', 'Other'].map((r) => (
                    <label key={r} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-alt border border-surface-border cursor-pointer hover:border-error transition-all group">
                      <div className="h-5 w-5 rounded-full border-2 border-surface-border group-hover:border-error transition-all flex items-center justify-center bg-white shadow-sm">
                        <div className="h-2 w-2 rounded-full bg-error opacity-0 group-has-[:checked]:opacity-100 transition-opacity"></div>
                      </div>
                      <input 
                        type="radio" 
                        name="reason" 
                        value={r} 
                        className="hidden" 
                        onChange={(e) => setReason(e.target.value)}
                        required
                      />
                      <span className="text-sm font-bold text-text-main">{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light block">Additional Details</label>
                <textarea 
                  placeholder="Provide more context for our trust team..." 
                  className="min-h-[120px] font-bold"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
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
                className="btn btn-primary bg-error border-error text-white btn-lg w-full rounded-2xl shadow-error/20 flex items-center justify-center gap-3 font-black uppercase tracking-widest"
              >
                {isSubmitting ? 'Transmitting...' : 'Submit Report'} <Send className="h-5 w-5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
