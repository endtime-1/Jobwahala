import { describe, expect, it } from 'vitest'
import {
  durationLabel,
  earlyCareerFacts,
  earlyCareerTypes,
  earlyFilterParams,
  emptyEarlyFilters,
  hasEarlyFilters,
  isEarlyCareerType,
  relevanceScore,
  sortByRelevance,
  startLabel,
  stipendLabel,
} from './earlyCareer'

describe('early-career types', () => {
  it('are the four we offer, matched without caring about case', () => {
    expect([...earlyCareerTypes]).toEqual(['Internship', 'National Service (NSS)', 'Industrial Attachment', 'Graduate / Entry-level Job'])
    expect(isEarlyCareerType('internship')).toBe(true)
    expect(isEarlyCareerType('Full-time')).toBe(false)
    expect(isEarlyCareerType(undefined)).toBe(false)
  })
})

describe('what is shown on a card', () => {
  it('says how long it lasts in plain words', () => {
    expect(durationLabel(1)).toBe('1 month')
    expect(durationLabel(3)).toBe('3 months')
    expect(durationLabel(12)).toBe('1 year')
    expect(durationLabel(24)).toBe('2 years')
    expect(durationLabel(null)).toBe('')
  })

  it('says when it starts', () => {
    expect(startLabel({ startsImmediately: true })).toBe('Starts immediately')
    expect(startLabel({ startDate: '2026-12-01T00:00:00.000Z' })).toBe('Starts 1 Dec 2026')
    expect(startLabel({})).toBe('')
  })

  it('says "Unpaid" for an unpaid role and shows the stipend otherwise', () => {
    expect(stipendLabel({ unpaid: true, salary: 'Unpaid' })).toBe('Unpaid')
    expect(stipendLabel({ salary: 'GHS 500 - 800 a month' })).toBe('GHS 500 - 800 a month')
    expect(stipendLabel({})).toBe('Stipend not stated')
  })

  it('lists the facts in order for an early-career job, and none for an ordinary one', () => {
    expect(earlyCareerFacts({ type: 'Internship', durationMonths: 3, schedule: 'PART_TIME', startsImmediately: true })).toEqual([
      '3 months',
      'Part-time',
      'Starts immediately',
    ])
    expect(earlyCareerFacts({ type: 'Full-time', durationMonths: 3 })).toEqual([])
  })
})

describe('the search the server gets', () => {
  const NOW = new Date('2026-11-06T09:00:00.000Z')

  it('always asks for the early-career section', () => {
    expect(earlyFilterParams(emptyEarlyFilters, NOW)).toEqual({ section: 'early' })
  })

  it('turns each filter into the matching setting', () => {
    expect(
      earlyFilterParams(
        { types: ['Internship', 'National Service (NSS)'], location: ' Accra ', stipend: '500', duration: '3', start: 'now', schedule: 'PART_TIME', offer: true, search: ' design ' },
        NOW,
      ),
    ).toEqual({
      section: 'early',
      types: 'Internship,National Service (NSS)',
      q: 'design',
      location: 'Accra',
      salaryMin: '500',
      maxDuration: '3',
      startsNow: '1',
      schedule: 'PART_TIME',
      offer: '1',
    })
  })

  it('"paid only" is its own setting, and "within 3 months" becomes a date', () => {
    expect(earlyFilterParams({ ...emptyEarlyFilters, stipend: 'paid' }, NOW)).toMatchObject({ paid: '1' })
    expect(earlyFilterParams({ ...emptyEarlyFilters, stipend: 'paid' }, NOW)).not.toHaveProperty('salaryMin')
    expect(earlyFilterParams({ ...emptyEarlyFilters, start: '3' }, NOW).startBy).toBe('2027-02-06')
  })

  it('leaves out anything that is not an early-career type', () => {
    expect(earlyFilterParams({ ...emptyEarlyFilters, types: ['Full-time'] }, NOW)).toEqual({ section: 'early' })
  })

  it('knows when a filter is in use', () => {
    expect(hasEarlyFilters(emptyEarlyFilters)).toBe(false)
    expect(hasEarlyFilters({ ...emptyEarlyFilters, offer: true })).toBe(true)
  })
});

describe('showing relevant opportunities first', () => {
  const jobs = [
    { id: 'a', type: 'Graduate / Entry-level Job' },
    { id: 'b', type: 'Internship' },
    { id: 'c', type: 'National Service (NSS)' },
    { id: 'd', type: 'Industrial Attachment' },
    { id: 'e', type: 'Internship' },
  ]
  const order = (stage: string | null) => sortByRelevance(jobs, stage).map((job) => job.id).join('')

  it('students see attachments and internships first', () => {
    expect(order('STUDENT')).toBe('dbeca')
  })

  it('NSS personnel see National Service, then graduate jobs', () => {
    expect(order('NSS')).toBe('cabed')
  })

  it('graduates see graduate jobs, then internships', () => {
    expect(order('GRADUATE')).toBe('abecd')
  })

  it('changes nothing without a stage, and keeps the newest-first order within a type', () => {
    expect(order(null)).toBe('abcde')
    expect(order('STUDENT').indexOf('b')).toBeLessThan(order('STUDENT').indexOf('e'))
  })

  it('scores a type higher the better it suits the stage', () => {
    expect(relevanceScore('STUDENT', 'Industrial Attachment')).toBeGreaterThan(relevanceScore('STUDENT', 'Graduate / Entry-level Job'))
    expect(relevanceScore(null, 'Internship')).toBe(0)
    expect(relevanceScore('STUDENT', 'Full-time')).toBe(0)
  })
})
