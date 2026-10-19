import { describe, expect, it } from 'vitest'
import { cubicPoint, DRIVER, DRIVER_TALL, depthScale, driverSpots, lerp, railPaths, Route, sleepers } from './geometry'

describe('Route', () => {
  const straight = new Route([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 100, y: 0 } }])
  const bend = new Route([
    { kind: 'line', from: { x: 0, y: 0 }, to: { x: 50, y: 0 } },
    { kind: 'cubic', from: { x: 50, y: 0 }, c1: { x: 100, y: 0 }, c2: { x: 100, y: 50 }, to: { x: 150, y: 50 } },
  ])

  it('walks a line by distance, clamped to its ends', () => {
    expect(straight.length).toBe(100)
    expect(straight.at(25)).toEqual({ x: 25, y: 0 })
    expect(straight.at(-10)).toEqual({ x: 0, y: 0 })
    expect(straight.at(500)).toEqual({ x: 100, y: 0 })
    expect(straight.angleAt(40)).toBe(0)
    expect(straight.distanceAtX(60)).toBeCloseTo(60)
    expect(straight.distanceAtX(400)).toBe(100)
  })

  it('follows a curve, turning down the screen', () => {
    expect(bend.length).toBeGreaterThan(150)
    const end = bend.at(bend.length)
    expect(end.x).toBeCloseTo(150)
    expect(end.y).toBeCloseTo(50)
    expect(bend.angleAt(50 + (bend.length - 50) / 2)).toBeGreaterThan(0.3)
    expect(bend.pathData()).toBe('M0 0L50 0C100 0 100 50 150 50')
  })

  it('draws two rails a gauge apart, and sleepers square to the way', () => {
    const [left, right] = railPaths(straight, 10)
    expect(left.startsWith('M0 5')).toBe(true)
    expect(right.startsWith('M0 -5')).toBe(true)
    expect(left.endsWith('L100 5')).toBe(true)
    const ties = sleepers(straight, 20)
    expect(ties.map((tie) => tie.x)).toEqual([10, 30, 50, 70, 90])
    expect(ties.every((tie) => tie.angle === 0)).toBe(true)
  })
})

describe('the driver’s tracks', () => {
  it('fork where the main line and the branch part', () => {
    const { routes, fork } = DRIVER
    expect(routes.stay.at(routes.stay.distanceAtX(fork.x))).toEqual(fork)
    expect(routes.pull.at(routes.pull.length).y).toBe(420)
    expect(routes.stay.at(routes.stay.length).y).toBe(300)
  })

  it.each([
    ['wide', DRIVER],
    ['tall', DRIVER_TALL],
  ] as const)('stand the five and the one beyond the fork, in order, on a %s stage', (_frame, geometry) => {
    const { routes, fork, tram } = geometry
    const five = driverSpots(geometry, 'stay', 5)
    expect(five).toHaveLength(5)
    expect(driverSpots(geometry, 'pull', 1)).toHaveLength(1)
    expect([...five].sort((a, b) => a - b)).toEqual(five)
    expect(routes.stay.at(five[0] as number).x).toBeGreaterThan(fork.x)
    // The tram waits short of the fork.
    expect(routes.stay.at(tram.stop).x).toBeLessThan(fork.x)
  })

  it('drop the branch much further on a tall stage', () => {
    expect(DRIVER_TALL.routes.pull.at(DRIVER_TALL.routes.pull.length).y - DRIVER_TALL.fork.y).toBeGreaterThan(DRIVER.routes.pull.at(DRIVER.routes.pull.length).y - DRIVER.fork.y)
  })

  it('draws whatever is lower down a little bigger', () => {
    expect(depthScale(300)).toBe(1)
    expect(depthScale(420)).toBeCloseTo(1.08)
    expect(lerp(2, 4, 0.5)).toBe(3)
    expect(cubicPoint({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 10 }, 0.5)).toEqual({ x: 5, y: 5 })
  })
})
