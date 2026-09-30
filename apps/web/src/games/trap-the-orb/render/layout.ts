import type { CellRun, GridDims } from '@games/trap-the-orb-engine'

export interface CanvasSize {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly dpr: number
}

export interface FieldLayout extends CanvasSize {
  /** CSS pixels per grid cell. */
  readonly scale: number
  /** Letterbox offsets of the field inside the canvas, in CSS pixels. */
  readonly offsetX: number
  readonly offsetY: number
}

export interface CellPoint {
  readonly col: number
  readonly row: number
}

/** Fits the grid into the canvas with a uniform scale, centred. */
export function computeLayout(size: CanvasSize, dims: GridDims): FieldLayout {
  const scale = Math.min(size.cssWidth / dims.cols, size.cssHeight / dims.rows)
  return {
    ...size,
    scale,
    offsetX: (size.cssWidth - dims.cols * scale) / 2,
    offsetY: (size.cssHeight - dims.rows * scale) / 2,
  }
}

/** Grid cell under a point given in canvas CSS pixels, or null outside the field. */
export function cellFromPoint(layout: FieldLayout, dims: GridDims, x: number, y: number): CellPoint | null {
  const col = Math.floor((x - layout.offsetX) / layout.scale)
  const row = Math.floor((y - layout.offsetY) / layout.scale)
  if (col < 0 || row < 0 || col >= dims.cols || row >= dims.rows) return null
  return { col, row }
}

/** Centre of mass of a set of cell runs, in cell coordinates. */
export function runsCentroid(runs: readonly CellRun[]): { x: number; y: number } | null {
  let total = 0
  let sumX = 0
  let sumY = 0

  for (const run of runs) {
    const length = run.end - run.start
    total += length
    sumX += ((run.start + run.end) / 2) * length
    sumY += (run.row + 0.5) * length
  }

  return total === 0 ? null : { x: sumX / total, y: sumY / total }
}
