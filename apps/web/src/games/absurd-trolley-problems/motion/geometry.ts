/**
 * Plane geometry for the motion scenes: tracks as routes the tram can be
 * placed along by distance, the rails and sleepers drawn beside them, and
 * where everyone stands. Pure maths, so it works (and is tested) without SVG
 * layout, which jsdom does not have.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

export type Segment =
  | { readonly kind: 'line'; readonly from: Point; readonly to: Point }
  | { readonly kind: 'cubic'; readonly from: Point; readonly c1: Point; readonly c2: Point; readonly to: Point }

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
}

const CUBIC_STEPS = 48

/** A path of lines and curves that can be walked by distance. */
export class Route {
  readonly segments: readonly Segment[]
  readonly length: number
  private readonly points: readonly Point[]
  private readonly distances: readonly number[]

  constructor(segments: readonly Segment[]) {
    this.segments = segments
    const points: Point[] = []
    for (const segment of segments) {
      if (points.length === 0) points.push(segment.from)
      if (segment.kind === 'line') points.push(segment.to)
      else for (let i = 1; i <= CUBIC_STEPS; i++) points.push(cubicPoint(segment.from, segment.c1, segment.c2, segment.to, i / CUBIC_STEPS))
    }
    const distances = [0]
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1] as Point
      const b = points[i] as Point
      distances.push((distances[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y))
    }
    this.points = points
    this.distances = distances
    this.length = distances[distances.length - 1] as number
  }

  /** Index of the sample segment that holds `distance`, and how far along it. */
  private locate(distance: number): { readonly index: number; readonly t: number } {
    const d = Math.min(Math.max(distance, 0), this.length)
    let low = 0
    let high = this.distances.length - 1
    while (high - low > 1) {
      const mid = (low + high) >> 1
      if ((this.distances[mid] as number) <= d) low = mid
      else high = mid
    }
    const start = this.distances[low] as number
    const span = (this.distances[high] as number) - start
    return { index: low, t: span > 0 ? (d - start) / span : 0 }
  }

  /** The point `distance` along the route, clamped to its ends. */
  at(distance: number): Point {
    const { index, t } = this.locate(distance)
    const a = this.points[index] as Point
    const b = (this.points[index + 1] ?? a) as Point
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
  }

  /** The direction of travel at `distance`, in radians (0 is to the right, positive is down the screen). */
  angleAt(distance: number): number {
    const { index } = this.locate(distance)
    const a = this.points[index] as Point
    const b = (this.points[index + 1] ?? a) as Point
    return Math.atan2(b.y - a.y, b.x - a.x)
  }

  /** The distance along the route where it first reaches `x` (routes here only ever head right). */
  distanceAtX(x: number): number {
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1] as Point
      const b = this.points[i] as Point
      if (b.x >= x) {
        const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x)
        return lerp(this.distances[i - 1] as number, this.distances[i] as number, Math.min(Math.max(t, 0), 1))
      }
    }
    return this.length
  }

  /** SVG path data for the whole route. */
  pathData(): string {
    return this.segments
      .map((segment, index) => {
        const move = index === 0 ? `M${segment.from.x} ${segment.from.y}` : ''
        if (segment.kind === 'line') return `${move}L${segment.to.x} ${segment.to.y}`
        return `${move}C${segment.c1.x} ${segment.c1.y} ${segment.c2.x} ${segment.c2.y} ${segment.to.x} ${segment.to.y}`
      })
      .join('')
  }
}

const round = (value: number): number => Math.round(value * 10) / 10

/** The two rails either side of a route, as SVG path data. */
export function railPaths(route: Route, gauge: number, step = 8): readonly [string, string] {
  const sides: [string[], string[]] = [[], []]
  for (let d = 0; d <= route.length + step; d += step) {
    const at = Math.min(d, route.length)
    const point = route.at(at)
    const angle = route.angleAt(at)
    const nx = -Math.sin(angle) * (gauge / 2)
    const ny = Math.cos(angle) * (gauge / 2)
    const command = d === 0 ? 'M' : 'L'
    sides[0].push(`${command}${round(point.x + nx)} ${round(point.y + ny)}`)
    sides[1].push(`${command}${round(point.x - nx)} ${round(point.y - ny)}`)
    if (at === route.length) break
  }
  return [sides[0].join(''), sides[1].join('')]
}

export interface Sleeper {
  readonly x: number
  readonly y: number
  /** Degrees, for an SVG rotate(). */
  readonly angle: number
}

/** Sleepers every `spacing` along a route, square to it. */
export function sleepers(route: Route, spacing: number, from = spacing / 2): readonly Sleeper[] {
  const out: Sleeper[] = []
  for (let d = from; d < route.length; d += spacing) {
    const point = route.at(d)
    out.push({ x: round(point.x), y: round(point.y), angle: round((route.angleAt(d) * 180) / Math.PI) })
  }
  return out
}

// ------------------------------------------------------------- the driver

/** How the driver's tracks are laid out: where they fork, where the branch levels out, where the tram waits. */
interface DriverPlan {
  readonly fork: Point
  readonly sideStraight: Point
  /** The branch curve's two control points' x (their y follow the main line, then the branch). */
  readonly bend: readonly [number, number]
  /** Where the tram's front is when it comes in, and where it waits short of the fork. */
  readonly startX: number
  readonly stopX: number
  /** Who stands where: each group centred on an x, a step apart. */
  readonly centres: Readonly<Record<'stay' | 'pull', number>>
  readonly spacing: number
}

const APPROACH_X = -520
const FAR_X = 1520

function driverTracks(plan: DriverPlan) {
  const { fork, sideStraight, bend } = plan
  const approach: Segment = { kind: 'line', from: { x: APPROACH_X, y: fork.y }, to: fork }
  const mainAhead: Segment = { kind: 'line', from: fork, to: { x: FAR_X, y: fork.y } }
  const sideCurve: Segment = { kind: 'cubic', from: fork, c1: { x: bend[0], y: fork.y }, c2: { x: bend[1], y: sideStraight.y }, to: sideStraight }
  const sideAhead: Segment = { kind: 'line', from: sideStraight, to: { x: FAR_X, y: sideStraight.y } }
  const main = new Route([approach, mainAhead])
  const side = new Route([approach, sideCurve, sideAhead])
  return {
    fork,
    /** The tram's whole way, depending on the choice. */
    routes: { stay: main, pull: side },
    /** Drawn separately, so the shared approach is drawn once. */
    tracks: { approach: new Route([approach]), main: new Route([mainAhead]), side: new Route([sideCurve, sideAhead]) },
    centres: plan.centres,
    spacing: plan.spacing,
    /** Distances along the approach for the tram's front. */
    tram: { length: 186, start: plan.startX - APPROACH_X, stop: plan.stopX - APPROACH_X },
  } as const
}

export type DriverGeometry = ReturnType<typeof driverTracks>

/** Distances along a route for `count` people of a group, centred and a step apart. */
export function driverSpots(geometry: DriverGeometry, choice: 'stay' | 'pull', count: number): number[] {
  const route = geometry.routes[choice]
  const centre = geometry.centres[choice]
  return Array.from({ length: count }, (_, i) => route.distanceAtX(centre + (i - (count - 1) / 2) * geometry.spacing))
}

/** Philippa Foot's driver on a wide stage: one track ahead with five on it, a branch with one. */
export const DRIVER = driverTracks({
  fork: { x: 330, y: 300 },
  sideStraight: { x: 590, y: 420 },
  bend: [440, 470],
  startX: -290,
  stopX: 250,
  centres: { stay: 730, pull: 760 },
  spacing: 55,
})

/** The same on a tall (phone) stage: everything closer together, the branch dropping much further. */
export const DRIVER_TALL = driverTracks({
  fork: { x: 420, y: 300 },
  sideStraight: { x: 580, y: 600 },
  bend: [500, 520],
  startX: -300,
  stopX: 360,
  centres: { stay: 534, pull: 600 },
  spacing: 44,
})

/** A little bigger lower down the screen: closer to the viewer. */
export const depthScale = (y: number): number => 1 + ((y - 300) / 120) * 0.08

/** Where a figure's shoulders and head are (feet on 0, 0), for the scenes that animate them. */
export const FIGURE = { shoulderX: 12, shoulderY: -47, armRest: 10, headY: -66, height: 80 } as const
