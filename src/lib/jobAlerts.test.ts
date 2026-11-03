import { describe, expect, it } from 'vitest'
import { alertCriteriaFromFilters, describeAlert, hasAlertCriteria } from './jobAlerts'

const allTypes = ['Full-time', 'Part-time', 'Contract', 'Freelance']
const base = { search: '', selectedTypes: allTypes, allTypes, selectedLocation: 'All of Africa' }

describe('alertCriteriaFromFilters', () => {
  it('has no criteria when nothing is filtered, so the button stays disabled', () => {
    const criteria = alertCriteriaFromFilters(base)

    expect(criteria).toEqual({})
    expect(hasAlertCriteria(criteria)).toBe(false)
  })

  it('uses the trimmed search text', () => {
    expect(alertCriteriaFromFilters({ ...base, search: '  receptionist ' })).toEqual({ query: 'receptionist' })
  })

  it('uses a job type only when exactly one is selected', () => {
    expect(alertCriteriaFromFilters({ ...base, selectedTypes: ['Contract'] })).toEqual({ jobType: 'Contract' })
    expect(alertCriteriaFromFilters({ ...base, selectedTypes: ['Contract', 'Freelance'] })).toEqual({})
    expect(alertCriteriaFromFilters({ ...base, selectedTypes: [] })).toEqual({})
  })

  it('ignores country names, which never match town-level job locations', () => {
    expect(alertCriteriaFromFilters({ ...base, selectedLocation: 'Ghana' })).toEqual({})
    expect(alertCriteriaFromFilters({ ...base, selectedLocation: 'Remote Only' })).toEqual({ location: 'Remote' })
  })

  it('combines everything that applies', () => {
    const criteria = alertCriteriaFromFilters({
      search: 'excel',
      selectedTypes: ['Full-time'],
      allTypes,
      selectedLocation: 'Remote Only',
    })

    expect(criteria).toEqual({ query: 'excel', jobType: 'Full-time', location: 'Remote' })
    expect(describeAlert(criteria)).toBe('excel · Remote · Full-time')
  })
})
