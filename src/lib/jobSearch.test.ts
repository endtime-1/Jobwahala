import { describe, expect, it } from 'vitest'
import { buildJobSearchPath, countryFromSlug, countrySlug, matchesJobField, parseJobType } from './jobSearch'

describe('buildJobSearchPath', () => {
  it('goes to the plain jobs page when nothing was typed', () => {
    expect(buildJobSearchPath('', '')).toBe('/jobs')
    expect(buildJobSearchPath('   ', '  ')).toBe('/jobs')
  })

  it('carries a keyword, a town, or both', () => {
    expect(buildJobSearchPath('accountant', '')).toBe('/jobs?search=accountant')
    expect(buildJobSearchPath('', 'Kumasi')).toBe('/jobs?location=Kumasi')
    expect(buildJobSearchPath('accountant', 'Kumasi')).toBe('/jobs?search=accountant&location=Kumasi')
  })

  it('trims input and encodes special characters safely', () => {
    expect(buildJobSearchPath('  customer service & sales ', ' Port Harcourt ')).toBe(
      '/jobs?search=customer+service+%26+sales&location=Port+Harcourt',
    )
  })

  it('carries a field and a job type', () => {
    expect(buildJobSearchPath('', '', { category: 'Customer service', type: 'Full-time' })).toBe(
      '/jobs?category=Customer+service&type=Full-time',
    )
    expect(buildJobSearchPath('cook', 'Accra', { type: ' ' })).toBe('/jobs?search=cook&location=Accra')
  })
})

describe('parseJobType', () => {
  it('accepts known types in any letter case', () => {
    expect(parseJobType('full-time')).toBe('Full-time')
    expect(parseJobType(' CONTRACT ')).toBe('Contract')
  })

  it('ignores anything else', () => {
    expect(parseJobType('forever')).toBeNull()
    expect(parseJobType('')).toBeNull()
    expect(parseJobType(null)).toBeNull()
  })
})

describe('matchesJobField', () => {
  it('matches loosely, so employers own wording still counts', () => {
    expect(matchesJobField('Technology', 'tech')).toBe(true)
    expect(matchesJobField('Customer Service', 'customer service')).toBe(true)
    expect(matchesJobField('IT & Technology', 'Technology')).toBe(true)
  })

  it('does not match unrelated fields or missing ones', () => {
    expect(matchesJobField('Agriculture', 'Finance')).toBe(false)
    expect(matchesJobField(null, 'Finance')).toBe(false)
  })

  it('matches everything when no field is chosen', () => {
    expect(matchesJobField('Anything', '')).toBe(true)
  })
})

describe('country slugs', () => {
  it('round-trips names', () => {
    expect(countrySlug('South Africa')).toBe('south-africa')
    expect(countryFromSlug('south-africa')).toBe('South Africa')
    expect(countryFromSlug(undefined)).toBe('')
  })
})
