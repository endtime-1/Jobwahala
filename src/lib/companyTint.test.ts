import { describe, expect, it } from 'vitest'
import { tintFor } from './companyTint'

describe('tintFor', () => {
  it('gives the same company the same colour every time', () => {
    expect(tintFor('Achiba Star Hotel')).toBe(tintFor('Achiba Star Hotel'))
  })

  it('spreads different companies across several colours', () => {
    const names = ['Achiba Star Hotel', 'Jobwahala Official', 'Kumasi Foods', 'Lagos Logistics', 'Nairobi Tech', 'Accra Bakes', 'Dakar Design']
    expect(new Set(names.map(tintFor)).size).toBeGreaterThan(2)
  })

  it('never fails on odd names', () => {
    expect(tintFor('')).toEqual(expect.any(String))
    expect(tintFor('Ẹ̀ṣọ̀ Ltd ɛɔ')).toEqual(expect.any(String))
  })
})
