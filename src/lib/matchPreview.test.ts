import { describe, expect, it } from 'vitest'
import { parseSkills, rankJobsForSkills, scoreJobPreview, type PreviewJob } from './matchPreview'

const jobs: PreviewJob[] = [
  { id: 'a', title: 'Hotel Receptionist', description: 'Front desk, guest relations and customer service', category: 'Hospitality', createdAt: '2026-04-09T00:00:00Z' },
  { id: 'b', title: 'Financial Consultant', description: 'Accounting, Excel reporting and client advice', category: 'Finance', createdAt: '2026-03-31T00:00:00Z' },
  { id: 'c', title: 'Housekeeping Attendant', description: 'Cleaning rooms and customer care', category: 'Hospitality', createdAt: '2026-04-08T00:00:00Z' },
]

describe('parseSkills', () => {
  it('splits on commas, newlines and semicolons and drops blanks and duplicates', () => {
    expect(parseSkills('Excel, accounting;\n excel ,, Customer service')).toEqual(['Excel', 'accounting', 'Customer service'])
  })

  it('caps the list so the demo stays fast and focused', () => {
    expect(parseSkills('a1,b1,c1,d1,e1,f1,g1,h1,i1,j1')).toHaveLength(8)
  })
})

describe('scoreJobPreview', () => {
  it('scores zero when nothing matches', () => {
    expect(scoreJobPreview(['welding'], jobs[0]).score).toBe(0)
  })

  it('matches whole words only', () => {
    expect(scoreJobPreview(['art'], { id: 'x', title: 'Smart Analyst' }).score).toBe(0)
    expect(scoreJobPreview(['java'], { id: 'x', title: 'JavaScript Developer' }).score).toBe(0)
  })

  it('handles skills with regex characters safely', () => {
    expect(scoreJobPreview(['c++'], { id: 'x', title: 'C++ Engineer' }).score).toBeGreaterThan(0)
    expect(scoreJobPreview(['node.js'], { id: 'x', title: 'Node.js Developer' }).matched).toEqual(['node.js'])
  })

  it('rewards a title hit and stays within 35-98', () => {
    const inTitle = scoreJobPreview(['receptionist'], jobs[0]).score
    const inBody = scoreJobPreview(['guest relations'], jobs[0]).score

    expect(inTitle).toBeGreaterThan(inBody)
    expect(inBody).toBeGreaterThanOrEqual(35)
    expect(scoreJobPreview(['receptionist', 'front desk', 'customer service', 'hospitality'], jobs[0]).score).toBeLessThanOrEqual(98)
  })
})

describe('rankJobsForSkills', () => {
  it('returns nothing before the visitor adds a skill', () => {
    expect(rankJobsForSkills([], jobs)).toEqual([])
  })

  it('ranks the best match first and omits non-matches', () => {
    const ranked = rankJobsForSkills(['excel', 'accounting'], jobs)

    expect(ranked.map((match) => match.job.id)).toEqual(['b'])
    expect(ranked[0].matched).toEqual(['excel', 'accounting'])
  })

  it('breaks score ties by newest job', () => {
    const ranked = rankJobsForSkills(['customer service', 'customer care'], jobs)

    expect(ranked.map((match) => match.job.id)).toEqual(['a', 'c'])
  })
})
