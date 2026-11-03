import { describe, expect, it } from 'vitest'
import { buildJobSearchPath } from './jobSearch'

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
})
