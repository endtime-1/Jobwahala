import type { JobApplicant } from './types'

export type BoardStage = {
  status: 'SUBMITTED' | 'SHORTLISTED' | 'INTERVIEW' | 'HIRED' | 'REJECTED'
  label: string
  hint: string
}

export const BOARD_STAGES: BoardStage[] = [
  { status: 'SUBMITTED', label: 'New', hint: 'Just applied' },
  { status: 'SHORTLISTED', label: 'Shortlisted', hint: 'Worth a closer look' },
  { status: 'INTERVIEW', label: 'Interview', hint: 'Talking to them' },
  { status: 'HIRED', label: 'Hired', hint: 'Creates an agreement' },
  { status: 'REJECTED', label: 'Rejected', hint: 'Not moving forward' },
]

const STAGE_ORDER = BOARD_STAGES.map((stage) => stage.status)

export const groupApplicantsByStage = (applicants: JobApplicant[]) => {
  const groups = Object.fromEntries(STAGE_ORDER.map((status) => [status, [] as JobApplicant[]])) as Record<
    BoardStage['status'],
    JobApplicant[]
  >

  for (const applicant of applicants) {
    const stage = STAGE_ORDER.includes(applicant.status as BoardStage['status'])
      ? (applicant.status as BoardStage['status'])
      : 'SUBMITTED'
    groups[stage].push(applicant)
  }

  // Strongest fit first, then newest, so the best candidates float to the top of every column.
  for (const stage of STAGE_ORDER) {
    groups[stage].sort(
      (a, b) =>
        (b.fitScore ?? -1) - (a.fitScore ?? -1) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }

  return groups
}

/** The natural next step for the "advance" button; hired and rejected are end states. */
export const nextStage = (status: string): BoardStage['status'] | null => {
  if (status === 'SUBMITTED') return 'SHORTLISTED'
  if (status === 'SHORTLISTED') return 'INTERVIEW'
  if (status === 'INTERVIEW') return 'HIRED'
  return null
}

/** Moving to these stages is hard to undo (creates an agreement, or notifies a rejection). */
export const needsConfirmation = (status: string) => status === 'HIRED' || status === 'REJECTED'
