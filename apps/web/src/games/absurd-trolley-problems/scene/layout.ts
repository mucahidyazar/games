import { Vector3 } from 'three'
import layoutJson from './layout.json'
import rigJson from './rig.json'

/**
 * The set's measurements, written by the Blender scripts
 * (apps/web/blender/absurd-trolley-problems/atp_layout.py) in three.js axes.
 */
type Tuple3 = readonly [number, number, number]

export interface LayoutData {
  readonly gauge: number
  /** How far past the junction the switch's movable rails reach. */
  readonly switchRails: number
  readonly incoming: readonly Tuple3[]
  readonly main: readonly Tuple3[]
  readonly branch: readonly Tuple3[]
  readonly victimsA: { readonly start: number; readonly spacing: number }
  readonly victimsB: { readonly center: number; readonly spacing: number; readonly min: number }
  readonly lever: Tuple3
  readonly lamp: Tuple3
  readonly footbridgeAt: number
  readonly tramStart: number
  readonly tramScale: number
  readonly leverScale: number
  readonly actorScale: Readonly<Record<'person' | 'cat' | 'dog' | 'duck' | 'horse' | 'prop', number>>
}

export interface RigData {
  readonly shoulder: Readonly<Record<'R' | 'L', Tuple3>>
  /** Blender XYZ Euler angles in degrees, per pose and arm. */
  readonly poses: Readonly<Record<string, Readonly<Record<'R' | 'L', Tuple3>>>>
}

export const LAYOUT = layoutJson as unknown as LayoutData
export const RIG = rigJson as unknown as RigData

/** Rail top: where wheels roll and feet stand (sleepers are a little lower). */
export const RAIL_TOP = 0.23
export const STAND_HEIGHT = 0.13

/** A polyline walked by distance. */
export class Path {
  readonly points: readonly Vector3[]
  private readonly cumulative: readonly number[]
  readonly length: number

  constructor(points: readonly Vector3[]) {
    if (points.length < 2) throw new Error('A path needs at least two points')
    this.points = points
    const cumulative = [0]
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1] as Vector3
      const b = points[i] as Vector3
      cumulative.push((cumulative[i - 1] as number) + a.distanceTo(b))
    }
    this.cumulative = cumulative
    this.length = cumulative[cumulative.length - 1] as number
  }

  static from(tuples: readonly Tuple3[]): Path {
    return new Path(tuples.map(([x, y, z]) => new Vector3(x, y, z)))
  }

  /** Joins two paths that share an end point. */
  static join(first: Path, second: Path): Path {
    return new Path([...first.points, ...second.points.slice(1)])
  }

  private segment(distance: number): { readonly index: number; readonly t: number } {
    if (distance <= 0) return { index: 0, t: distance / Math.max(1e-6, this.segmentLength(0)) }
    if (distance >= this.length) {
      const last = this.points.length - 2
      return { index: last, t: 1 + (distance - this.length) / Math.max(1e-6, this.segmentLength(last)) }
    }
    let lo = 0
    let hi = this.cumulative.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if ((this.cumulative[mid] as number) <= distance) lo = mid
      else hi = mid
    }
    return { index: lo, t: (distance - (this.cumulative[lo] as number)) / Math.max(1e-6, this.segmentLength(lo)) }
  }

  private segmentLength(index: number): number {
    return (this.cumulative[index + 1] as number) - (this.cumulative[index] as number)
  }

  /** The point `distance` along the path; beyond either end it carries straight on. */
  pointAt(distance: number, target = new Vector3()): Vector3 {
    const { index, t } = this.segment(distance)
    return target.lerpVectors(this.points[index] as Vector3, this.points[index + 1] as Vector3, t)
  }

  /** Unit direction of travel at `distance`. */
  tangentAt(distance: number, target = new Vector3()): Vector3 {
    const { index } = this.segment(distance)
    return target.subVectors(this.points[index + 1] as Vector3, this.points[index] as Vector3).normalize()
  }
}

export const INCOMING = Path.from(LAYOUT.incoming)
export const MAIN = Path.from(LAYOUT.main)
export const BRANCH = Path.from(LAYOUT.branch)
/** The tram's whole journey for each route; the switch sits at INCOMING.length. */
export const ROUTES = { A: Path.join(INCOMING, MAIN), B: Path.join(INCOMING, BRANCH) } as const
export const SWITCH_AT = INCOMING.length

/** Where `count` actors stand on track A, as distances from the switch. */
export function slotsA(count: number): number[] {
  const { start, spacing } = LAYOUT.victimsA
  // A lone actor stands right of centre, clear of whoever waits on track B.
  if (count === 1) return [start + 3 * spacing]
  const middle = start + 2 * spacing
  if (count <= 5) return Array.from({ length: count }, (_, i) => middle + (i - (count - 1) / 2) * spacing)
  // A crowd (the finale) squeezes into the same stretch of track.
  const span = 4 * spacing + 0.6
  const step = span / (count - 1)
  return Array.from({ length: count }, (_, i) => start - 0.6 + i * step)
}

/** Where `count` actors stand on track B: centred, but clear of the switch. */
export function slotsB(count: number): number[] {
  const { center, spacing, min } = LAYOUT.victimsB
  const first = Math.max(min, center - ((count - 1) / 2) * spacing)
  return Array.from({ length: count }, (_, i) => first + i * spacing)
}
