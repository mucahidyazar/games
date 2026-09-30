import { isSolid } from './grid'
import type { Grid, Orientation, Rect, WallHalf } from './types'

/**
 * Two halves that grow apart from the far edge of the clicked cell: the
 * backward half claims the clicked cell itself, the forward half starts at
 * the next cell. Every cell therefore belongs to exactly one half, which keeps
 * the solid cells of a finished half identical to its collision area.
 */
export function createWallPair(
  orientation: Orientation,
  col: number,
  row: number,
  firstId: number,
): readonly [WallHalf, WallHalf] {
  const line = orientation === 'vertical' ? col : row
  const origin = (orientation === 'vertical' ? row : col) + 1
  const base = { orientation, line, origin, length: 0 }

  return [
    { ...base, id: firstId, direction: -1 },
    { ...base, id: firstId + 1, direction: 1 },
  ]
}

/** Position of the growing end along the wall's axis. */
export function wallTip(wall: WallHalf): number {
  return wall.origin + wall.direction * wall.length
}

const solidAlong = (grid: Grid, wall: WallHalf, index: number): boolean =>
  wall.orientation === 'vertical' ? isSolid(grid, wall.line, index) : isSolid(grid, index, wall.line)

export interface AdvanceResult {
  readonly wall: WallHalf
  readonly completed: boolean
}

/**
 * Grows a wall half by `distance` cells. When the tip would enter a solid
 * cell it stops flush against it and the half is reported as completed.
 */
export function advanceWall(wall: WallHalf, grid: Grid, distance: number): AdvanceResult {
  const tip = wallTip(wall)
  const target = tip + wall.direction * distance

  if (wall.direction === 1) {
    for (let index = Math.floor(tip); index <= Math.ceil(target) - 1; index++) {
      if (solidAlong(grid, wall, index)) {
        return { wall: { ...wall, length: index - wall.origin }, completed: true }
      }
    }
  } else {
    for (let index = Math.ceil(tip) - 1; index >= Math.floor(target); index--) {
      if (solidAlong(grid, wall, index)) {
        return { wall: { ...wall, length: wall.origin - (index + 1) }, completed: true }
      }
    }
  }

  return { wall: { ...wall, length: wall.length + distance }, completed: false }
}

/** Area currently covered by a wall half, in cell units. */
export function wallRect(wall: WallHalf): Rect {
  const tip = wallTip(wall)
  const start = Math.min(wall.origin, tip)
  const end = Math.max(wall.origin, tip)

  return wall.orientation === 'vertical'
    ? { left: wall.line, right: wall.line + 1, top: start, bottom: end }
    : { left: start, right: end, top: wall.line, bottom: wall.line + 1 }
}

/** Row-major indices of every cell the wall half touches. */
export function wallCells(wall: WallHalf, cols: number): number[] {
  const tip = wallTip(wall)
  const first = Math.floor(Math.min(wall.origin, tip))
  const last = Math.ceil(Math.max(wall.origin, tip)) - 1
  const indices: number[] = []

  for (let index = first; index <= last; index++) {
    indices.push(wall.orientation === 'vertical' ? index * cols + wall.line : wall.line * cols + index)
  }
  return indices
}

export interface Extent {
  /** First covered cell along the growth axis. */
  readonly start: number
  /** One past the last covered cell. */
  readonly end: number
}

/**
 * The cells a wall through (col, row) would cover once both halves finish,
 * ignoring balls — used to preview a wall before it is placed.
 */
export function previewExtent(grid: Grid, col: number, row: number, orientation: Orientation): Extent | null {
  if (isSolid(grid, col, row)) return null

  const vertical = orientation === 'vertical'
  const line = vertical ? col : row
  const at = vertical ? row : col
  const solid = (index: number): boolean => (vertical ? isSolid(grid, line, index) : isSolid(grid, index, line))

  let start = at
  while (!solid(start - 1)) start--
  let end = at + 1
  while (!solid(end)) end++

  return { start, end }
}
