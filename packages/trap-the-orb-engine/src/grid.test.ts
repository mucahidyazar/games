import { describe, expect, it } from 'vitest'
import {
  capturedPercent,
  cellAt,
  createGrid,
  fillCells,
  isSolid,
} from './grid'
import { CELL_CAPTURED, CELL_FREE, CELL_WALL } from './types'

describe('createGrid', () => {
  it('surrounds a free interior with a solid border ring', () => {
    const grid = createGrid(10, 6)

    expect(grid.cols).toBe(10)
    expect(grid.rows).toBe(6)
    expect(cellAt(grid, 0, 0)).toBe(CELL_WALL)
    expect(cellAt(grid, 9, 5)).toBe(CELL_WALL)
    expect(cellAt(grid, 0, 3)).toBe(CELL_WALL)
    expect(cellAt(grid, 4, 0)).toBe(CELL_WALL)
    expect(cellAt(grid, 1, 1)).toBe(CELL_FREE)
    expect(cellAt(grid, 8, 4)).toBe(CELL_FREE)
  })

  it('counts only interior cells towards the capturable area', () => {
    const grid = createGrid(10, 6)

    expect(grid.interiorCount).toBe(8 * 4)
    expect(grid.solidInteriorCount).toBe(0)
    expect(capturedPercent(grid)).toBe(0)
  })

  it('rejects grids that are too small to have an interior', () => {
    expect(() => createGrid(2, 10)).toThrow(RangeError)
    expect(() => createGrid(10, 2.5)).toThrow(RangeError)
  })
})

describe('isSolid', () => {
  it('treats everything outside the grid as solid', () => {
    const grid = createGrid(10, 6)

    expect(isSolid(grid, -1, 2)).toBe(true)
    expect(isSolid(grid, 10, 2)).toBe(true)
    expect(isSolid(grid, 3, 6)).toBe(true)
    expect(isSolid(grid, 3, 3)).toBe(false)
  })
})

describe('fillCells', () => {
  it('returns a new grid and leaves the original untouched', () => {
    const grid = createGrid(10, 6)
    const index = 2 * 10 + 3

    const next = fillCells(grid, [index], CELL_WALL)

    expect(next).not.toBe(grid)
    expect(cellAt(grid, 3, 2)).toBe(CELL_FREE)
    expect(cellAt(next, 3, 2)).toBe(CELL_WALL)
    expect(next.solidInteriorCount).toBe(1)
    expect(next.version).toBe(grid.version + 1)
  })

  it('does not double count cells that are already solid', () => {
    const grid = fillCells(createGrid(10, 6), [23, 24], CELL_WALL)

    const next = fillCells(grid, [23, 24, 25, 0], CELL_CAPTURED)

    expect(next.solidInteriorCount).toBe(3)
    expect(cellAt(next, 3, 2)).toBe(CELL_WALL)
    expect(cellAt(next, 5, 2)).toBe(CELL_CAPTURED)
  })

  it('returns the same grid when nothing changes', () => {
    const grid = createGrid(10, 6)

    expect(fillCells(grid, [0, 1, 2], CELL_WALL)).toBe(grid)
  })
})

describe('capturedPercent', () => {
  it('reports the solid share of the interior', () => {
    const grid = createGrid(12, 7) // 10 x 5 interior = 50 cells
    const next = fillCells(grid, [13, 14, 15, 16, 17], CELL_CAPTURED)

    expect(capturedPercent(next)).toBeCloseTo(10)
  })
})
