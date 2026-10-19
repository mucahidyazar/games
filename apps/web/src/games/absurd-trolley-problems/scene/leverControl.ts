import type { TrolleyChoice } from '../content/types'

/**
 * Dragging the lever in the scene. The knob swings between its rest position
 * and the pulled one; the drag follows the pointer along that swing on screen.
 * Letting go decides: past halfway pulls the lever, short of it leaves it be.
 * A press that barely moves is a click, and a click pulls.
 */

export interface ScreenPoint {
  readonly x: number
  readonly y: number
}

export interface LeverDrag {
  readonly start: ScreenPoint
  /** Where the swing stood when the drag began: 0 at rest, 1 pulled. */
  readonly from: number
  /** The knob's travel on screen, from rest to pulled. */
  readonly travel: ScreenPoint
  /** How far along the swing the lever is now. */
  progress: number
  /** Whether the pointer has gone further than a click's wobble. */
  moved: boolean
}

/** CSS pixels a press may wander and still count as a click. */
export const CLICK_SLOP = 6

export function startDrag(pointer: ScreenPoint, rest: ScreenPoint, pulled: ScreenPoint, from = 0): LeverDrag {
  return { start: pointer, from, travel: { x: pulled.x - rest.x, y: pulled.y - rest.y }, progress: from, moved: false }
}

/** Follows the pointer; returns the new progress along the swing. */
export function moveDrag(drag: LeverDrag, pointer: ScreenPoint): number {
  const dx = pointer.x - drag.start.x
  const dy = pointer.y - drag.start.y
  if (Math.hypot(dx, dy) > CLICK_SLOP) drag.moved = true
  const lengthSq = drag.travel.x * drag.travel.x + drag.travel.y * drag.travel.y
  const along = lengthSq === 0 ? 0 : (dx * drag.travel.x + dy * drag.travel.y) / lengthSq
  drag.progress = Math.min(1, Math.max(0, drag.from + along))
  return drag.progress
}

/** What letting go means. */
export function releaseChoice(drag: LeverDrag): TrolleyChoice {
  if (!drag.moved) return 'pull'
  return drag.progress >= 0.5 ? 'pull' : 'stay'
}

/** The arm's angle for a point along the swing: `rest` at rest, `-rest` pulled. */
export function leverAngle(progress: number, rest: number): number {
  return rest - 2 * rest * Math.min(1, Math.max(0, progress))
}
