import { describe, expect, it } from 'vitest'
import { BADGES, badgeById, evaluateRunBadges, tierFor } from './badges'
import { EMPTY_STATS } from './stats'
import type { RunStats } from './types'

const stats = (overrides: Partial<RunStats>): RunStats => ({ ...EMPTY_STATS, ...overrides })

describe('badge definitions', () => {
  it('has three strictly ordered thresholds per badge', () => {
    for (const badge of BADGES) {
      const [bronze, silver, gold] = badge.thresholds
      if (badge.direction === 'atLeast') {
        expect(bronze).toBeLessThan(silver)
        expect(silver).toBeLessThan(gold)
      } else {
        expect(bronze).toBeGreaterThan(silver)
        expect(silver).toBeGreaterThan(gold)
      }
    }
  })

  it('uses unique ids', () => {
    expect(new Set(BADGES.map((badge) => badge.id)).size).toBe(BADGES.length)
  })
})

describe('tierFor', () => {
  it('handles higher-is-better and lower-is-better badges at the exact thresholds', () => {
    const climber = badgeById('climber')
    const squeeze = badgeById('squeeze')

    expect(tierFor(climber, 4)).toBe(0)
    expect(tierFor(climber, 5)).toBe(1)
    expect(tierFor(climber, 10)).toBe(2)
    expect(tierFor(climber, 99)).toBe(3)
    expect(tierFor(squeeze, 3.1)).toBe(0)
    expect(tierFor(squeeze, 3)).toBe(1)
    expect(tierFor(squeeze, 0.5)).toBe(3)
    expect(tierFor(squeeze, null)).toBe(0)
  })
})

describe('evaluateRunBadges', () => {
  it('awards every badge a ranked run qualifies for, at the highest tier reached', () => {
    const earned = evaluateRunBadges(
      stats({ highestLevel: 11, tightestTrapPct: 1.2, biggestCapturePct: 26, bestPerfectStreak: 5 }),
      'classic',
    )

    expect(earned).toEqual([
      { id: 'climber', tier: 2 },
      { id: 'squeeze', tier: 2 },
      { id: 'landGrab', tier: 1 },
      { id: 'flawless', tier: 3 },
    ])
  })

  it('keeps mode badges for their own mode', () => {
    const run = stats({ highestLevel: 7 })

    expect(evaluateRunBadges(run, 'hardcore')).toContainEqual({ id: 'survivor', tier: 2 })
    expect(evaluateRunBadges(run, 'classic')).not.toContainEqual(expect.objectContaining({ id: 'survivor' }))
    expect(evaluateRunBadges(run, 'timeAttack')).toContainEqual({ id: 'beatTheClock', tier: 1 })
    expect(evaluateRunBadges(run, 'limitedWalls')).toContainEqual({ id: 'frugal', tier: 1 })
  })

  it('awards nothing in the unranked modes', () => {
    const run = stats({ highestLevel: 30, tightestTrapPct: 0.1 })

    expect(evaluateRunBadges(run, 'zen')).toEqual([])
    expect(evaluateRunBadges(run, 'custom')).toEqual([])
  })

  it('leaves account badges such as the daily streak to the server', () => {
    const accountBadges = BADGES.filter((badge) => badge.source === 'account').map((badge) => badge.id)

    expect(accountBadges).toEqual(['devotee'])
    expect(evaluateRunBadges(stats({ highestLevel: 30 }), 'daily').map((badge) => badge.id)).not.toContain('devotee')
  })
})
