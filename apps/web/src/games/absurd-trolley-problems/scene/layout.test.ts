import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { BRANCH, INCOMING, LAYOUT, MAIN, Path, RIG, ROUTES, slotsA, slotsB, SWITCH_AT } from './layout'

describe('Path', () => {
  const path = new Path([new Vector3(0, 0, 0), new Vector3(3, 0, 0), new Vector3(3, 0, 4)])

  it('walks by distance along its segments', () => {
    expect(path.length).toBe(7)
    expect(path.pointAt(1.5).toArray()).toEqual([1.5, 0, 0])
    expect(path.pointAt(5).toArray()).toEqual([3, 0, 2])
    expect(path.tangentAt(5).toArray()).toEqual([0, 0, 1])
  })

  it('carries straight on past either end', () => {
    expect(path.pointAt(-1).toArray()).toEqual([-1, 0, 0])
    expect(path.pointAt(9).toArray()).toEqual([3, 0, 6])
  })

  it('joins paths that share an end and needs two points', () => {
    const joined = Path.join(new Path([new Vector3(0, 0, 0), new Vector3(1, 0, 0)]), new Path([new Vector3(1, 0, 0), new Vector3(1, 0, 1)]))
    expect(joined.length).toBe(2)
    expect(() => new Path([new Vector3()])).toThrow()
  })
})

describe('the set', () => {
  it('splits at the switch into two tracks', () => {
    expect(SWITCH_AT).toBeCloseTo(INCOMING.length, 5)
    expect(ROUTES.A.length).toBeCloseTo(INCOMING.length + MAIN.length, 5)
    expect(ROUTES.B.length).toBeCloseTo(INCOMING.length + BRANCH.length, 5)
    expect(MAIN.pointAt(8).distanceTo(BRANCH.pointAt(8))).toBeGreaterThan(2)
  })

  it('starts the tram before the switch', () => {
    expect(LAYOUT.tramStart).toBeLessThan(SWITCH_AT)
    expect(LAYOUT.actorScale.person).toBeGreaterThan(1)
    expect(RIG.poses.phone?.R).toHaveLength(3)
  })

  it('spaces actors along track A and squeezes a crowd', () => {
    expect(slotsA(1)).toHaveLength(1)
    const five = slotsA(5)
    expect(five[1]! - five[0]!).toBeCloseTo(LAYOUT.victimsA.spacing)
    const crowd = slotsA(10)
    expect(crowd).toHaveLength(10)
    expect(crowd[9]! - crowd[0]!).toBeLessThan(4 * LAYOUT.victimsA.spacing + 1)
  })

  it('keeps track B’s actors clear of the switch', () => {
    const five = slotsB(5)
    expect(five[0]).toBeGreaterThanOrEqual(LAYOUT.victimsB.min)
    expect(slotsB(1)).toEqual([LAYOUT.victimsB.center])
  })
})
