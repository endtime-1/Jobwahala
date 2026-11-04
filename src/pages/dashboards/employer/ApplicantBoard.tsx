import { useMemo, useState, type DragEvent } from 'react'
import { ArrowRight, GripVertical } from 'lucide-react'
import { formatRelativeTime, getDisplayName } from '../../../lib/display'
import { BOARD_STAGES, groupApplicantsByStage, needsConfirmation, nextStage, type BoardStage } from './board'
import { getFitScoreBadgeClass } from './utils'
import type { JobApplicant } from './types'

type Props = {
  applicants: JobApplicant[]
  busy: boolean
  onMove: (applicationId: string, status: BoardStage['status']) => void
  onReview: (applicationId: string) => void
}

const confirmMove = (name: string, status: BoardStage['status']) => {
  if (!needsConfirmation(status)) return true
  if (status === 'OFFERED') return window.confirm(`Make ${name} an offer? We will tell them by email and in the app.`)
  if (status === 'HIRED') return window.confirm(`Mark ${name} as hired? We will tell them by email and in the app.`)
  return window.confirm(`Move ${name} to Rejected? We will send them a polite message by email and in the app.`)
}

export default function ApplicantBoard({ applicants, busy, onMove, onReview }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)
  const groups = useMemo(() => groupApplicantsByStage(applicants), [applicants])
  const byId = useMemo(() => new Map(applicants.map((applicant) => [applicant.id, applicant])), [applicants])

  const nameOf = (applicant: JobApplicant) =>
    getDisplayName(
      applicant.seeker.jobSeekerProfile?.firstName,
      applicant.seeker.jobSeekerProfile?.lastName,
      applicant.seeker.email,
    )

  const move = (applicant: JobApplicant, status: BoardStage['status']) => {
    if (busy || applicant.status === status) return
    if (!confirmMove(nameOf(applicant), status)) return
    onMove(applicant.id, status)
  }

  const onDrop = (event: DragEvent, status: BoardStage['status']) => {
    event.preventDefault()
    const applicant = dragId ? byId.get(dragId) : undefined
    setDragId(null)
    setOverStage(null)
    if (applicant) move(applicant, status)
  }

  return (
    <div
      className="relative -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0"
      aria-label="Hiring pipeline"
    >
      {BOARD_STAGES.map((stage) => {
        const cards = groups[stage.status]
        const isOver = overStage === stage.status && dragId !== null

        return (
          <section
            key={stage.status}
            aria-label={`${stage.label} column`}
            onDragOver={(event) => {
              event.preventDefault()
              setOverStage(stage.status)
            }}
            onDragLeave={() => setOverStage((current) => (current === stage.status ? null : current))}
            onDrop={(event) => onDrop(event, stage.status)}
            className={`w-[17rem] flex-none snap-start self-start rounded-[1.5rem] border p-3 transition-colors ${
              isOver ? 'border-secondary bg-secondary-light/60' : 'border-surface-border bg-surface-alt/25'
            }`}
          >
            <header className="mb-3 flex items-center justify-between px-1">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-text-main">{stage.label}</h3>
                <p className="text-[10px] font-semibold text-text-light">{stage.hint}</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-text-main shadow-sm">{cards.length}</span>
            </header>

            <div className="space-y-3">
              {cards.length === 0 && (
                <p className="rounded-2xl border border-dashed border-surface-border px-3 py-6 text-center text-xs font-semibold text-text-light">
                  Drop a candidate here
                </p>
              )}

              {cards.map((applicant) => {
                const name = nameOf(applicant)
                const next = nextStage(applicant.status)
                const nextLabel = next ? BOARD_STAGES.find((item) => item.status === next)?.label : null

                return (
                  <article
                    key={applicant.id}
                    draggable={!busy}
                    onDragStart={() => setDragId(applicant.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverStage(null)
                    }}
                    className={`rounded-2xl border border-surface-border bg-white p-3 shadow-premium-sm ${
                      dragId === applicant.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <GripVertical className="mt-0.5 hidden h-4 w-4 flex-none cursor-grab text-text-light sm:block" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-text-main">{name}</p>
                          <p className="text-[11px] font-semibold text-text-light">{formatRelativeTime(applicant.createdAt)}</p>
                        </div>
                      </div>
                      {applicant.fitScore ? (
                        <span className={`badge flex-none border-none text-[9px] ${getFitScoreBadgeClass(applicant.fitScore)}`}>
                          {applicant.fitScore}% fit
                        </span>
                      ) : null}
                    </div>

                    {applicant.seeker.jobSeekerProfile?.skills ? (
                      <p className="mt-2 line-clamp-2 text-xs font-medium text-text-muted">{applicant.seeker.jobSeekerProfile.skills}</p>
                    ) : null}

                    <div className="mt-3 flex items-center gap-2">
                      {next && nextLabel ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => move(applicant, next)}
                          aria-label={`Move ${name} to ${nextLabel}`}
                          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                        >
                          {nextLabel} <ArrowRight className="h-3 w-3" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onReview(applicant.id)}
                        aria-label={`Review ${name}`}
                        className="min-h-9 rounded-xl border border-surface-border px-3 text-[11px] font-black uppercase tracking-wider text-text-muted hover:text-text-main"
                      >
                        Review
                      </button>
                    </div>

                    <label className="mt-2 block">
                      <span className="sr-only">Move {name} to another stage</span>
                      <select
                        value={applicant.status}
                        disabled={busy}
                        onChange={(event) => move(applicant, event.target.value as BoardStage['status'])}
                        className="h-9 w-full rounded-xl border border-surface-border bg-surface-alt/40 px-2 py-0 text-[11px] font-bold leading-none text-text-muted"
                      >
                        {BOARD_STAGES.map((item) => (
                          <option key={item.status} value={item.status}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
