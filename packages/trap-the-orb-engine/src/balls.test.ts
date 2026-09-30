import { describe, expect, it } from 'vitest'
import { moveBall, resolveBallPairs, spawnBalls, transposeBall } from './balls'
import { circleOverlapsSolid } from './geometry'
import { createGrid, fillCells } from './grid'
import { CELL_WALL, type Ball } from './types'

const makeBall = (overrides: Partial<Ball> = {}): Ball => ({
  id: 1,
  x: 10,
  y: 10,
  vx: 10,
  vy: 10,
  radius: 2,
  tier: 0,
  ...overrides,
})

describe('moveBall', () => {
  const grid = createGrid(40, 30)

  it('travels along its velocity in open space', () => {
    const moved = moveBall(makeBall(), grid, 0.1)

    expect(moved.x).toBeCloseTo(11)
    expect(moved.y).toBeCloseTo(11)
    expect(moved.vx).toBe(10)
    expect(moved.vy).toBe(10)
  })

  it('bounces off the border by reversing the blocked axis only', () => {
    const ball = makeBall({ x: 36.5, y: 10 }) // right edge at 38.5, border starts at 39

    const moved = moveBall(ball, grid, 0.1)

    expect(moved.vx).toBe(-10)
    expect(moved.vy).toBe(10)
    expect(moved.x).toBe(36.5)
    expect(moved.y).toBeCloseTo(11)
  })

  it('bounces off walls built inside the field', () => {
    const walled = fillCells(grid, Array.from({ length: 28 }, (_, i) => (i + 1) * 40 + 20), CELL_WALL)
    const ball = makeBall({ x: 17.5, y: 15 })

    const moved = moveBall(ball, walled, 0.1)

    expect(moved.vx).toBe(-10)
  })

  it('never overlaps solid cells, even after thousands of steps', () => {
    const walled = fillCells(
      grid,
      [
        ...Array.from({ length: 20 }, (_, i) => (i + 1) * 40 + 15),
        ...Array.from({ length: 14 }, (_, i) => 12 * 40 + 16 + i),
      ],
      CELL_WALL,
    )
    let ball = makeBall({ x: 25, y: 20, vx: 37, vy: -41, radius: 3.3 })

    for (let i = 0; i < 5000; i++) {
      ball = moveBall(ball, walled, 1 / 120)
      expect(circleOverlapsSolid(walled, ball.x, ball.y, ball.radius)).toBe(false)
    }
  })
})

describe('resolveBallPairs', () => {
  it('swaps velocity components of balls that approach each other', () => {
    const a = makeBall({ id: 1, x: 10, y: 10, vx: 5, vy: 5 })
    const b = makeBall({ id: 2, x: 13, y: 10, vx: -5, vy: 5 })

    const [nextA, nextB] = resolveBallPairs([a, b])

    expect(nextA?.vx).toBe(-5)
    expect(nextB?.vx).toBe(5)
    expect(nextA?.vy).toBe(5)
    expect(nextB?.vy).toBe(5)
  })

  it('pushes apart overlapping balls that move in lockstep', () => {
    const a = makeBall({ id: 1, x: 10, y: 10, vx: 5, vy: 5 })
    const b = makeBall({ id: 2, x: 11, y: 10.5, vx: 5, vy: 5 })

    const [nextA, nextB] = resolveBallPairs([a, b])

    expect(nextA?.vx).toBe(-5)
    expect(nextB?.vx).toBe(5)
    expect(nextA?.vy).toBe(5)
    expect(nextB?.vy).toBe(5)
  })

  it('separates lockstep balls along the axis they are most offset on', () => {
    const a = makeBall({ id: 1, x: 10, y: 12, vx: -5, vy: 5 })
    const b = makeBall({ id: 2, x: 10, y: 10, vx: -5, vy: 5 })

    const [nextA, nextB] = resolveBallPairs([a, b])

    expect(nextA?.vy).toBe(5)
    expect(nextB?.vy).toBe(-5)
    expect(nextA?.vx).toBe(-5)
    expect(nextB?.vx).toBe(-5)
  })

  it('never lets two lockstep balls stay glued together', () => {
    const grid = createGrid(60, 40)
    let balls = resolveBallPairs([
      makeBall({ id: 1, x: 20, y: 20, vx: 40, vy: 40, radius: 3.3 }),
      makeBall({ id: 2, x: 21, y: 20, vx: 40, vy: 40, radius: 3.3 }),
    ])

    for (let i = 0; i < 60; i++) {
      balls = resolveBallPairs(balls.map((ball) => moveBall(ball, grid, 1 / 120)))
    }

    const [a, b] = balls
    expect(Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0))).toBeGreaterThan(6.6)
  })

  it('leaves separating or distant balls alone', () => {
    const a = makeBall({ id: 1, x: 10, y: 10, vx: -5, vy: 5 })
    const b = makeBall({ id: 2, x: 13, y: 10, vx: 5, vy: 5 })
    const far = makeBall({ id: 3, x: 30, y: 30 })
    const balls = [a, b, far]

    expect(resolveBallPairs(balls)).toBe(balls)
  })
})

describe('spawnBalls', () => {
  const grid = createGrid(120, 60)
  const speeds = [40, 40, 48, 56, 40, 40, 40, 40]
  const tiers = [0, 0, 1, 2, 0, 0, 0, 0]

  it('spawns one orb per speed, with that speed and tier, inside free space', () => {
    const { balls } = spawnBalls({ grid, speeds, tiers, radius: 3.3, seed: 42, firstId: 5 })

    expect(balls).toHaveLength(8)
    expect(balls.map((ball) => ball.id)).toEqual([5, 6, 7, 8, 9, 10, 11, 12])
    balls.forEach((ball, index) => {
      expect(circleOverlapsSolid(grid, ball.x, ball.y, ball.radius)).toBe(false)
      expect(Math.abs(ball.vx)).toBe(speeds[index])
      expect(Math.abs(ball.vy)).toBe(speeds[index])
      expect(ball.tier).toBe(tiers[index])
    })
  })

  it('is deterministic for a given seed and advances the seed', () => {
    const options = { grid, speeds: [40, 40, 40], tiers: [0, 0, 0], radius: 3.3, firstId: 1 }
    const first = spawnBalls({ ...options, seed: 7 })
    const second = spawnBalls({ ...options, seed: 7 })
    const other = spawnBalls({ ...options, seed: 8 })

    expect(first).toEqual(second)
    expect(first.seed).not.toBe(7)
    expect(other.balls).not.toEqual(first.balls)
  })

  it('keeps freshly spawned balls apart from each other', () => {
    const many = Array(12).fill(40)
    const { balls } = spawnBalls({ grid, speeds: many, tiers: Array(12).fill(0), radius: 3.3, seed: 99, firstId: 1 })

    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i]!
        const b = balls[j]!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius)
      }
    }
  })
})

describe('transposeBall', () => {
  it('mirrors an orb across the diagonal for portrait fields', () => {
    const ball = makeBall({ x: 12, y: 3, vx: -5, vy: 9 })

    expect(transposeBall(ball)).toEqual({ ...ball, x: 3, y: 12, vx: 9, vy: -5 })
  })
})
