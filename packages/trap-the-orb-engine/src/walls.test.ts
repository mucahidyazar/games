import { describe, expect, it } from 'vitest'
import { createGrid, fillCells } from './grid'
import { CELL_WALL } from './types'
import { advanceWall, createWallPair, previewExtent, wallCells, wallRect, wallTip } from './walls'

describe('createWallPair', () => {
  it('creates two zero-length halves growing apart from the clicked cell', () => {
    const [first, second] = createWallPair('vertical', 5, 8, 10)

    expect(first).toMatchObject({ id: 10, orientation: 'vertical', line: 5, origin: 9, direction: -1, length: 0 })
    expect(second).toMatchObject({ id: 11, orientation: 'vertical', line: 5, origin: 9, direction: 1, length: 0 })
  })

  it('uses the column as the growth axis for horizontal walls', () => {
    const [first, second] = createWallPair('horizontal', 5, 8, 1)

    expect(first).toMatchObject({ line: 8, origin: 6, direction: -1 })
    expect(second).toMatchObject({ line: 8, origin: 6, direction: 1 })
  })
})

describe('advanceWall', () => {
  const grid = createGrid(20, 12) // interior rows 1..10

  it('grows freely while the path is clear', () => {
    const [up] = createWallPair('vertical', 5, 6, 1)

    const { wall, completed } = advanceWall(up, grid, 2)

    expect(completed).toBe(false)
    expect(wall.length).toBe(2)
    expect(wallTip(wall)).toBe(5)
  })

  it('stops exactly at the border and reports completion', () => {
    const [up, down] = createWallPair('vertical', 5, 6, 1)

    const upResult = advanceWall(up, grid, 50)
    const downResult = advanceWall(down, grid, 50)

    expect(upResult.completed).toBe(true)
    expect(wallTip(upResult.wall)).toBe(1) // bottom edge of the border row 0
    expect(downResult.completed).toBe(true)
    expect(wallTip(downResult.wall)).toBe(11) // top edge of the border row 11
  })

  it('stops at walls that already exist inside the field', () => {
    const blocked = fillCells(grid, [3 * 20 + 12], CELL_WALL) // cell (12, 3)
    const [left, right] = createWallPair('horizontal', 4, 3, 1)

    const rightResult = advanceWall(right, blocked, 50)
    const leftResult = advanceWall(left, blocked, 50)

    expect(rightResult.completed).toBe(true)
    expect(wallTip(rightResult.wall)).toBe(12)
    expect(leftResult.completed).toBe(true)
    expect(wallTip(leftResult.wall)).toBe(1)
  })

  it('claims only the clicked cell when the cell beyond it is already solid', () => {
    const blocked = fillCells(grid, [5 * 20 + 5], CELL_WALL) // cell (5, 5)
    const [up] = createWallPair('vertical', 5, 6, 1)

    const { wall, completed } = advanceWall(up, blocked, 1.5)

    expect(completed).toBe(true)
    expect(wall.length).toBe(1)
    expect(wallCells(wall, 20)).toEqual([6 * 20 + 5])
  })

  it('completes at zero length when the forward neighbour is already solid', () => {
    const blocked = fillCells(grid, [7 * 20 + 5], CELL_WALL) // cell (5, 7)
    const [, down] = createWallPair('vertical', 5, 6, 1)

    const { wall, completed } = advanceWall(down, blocked, 0.5)

    expect(completed).toBe(true)
    expect(wall.length).toBe(0)
    expect(wallCells(wall, 20)).toEqual([])
  })

  it('stops flush against its obstacle across several advances', () => {
    const [up] = createWallPair('vertical', 5, 2, 1)

    const first = advanceWall(up, grid, 1.5)
    const second = advanceWall(first.wall, grid, 1.5)

    expect(first.completed).toBe(false)
    expect(second.completed).toBe(true)
    expect(wallTip(second.wall)).toBe(1)
  })
})

describe('wallRect and wallCells', () => {
  it('covers the column of a vertical wall between origin and tip', () => {
    const [, down] = createWallPair('vertical', 7, 3, 1)
    const grown = { ...down, length: 2 }

    expect(wallRect(grown)).toEqual({ left: 7, right: 8, top: 4, bottom: 6 })
    expect(wallCells(grown, 20)).toEqual([4 * 20 + 7, 5 * 20 + 7])
  })

  it('covers the row of a horizontal wall between tip and origin', () => {
    const [left] = createWallPair('horizontal', 6, 2, 1)
    const grown = { ...left, length: 1.5 }

    expect(wallRect(grown)).toEqual({ left: 5.5, right: 7, top: 2, bottom: 3 })
    expect(wallCells(grown, 20)).toEqual([2 * 20 + 5, 2 * 20 + 6])
  })

  it('covers no cells before it starts growing', () => {
    const [up] = createWallPair('vertical', 4, 4, 1)

    expect(wallCells(up, 20)).toEqual([])
  })
})

describe('previewExtent', () => {
  const grid = createGrid(20, 12)

  it('spans from border to border across an empty field', () => {
    expect(previewExtent(grid, 5, 6, 'vertical')).toEqual({ start: 1, end: 11 })
    expect(previewExtent(grid, 5, 6, 'horizontal')).toEqual({ start: 1, end: 19 })
  })

  it('stops at walls that are already built', () => {
    const blocked = fillCells(grid, [3 * 20 + 5, 3 * 20 + 12], CELL_WALL) // cells (5, 3) and (12, 3)

    expect(previewExtent(blocked, 5, 6, 'vertical')).toEqual({ start: 4, end: 11 })
    expect(previewExtent(blocked, 8, 3, 'horizontal')).toEqual({ start: 6, end: 12 })
  })

  it('returns null for cells that cannot hold a wall', () => {
    expect(previewExtent(grid, 0, 6, 'vertical')).toBeNull()
  })
})
