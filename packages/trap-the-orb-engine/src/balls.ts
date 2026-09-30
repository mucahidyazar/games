import { circleOverlapsSolid } from './geometry'
import { nextRandom } from './random'
import type { Ball, Grid } from './types'

const MAX_SPAWN_ATTEMPTS = 400
/** Extra breathing room between freshly spawned balls and the walls, in cells. */
const SPAWN_MARGIN = 1

/**
 * Moves a ball one step, resolving each axis on its own: a blocked axis flips
 * its velocity and keeps the previous coordinate, so a ball can never end up
 * overlapping a solid cell.
 */
export function moveBall(ball: Ball, grid: Grid, dt: number): Ball {
  let { x, y, vx, vy } = ball

  const nextX = x + vx * dt
  if (circleOverlapsSolid(grid, nextX, y, ball.radius)) vx = -vx
  else x = nextX

  const nextY = y + vy * dt
  if (circleOverlapsSolid(grid, x, nextY, ball.radius)) vy = -vy
  else y = nextY

  return { ...ball, x, y, vx, vy }
}

/**
 * Lets overlapping balls bounce off each other by exchanging the velocity
 * components along which they approach. Keeps motion strictly diagonal.
 * Returns the original array when nothing collides.
 */
export function resolveBallPairs(balls: readonly Ball[]): readonly Ball[] {
  let next: Ball[] | null = null

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = (next ?? balls)[i]
      const b = (next ?? balls)[j]
      if (!a || !b) continue

      const dx = b.x - a.x
      const dy = b.y - a.y
      const reach = a.radius + b.radius
      if (dx * dx + dy * dy >= reach * reach) continue

      const swapX = (b.vx - a.vx) * dx < 0
      const swapY = (b.vy - a.vy) * dy < 0
      if (swapX || swapY) {
        next ??= [...balls]
        next[i] = { ...a, vx: swapX ? b.vx : a.vx, vy: swapY ? b.vy : a.vy }
        next[j] = { ...b, vx: swapX ? a.vx : b.vx, vy: swapY ? a.vy : b.vy }
        continue
      }

      // Overlapping balls moving in lockstep would stay glued together forever.
      if (a.vx !== b.vx || a.vy !== b.vy) continue
      next ??= [...balls]
      const [steeredA, steeredB] = steerApart(a, b, dx, dy)
      next[i] = steeredA
      next[j] = steeredB
    }
  }

  return next ?? balls
}

/**
 * Turns two lockstep balls away from each other along the axis they are most
 * offset on. Only velocities change, so neither ball can be pushed into a wall.
 */
function steerApart(a: Ball, b: Ball, dx: number, dy: number): readonly [Ball, Ball] {
  if (Math.abs(dx) >= Math.abs(dy)) {
    const direction = dx < 0 ? -1 : 1
    return [
      { ...a, vx: -direction * Math.abs(a.vx) },
      { ...b, vx: direction * Math.abs(b.vx) },
    ]
  }
  const direction = dy < 0 ? -1 : 1
  return [
    { ...a, vy: -direction * Math.abs(a.vy) },
    { ...b, vy: direction * Math.abs(b.vy) },
  ]
}

export interface SpawnOptions {
  readonly grid: Grid
  /** Speed of each orb per axis (cells per second); one orb is spawned per entry. */
  readonly speeds: readonly number[]
  /** Speed tier of each orb, used for its colour. */
  readonly tiers: readonly number[]
  readonly radius: number
  readonly seed: number
  readonly firstId: number
}

export interface SpawnResult {
  readonly balls: readonly Ball[]
  readonly seed: number
}

/** Places one ball per speed on free space, with random diagonal headings. */
export function spawnBalls({ grid, speeds, tiers, radius, seed, firstId }: SpawnOptions): SpawnResult {
  const balls: Ball[] = []
  let currentSeed = seed
  const draw = (): number => {
    const [value, next] = nextRandom(currentSeed)
    currentSeed = next
    return value
  }

  const pad = 1 + radius + SPAWN_MARGIN
  const spanX = Math.max(0, grid.cols - pad * 2)
  const spanY = Math.max(0, grid.rows - pad * 2)

  speeds.forEach((speed, index) => {
    let x = grid.cols / 2
    let y = grid.rows / 2

    for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++) {
      const candidateX = pad + draw() * spanX
      const candidateY = pad + draw() * spanY
      if (circleOverlapsSolid(grid, candidateX, candidateY, radius + SPAWN_MARGIN)) continue

      // Squared distances only: Math.hypot may round differently between JavaScript engines,
      // and the server must reproduce the exact same spawn positions.
      const crowded = balls.some((other) => {
        const reach = other.radius + radius + SPAWN_MARGIN
        const dx = other.x - candidateX
        const dy = other.y - candidateY
        return dx * dx + dy * dy <= reach * reach
      })
      x = candidateX
      y = candidateY
      if (!crowded) break
    }

    balls.push({
      id: firstId + index,
      x,
      y,
      vx: draw() < 0.5 ? -speed : speed,
      vy: draw() < 0.5 ? -speed : speed,
      radius,
      tier: tiers[index] ?? 0,
    })
  })

  return { balls, seed: currentSeed }
}

/** Mirrors a ball across the diagonal: the portrait field is the landscape field turned on its side. */
export function transposeBall(ball: Ball): Ball {
  return { ...ball, x: ball.y, y: ball.x, vx: ball.vy, vy: ball.vx }
}
