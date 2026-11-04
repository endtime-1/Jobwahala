import { describe, expect, it } from 'vitest'
import { closingDateIn, closingSummary, daysUntil, defaultClosingDate, latestClosingDate } from './jobLifecycle'

const now = new Date('2026-11-04T10:00:00.000Z')

describe('closing date helpers', () => {
  it('defaults to 30 days out and allows at most 90', () => {
    expect(defaultClosingDate(now)).toBe('2026-12-04')
    expect(latestClosingDate(now)).toBe('2027-02-02')
    expect(closingDateIn(7, now)).toBe('2026-11-11')
  })

  it('counts days left, rounding up', () => {
    expect(daysUntil('2026-11-07T10:00:00.000Z', now)).toBe(3)
    expect(daysUntil('2026-11-07T11:00:00.000Z', now)).toBe(4)
    expect(daysUntil('2026-11-03T10:00:00.000Z', now)).toBeLessThanOrEqual(0)
    expect(daysUntil(undefined, now)).toBeNull()
    expect(daysUntil('nonsense', now)).toBeNull()
  })

  it('writes a plain summary', () => {
    expect(closingSummary('2026-11-14T23:59:59.999Z', now)).toBe('Closes 14 Nov 2026 (11 days left)')
    expect(closingSummary('2026-11-05T09:00:00.000Z', now)).toBe('Closes 5 Nov 2026 (1 day left)')
    expect(closingSummary('2026-11-01T23:59:59.999Z', now)).toBe('Closed on 1 Nov 2026')
    expect(closingSummary(undefined, now)).toBe('')
  })
})
