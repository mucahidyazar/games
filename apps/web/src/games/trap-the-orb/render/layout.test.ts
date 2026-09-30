import { describe, expect, it } from 'vitest'
import { cellFromPoint, computeLayout, runsCentroid } from './layout'

describe('computeLayout', () => {
  it('scales the grid uniformly and centres it inside the canvas', () => {
    const layout = computeLayout({ cssWidth: 1000, cssHeight: 600, dpr: 2 }, { cols: 200, rows: 100 })

    expect(layout.scale).toBe(5)
    expect(layout.offsetX).toBe(0)
    expect(layout.offsetY).toBe(50)
    expect(layout.dpr).toBe(2)
  })
})

describe('cellFromPoint', () => {
  const layout = computeLayout({ cssWidth: 1000, cssHeight: 600, dpr: 1 }, { cols: 200, rows: 100 })

  it('maps canvas coordinates to grid cells', () => {
    expect(cellFromPoint(layout, { cols: 200, rows: 100 }, 12, 62)).toEqual({ col: 2, row: 2 })
    expect(cellFromPoint(layout, { cols: 200, rows: 100 }, 999, 549)).toEqual({ col: 199, row: 99 })
  })

  it('returns null outside the field', () => {
    expect(cellFromPoint(layout, { cols: 200, rows: 100 }, 500, 20)).toBeNull()
    expect(cellFromPoint(layout, { cols: 200, rows: 100 }, -1, 100)).toBeNull()
  })
})

describe('runsCentroid', () => {
  it('weights each run by its length', () => {
    expect(runsCentroid([{ row: 0, start: 0, end: 4 }])).toEqual({ x: 2, y: 0.5 })
    expect(
      runsCentroid([
        { row: 0, start: 0, end: 2 },
        { row: 3, start: 0, end: 2 },
      ]),
    ).toEqual({ x: 1, y: 2 })
  })

  it('returns null when there is nothing to average', () => {
    expect(runsCentroid([])).toBeNull()
  })
})
