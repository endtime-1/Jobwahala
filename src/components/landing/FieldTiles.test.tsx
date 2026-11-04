import { describe, expect, it } from 'vitest'
import { buildFieldTiles } from '../../lib/jobSearch'

describe('buildFieldTiles', () => {
  it('uses real fields with live counts, biggest first', () => {
    const tiles = buildFieldTiles([
      { category: 'Sales' },
      { category: 'Finance' },
      { category: 'finance' },
      { category: 'Technology' },
      { category: null },
    ])

    expect(tiles).toEqual([
      { name: 'Finance', count: 2 },
      { name: 'Sales', count: 1 },
      { name: 'Technology', count: 1 },
    ])
  })

  it('falls back to the common fields, without counts, when there are too few jobs', () => {
    const tiles = buildFieldTiles([{ category: 'Sales' }])

    expect(tiles).toHaveLength(8)
    expect(tiles.every((tile) => tile.count === null)).toBe(true)
    expect(tiles[0].name).toBe('Technology')
  })
})
