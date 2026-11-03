import { ArrowRight, Check, FileText, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

const POINTS = [
  'Write a few rough notes about what you have done, and AI drafts the CV for you',
  'Choose from 3 clean templates: Executive, Studio or Compact',
  'Download it as a Word file you can edit and send',
]

export default function CvBuilderSection() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
      <div>
        <ul className="space-y-3">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-[15px] font-semibold text-text-main">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>
        <Link to="/cv-generator" className="btn btn-primary btn-lg mt-8 justify-center px-8">
          Build my CV <ArrowRight className="h-5 w-5" />
        </Link>
        <p className="mt-3 text-sm font-medium text-text-muted">Included with your free profile.</p>
      </div>

      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1.15fr] sm:gap-3" aria-label="Example: notes turned into a CV">
        <div className="rounded-3xl border border-dashed border-surface-border bg-white/70 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-text-light">Your notes</p>
          <p className="mt-3 space-y-2 text-sm font-medium leading-relaxed text-text-muted">
            3 yrs front desk at a hotel, Kumasi.
            <br />
            handled bookings + complaints.
            <br />
            trained 2 new staff. good with Excel.
          </p>
        </div>

        <div className="flex items-center justify-center text-secondary" aria-hidden>
          <Sparkles className="h-6 w-6 rotate-90 sm:rotate-0" />
        </div>

        <div className="rounded-3xl border border-surface-border bg-white p-5 shadow-premium-md">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-secondary">
            <FileText className="h-4 w-4" /> Your CV
          </div>
          <p className="mt-3 text-lg font-black text-text-main">Ama Boateng</p>
          <p className="text-sm font-bold text-text-muted">Front Desk Receptionist</p>
          <ul className="mt-3 space-y-1.5 text-sm font-medium leading-relaxed text-text-muted">
            <li>• Managed reservations and resolved guest complaints at a busy Kumasi hotel.</li>
            <li>• Trained two new team members on front desk procedures.</li>
            <li>• Prepared daily occupancy reports in Excel.</li>
          </ul>
          <p className="mt-3 text-[11px] font-semibold text-text-light">Example only. Your CV uses your own details.</p>
        </div>
      </div>
    </div>
  )
}
