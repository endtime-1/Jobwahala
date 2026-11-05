import { toDateInputValue } from '../../../lib/jobLifecycle'
import { isEarlyCareerType } from '../../../lib/earlyCareer'

/** The early-career part of the job form. */
export type EarlyCareerForm = {
  type: string
  unpaid: boolean
  durationMonths: string
  startMode: 'IMMEDIATE' | 'DATE'
  startDate: string
  schedule: string
  possibleJobOffer: boolean
}

type Props = {
  form: EarlyCareerForm
  onChange: (patch: Partial<EarlyCareerForm>) => void
}

/** Stipend, duration, start, hours and the job-offer tag. Only shown for internships, NSS, attachments and graduate jobs. */
export default function EarlyCareerFields({ form, onChange }: Props) {
  if (!isEarlyCareerType(form.type)) return null

  return (
    <fieldset className="space-y-4 rounded-2xl border border-secondary/20 bg-secondary/5 p-4 md:col-span-2">
      <legend className="px-2 text-sm font-black text-text-main">About this opportunity</legend>

      <label className="flex items-center gap-3 text-sm font-bold text-text-main">
        <input type="checkbox" checked={form.unpaid} onChange={(e) => onChange({ unpaid: e.target.checked })} />
        This role is unpaid (it will say &quot;Unpaid&quot; on the job)
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-bold text-text-main">
          How long does it last? (months)
          <input
            type="number"
            min={1}
            max={36}
            inputMode="numeric"
            value={form.durationMonths}
            onChange={(e) => onChange({ durationMonths: e.target.value })}
            placeholder="e.g. 3"
            className="h-12 text-base font-semibold"
          />
        </label>

        <label className="space-y-1.5 text-sm font-bold text-text-main">
          Part-time or full-time?
          <select value={form.schedule} onChange={(e) => onChange({ schedule: e.target.value })} className="h-12 text-base font-semibold">
            <option value="">Not stated</option>
            <option value="FULL_TIME">Full-time</option>
            <option value="PART_TIME">Part-time</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm font-bold text-text-main">
          When does it start?
          <select
            value={form.startMode}
            onChange={(e) => onChange({ startMode: e.target.value as EarlyCareerForm['startMode'] })}
            className="h-12 text-base font-semibold"
          >
            <option value="IMMEDIATE">Immediately</option>
            <option value="DATE">On a date</option>
          </select>
        </label>

        {form.startMode === 'DATE' ? (
          <label className="space-y-1.5 text-sm font-bold text-text-main">
            Start date
            <input
              type="date"
              value={form.startDate}
              min={toDateInputValue(new Date())}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className="h-12 text-base font-semibold"
              required
            />
          </label>
        ) : null}
      </div>

      <label className="flex items-center gap-3 text-sm font-bold text-text-main">
        <input type="checkbox" checked={form.possibleJobOffer} onChange={(e) => onChange({ possibleJobOffer: e.target.checked })} />
        Possible job offer after
      </label>
    </fieldset>
  )
}
