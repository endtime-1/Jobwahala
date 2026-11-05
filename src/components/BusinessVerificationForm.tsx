import { useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import EvidenceUploadField from './EvidenceUploadField'

export type BusinessVerificationValues = {
  registrationNumber: string
  documentUrl: string
  contactEmail: string
  contactPhone: string
  address: string
  details: string
}

type Props = {
  initial?: Partial<BusinessVerificationValues>
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (values: BusinessVerificationValues) => Promise<void> | void
}

const labelClass = 'mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-light'
const inputClass = 'w-full rounded-2xl border border-surface-border bg-surface px-4 py-3 text-sm text-text-main outline-none focus:border-primary'

/** What a company sends to become a Verified employer. */
export default function BusinessVerificationForm({ initial, isSubmitting, onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<BusinessVerificationValues>({
    registrationNumber: initial?.registrationNumber ?? '',
    documentUrl: initial?.documentUrl ?? '',
    contactEmail: initial?.contactEmail ?? '',
    contactPhone: initial?.contactPhone ?? '',
    address: initial?.address ?? '',
    details: initial?.details ?? '',
  })
  const [problem, setProblem] = useState('')

  const set = (key: keyof BusinessVerificationValues) => (value: string) => setValues((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!values.documentUrl.trim()) {
      setProblem('Upload your business registration certificate.')
      return
    }
    if (!values.contactEmail.trim() && !values.contactPhone.trim()) {
      setProblem('Add a company email or a company phone number.')
      return
    }
    setProblem('')
    await onSubmit(values)
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded-2xl border border-surface-border bg-white p-4">
      <div>
        <label htmlFor="bv-number" className={labelClass}>Registrar-General registration number</label>
        <input
          id="bv-number"
          value={values.registrationNumber}
          onChange={(event) => set('registrationNumber')(event.target.value)}
          required
          minLength={3}
          maxLength={40}
          className={inputClass}
          placeholder="e.g. CS123456789"
        />
      </div>

      <EvidenceUploadField
        category="verification"
        label="Registration certificate"
        value={values.documentUrl}
        onChange={set('documentUrl')}
        disabled={isSubmitting}
        placeholder="https://..."
        helperText="Upload a clear PDF or photo of your certificate of incorporation or registration."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="bv-email" className={labelClass}>Company email</label>
          <input
            id="bv-email"
            type="email"
            value={values.contactEmail}
            onChange={(event) => set('contactEmail')(event.target.value)}
            className={inputClass}
            placeholder="hr@yourcompany.com"
          />
          <p className="mt-1.5 text-[11px] font-semibold text-text-muted">Add an email, a phone or both. We send a 6-digit code to confirm it.</p>
        </div>
        <div>
          <label htmlFor="bv-phone" className={labelClass}>Company phone</label>
          <input
            id="bv-phone"
            type="tel"
            value={values.contactPhone}
            onChange={(event) => set('contactPhone')(event.target.value)}
            className={inputClass}
            placeholder="024 123 4567"
          />
          <p className="mt-1.5 text-[11px] font-semibold text-text-muted">A Ghana mobile number; we can text the code to it.</p>
        </div>
      </div>

      <div>
        <label htmlFor="bv-address" className={labelClass}>Physical address</label>
        <textarea
          id="bv-address"
          value={values.address}
          onChange={(event) => set('address')(event.target.value)}
          required
          minLength={10}
          maxLength={300}
          className={`${inputClass} min-h-[84px]`}
          placeholder="Building or street, area, town, region"
        />
      </div>

      <div>
        <label htmlFor="bv-details" className={labelClass}>Anything else we should know (optional)</label>
        <textarea
          id="bv-details"
          value={values.details}
          onChange={(event) => set('details')(event.target.value)}
          maxLength={2000}
          className={`${inputClass} min-h-[72px]`}
        />
      </div>

      {problem ? (
        <p role="alert" className="text-sm font-bold text-error">
          {problem}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onCancel} className="text-[10px] font-black uppercase tracking-widest text-text-light hover:text-text-main">
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
  )
}
