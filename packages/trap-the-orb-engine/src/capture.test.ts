import { describe, expect, it } from 'vitest'
import { captureEnclosedAreas } from './capture'
import { capturedPercent, cellAt, createGrid, fillCells } from './grid'
import { CELL_CAPTURED, CELL_FREE, CELL_WALL, type Ball } from './types'

const ballAt = (x: number, y: number): Ball => ({ id: 1, x, y, vx: 0, vy: 0, radius: 2, tier: 0 })

/** 22 x 12 grid (20 x 10 interior) split by a vertical wall on column 10. */
const splitGrid = () => {
  const grid = createGrid(22, 12)
  const wall = Array.from({ length: 10 }, (_, i) => (i + 1) * 22 + 10)
  return fillCells(grid, wall, CELL_WALL)
}

describe('captureEnclosedAreas', () => {
  it('captures nothing while every region still holds a ball', () => {
    const grid = splitGrid()

    const result = captureEnclosedAreas(grid, [ballAt(4, 5), ballAt(15, 5)])

    expect(result.captured).toBe(0)
    expect(result.grid).toBe(grid)
    expect(result.runs).toEqual([])
    expect(result.capturedRegions).toBe(0)
    expect(result.orbRegionSizes).toEqual([90, 100])
  })

  it('fills every free cell that no ball can reach', () => {
    const grid = splitGrid()

    const result = captureEnclosedAreas(grid, [ballAt(4, 5)])

    expect(result.captured).toBe(10 * 10)
    expect(result.capturedRegions).toBe(1)
    expect(result.orbRegionSizes).toEqual([90])
    expect(cellAt(result.grid, 15, 5)).toBe(CELL_CAPTURED)
    expect(cellAt(result.grid, 4, 5)).toBe(CELL_FREE)
    expect(cellAt(result.grid, 10, 5)).toBe(CELL_WALL)
    expect(capturedPercent(result.grid)).toBeCloseTo(((10 + 100) / 200) * 100)
  })

  it('describes the captured cells as horizontal runs for effects', () => {
    const grid = splitGrid()

    const { runs } = captureEnclosedAreas(grid, [ballAt(4, 5)])

    expect(runs).toHaveLength(10)
    expect(runs[0]).toEqual({ row: 1, start: 11, end: 21 })
    expect(runs.every((run) => run.start === 11 && run.end === 21)).toBe(true)
  })

  it('does not leak through a wall that only touches diagonally', () => {
    // A closed pocket in the top-left corner: cells (1..3, 1..3) enclosed by walls.
    const grid = fillCells(
      createGrid(22, 12),
      [4 * 22 + 1, 4 * 22 + 2, 4 * 22 + 3, 1 * 22 + 4, 2 * 22 + 4, 3 * 22 + 4],
      CELL_WALL,
    )

    const result = captureEnclosedAreas(grid, [ballAt(15, 8)])

    expect(result.captured).toBe(9)
    expect(cellAt(result.grid, 2, 2)).toBe(CELL_CAPTURED)
  })

  it('counts separate captured regions and measures the regions left to each orb', () => {
    // Walls on columns 5 and 15 split the field in three; only the middle keeps an orb.
    const walls = [...Array.from({ length: 10 }, (_, i) => (i + 1) * 22 + 5), ...Array.from({ length: 10 }, (_, i) => (i + 1) * 22 + 15)]
    const grid = fillCells(createGrid(22, 12), walls, CELL_WALL)

    const result = captureEnclosedAreas(grid, [ballAt(10, 5), ballAt(12, 6)])

    expect(result.capturedRegions).toBe(2)
    expect(result.captured).toBe(4 * 10 + 5 * 10)
    expect(result.orbRegionSizes).toEqual([9 * 10])
  })
})
