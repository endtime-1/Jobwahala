import { describe, expect, it } from 'vitest'
import { groupApplicantsByStage, needsConfirmation, nextStage } from './board'
import type { JobApplicant } from './types'

const applicant = (id: string, status: string, fitScore?: number, createdAt = '2026-03-01T00:00:00Z'): JobApplicant => ({
  id,
  status,
  createdAt,
  fitScore,
  seeker: { id: `s-${id}`, email: `${id}@example.com` },
})

describe('groupApplicantsByStage', () => {
  it('puts every applicant in its stage and keeps empty stages', () => {
    const groups = groupApplicantsByStage([
      applicant('a', 'SUBMITTED'),
      applicant('b', 'INTERVIEW'),
      applicant('c', 'HIRED'),
    ])

    expect(groups.SUBMITTED.map((x) => x.id)).toEqual(['a'])
    expect(groups.INTERVIEW.map((x) => x.id)).toEqual(['b'])
    expect(groups.HIRED.map((x) => x.id)).toEqual(['c'])
    expect(groups.SHORTLISTED).toEqual([])
    expect(groups.REJECTED).toEqual([])
  })

  it('sorts best fit first, then newest', () => {
    const groups = groupApplicantsByStage([
      applicant('low', 'SUBMITTED', 40),
      applicant('none-old', 'SUBMITTED', undefined, '2026-01-01T00:00:00Z'),
      applicant('high', 'SUBMITTED', 90),
      applicant('none-new', 'SUBMITTED', undefined, '2026-03-01T00:00:00Z'),
    ])

    expect(groups.SUBMITTED.map((x) => x.id)).toEqual(['high', 'low', 'none-new', 'none-old'])
  })

  it('treats an unknown status as new rather than losing the applicant', () => {
    expect(groupApplicantsByStage([applicant('x', 'WEIRD')]).SUBMITTED.map((x) => x.id)).toEqual(['x'])
  })
})

describe('nextStage and confirmation', () => {
  it('advances through the pipeline and stops at end states', () => {
    expect(nextStage('SUBMITTED')).toBe('SHORTLISTED')
    expect(nextStage('SHORTLISTED')).toBe('INTERVIEW')
    expect(nextStage('INTERVIEW')).toBe('HIRED')
    expect(nextStage('HIRED')).toBeNull()
    expect(nextStage('REJECTED')).toBeNull()
  })

  it('asks for confirmation only for hard-to-undo moves', () => {
    expect(needsConfirmation('HIRED')).toBe(true)
    expect(needsConfirmation('REJECTED')).toBe(true)
    expect(needsConfirmation('SHORTLISTED')).toBe(false)
  })
})
