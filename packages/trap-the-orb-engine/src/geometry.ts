import { CELL_FREE, type Grid, type Rect } from './types'

/** True when the circle and the rectangle share any area (touching is not overlapping). */
export function circleIntersectsRect(cx: number, cy: number, radius: number, rect: Rect): boolean {
  const nearestX = Math.max(rect.left, Math.min(cx, rect.right))
  const nearestY = Math.max(rect.top, Math.min(cy, rect.bottom))
  const dx = cx - nearestX
  const dy = cy - nearestY
  return dx * dx + dy * dy < radius * radius
}

/** True when a circle overlaps any solid cell (or leaves the grid). */
export function circleOverlapsSolid(grid: Grid, cx: number, cy: number, radius: number): boolean {
  const minCol = Math.floor(cx - radius)
  const maxCol = Math.floor(cx + radius)
  const minRow = Math.floor(cy - radius)
  const maxRow = Math.floor(cy + radius)
  const radiusSq = radius * radius

  for (let row = minRow; row <= maxRow; row++) {
    const dy = cy < row ? row - cy : cy > row + 1 ? cy - row - 1 : 0
    if (dy * dy >= radiusSq) continue

    for (let col = minCol; col <= maxCol; col++) {
      const outside = col < 0 || row < 0 || col >= grid.cols || row >= grid.rows
      if (!outside && grid.cells[row * grid.cols + col] === CELL_FREE) continue

      const dx = cx < col ? col - cx : cx > col + 1 ? cx - col - 1 : 0
      if (dx * dx + dy * dy < radiusSq) return true
    }
  }

  return false
}
