import { CELL_CAPTURED, CELL_FREE, type Ball, type CellRun, type Grid } from './types'

export interface CaptureResult {
  readonly grid: Grid
  readonly captured: number
  readonly runs: readonly CellRun[]
  /** Separate regions captured (4-connected). */
  readonly capturedRegions: number
  /** Size in cells of each region still holding at least one ball. */
  readonly orbRegionSizes: readonly number[]
}

/**
 * Flood-fills free space from every ball (4-connected) and turns all free
 * cells that no ball can reach into captured territory.
 */
export function captureEnclosedAreas(grid: Grid, balls: readonly Ball[]): CaptureResult {
  const { cols, rows, cells } = grid
  const reachable = new Uint8Array(cells.length)
  const stack = new Int32Array(cells.length)
  const orbRegionSizes: number[] = []

  for (const ball of balls) {
    const start = Math.floor(ball.y) * cols + Math.floor(ball.x)
    if (cells[start] !== CELL_FREE || reachable[start] === 1) continue

    let size = 0
    let regionSize = 0
    const visit = (index: number): void => {
      if (cells[index] === CELL_FREE && reachable[index] === 0) {
        reachable[index] = 1
        stack[size++] = index
        regionSize++
      }
    }

    visit(start)
    while (size > 0) {
      const index = stack[--size] ?? 0
      // The border ring is always solid, so neighbours of free cells stay in bounds.
      visit(index - 1)
      visit(index + 1)
      visit(index - cols)
      visit(index + cols)
    }
    orbRegionSizes.push(regionSize)
  }

  let next: Uint8Array | null = null
  let captured = 0
  const runs: CellRun[] = []

  for (let row = 1; row < rows - 1; row++) {
    let runStart = -1
    for (let col = 1; col < cols; col++) {
      const index = row * cols + col
      const capture = col < cols - 1 && cells[index] === CELL_FREE && reachable[index] === 0

      if (capture) {
        next ??= cells.slice()
        next[index] = CELL_CAPTURED
        captured++
        if (runStart < 0) runStart = col
      } else if (runStart >= 0) {
        runs.push({ row, start: runStart, end: col })
        runStart = -1
      }
    }
  }

  if (next === null) return { grid, captured: 0, runs: [], capturedRegions: 0, orbRegionSizes }

  return {
    grid: {
      ...grid,
      cells: next,
      solidInteriorCount: grid.solidInteriorCount + captured,
      version: grid.version + 1,
    },
    captured,
    runs,
    capturedRegions: countNewRegions(cells, reachable, cols, stack),
    orbRegionSizes,
  }
}

/** Counts 4-connected regions among the cells that were free but unreachable (the ones just captured). */
function countNewRegions(cells: Uint8Array, reachable: Uint8Array, cols: number, stack: Int32Array): number {
  const seen = new Uint8Array(cells.length)
  const isNew = (index: number): boolean => cells[index] === CELL_FREE && reachable[index] === 0 && seen[index] === 0
  let regions = 0

  for (let start = 0; start < cells.length; start++) {
    if (!isNew(start)) continue
    regions++
    let size = 0
    seen[start] = 1
    stack[size++] = start
    while (size > 0) {
      const index = stack[--size] ?? 0
      for (const neighbour of [index - 1, index + 1, index - cols, index + cols]) {
        if (isNew(neighbour)) {
          seen[neighbour] = 1
          stack[size++] = neighbour
        }
      }
    }
  }
  return regions
}
