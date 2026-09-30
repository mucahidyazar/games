import { CELL_FREE, CELL_WALL, type CellState, type Grid } from './types'

/** Creates an empty field surrounded by a one-cell solid border ring. */
export function createGrid(cols: number, rows: number): Grid {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 3 || rows < 3) {
    throw new RangeError(`Grid must be at least 3x3 whole cells, got ${cols}x${rows}`)
  }

  const cells = new Uint8Array(cols * rows)
  for (let col = 0; col < cols; col++) {
    cells[col] = CELL_WALL
    cells[(rows - 1) * cols + col] = CELL_WALL
  }
  for (let row = 0; row < rows; row++) {
    cells[row * cols] = CELL_WALL
    cells[row * cols + cols - 1] = CELL_WALL
  }

  return {
    cols,
    rows,
    cells,
    interiorCount: (cols - 2) * (rows - 2),
    solidInteriorCount: 0,
    version: 0,
  }
}

/** Cell state at (col, row); everything outside the grid counts as wall. */
export function cellAt(grid: Grid, col: number, row: number): CellState {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return CELL_WALL
  return (grid.cells[row * grid.cols + col] ?? CELL_WALL) as CellState
}

export function isSolid(grid: Grid, col: number, row: number): boolean {
  return cellAt(grid, col, row) !== CELL_FREE
}

/**
 * Returns a new grid where the given free cells take `state`.
 * Cells that are already solid keep their state and are not re-counted.
 */
export function fillCells(grid: Grid, indices: Iterable<number>, state: CellState): Grid {
  let next: Uint8Array | null = null
  let added = 0

  for (const index of indices) {
    if (grid.cells[index] !== CELL_FREE) continue
    if (next === null) next = grid.cells.slice()
    if (next[index] !== CELL_FREE) continue
    next[index] = state
    added++
  }

  if (next === null) return grid
  return {
    ...grid,
    cells: next,
    solidInteriorCount: grid.solidInteriorCount + added,
    version: grid.version + 1,
  }
}

/** Share of the interior that is walls or captured territory, 0–100. */
export function capturedPercent(grid: Grid): number {
  return (grid.solidInteriorCount / grid.interiorCount) * 100
}
