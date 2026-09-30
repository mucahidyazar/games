import { describe, expect, it } from 'vitest'
import { BASE_BALL_SPEED, MAX_SPEED_TIER, SPEED_TIERS, TICKS_PER_SECOND } from './constants'
import { getLevelConfig, levelPlan, tierForSpeed } from './levels'
import { CUSTOM_PRESETS, rulesFor } from './modes'

const tiers = (level: number): readonly number[] => levelPlan(level).orbTiers
const sumOfSpeeds = (level: number): number =>
  tiers(level).reduce((sum, tier) => sum + (SPEED_TIERS[tier] ?? 0), 0)

describe('levelPlan', () => {
  it('opens gently: one orb, two orbs, then they speed up one at a time', () => {
    expect(levelPlan(1)).toEqual({ orbTiers: [0], change: 'first' })
    expect(levelPlan(2)).toEqual({ orbTiers: [0, 0], change: 'newOrb' })
    expect(levelPlan(3)).toEqual({ orbTiers: [1, 0], change: 'speedUp' })
    expect(levelPlan(4)).toEqual({ orbTiers: [1, 1], change: 'speedUp' })
  })

  it('lets everyone catch their breath when a new orb joins', () => {
    expect(levelPlan(5)).toEqual({ orbTiers: [0, 0, 0], change: 'breather' })
    expect(tiers(8)).toEqual([1, 1, 1])
    expect(levelPlan(9)).toEqual({ orbTiers: [1, 1, 1, 1], change: 'newOrb' })
    expect(tiers(13)).toEqual([2, 2, 2, 2])
  })

  it('speeds up two orbs per level once there are five', () => {
    expect(levelPlan(14)).toEqual({ orbTiers: [1, 1, 1, 1, 1], change: 'breather' })
    expect(tiers(15)).toEqual([2, 2, 1, 1, 1])
    expect(tiers(17)).toEqual([2, 2, 2, 2, 2])
  })

  it('never lowers the orb count and never exceeds the top speed tier', () => {
    let previousCount = 0
    for (let level = 1; level <= 300; level++) {
      const plan = levelPlan(level)
      expect(plan.orbTiers.length).toBeGreaterThanOrEqual(previousCount)
      expect(Math.max(...plan.orbTiers)).toBeLessThanOrEqual(MAX_SPEED_TIER)
      if (plan.change === 'speedUp') expect(plan.orbTiers.length).toBe(previousCount)
      previousCount = plan.orbTiers.length
    }
  })

  it('always gets harder within a stage, and every stage starts harder than the last', () => {
    let stageStart = 0
    for (let level = 2; level <= 120; level++) {
      const change = levelPlan(level).change
      if (change === 'speedUp') {
        expect(sumOfSpeeds(level)).toBeGreaterThan(sumOfSpeeds(level - 1))
      } else {
        expect(sumOfSpeeds(level)).toBeGreaterThan(stageStart)
        stageStart = sumOfSpeeds(level)
      }
    }
  })

  it('normalises invalid level numbers', () => {
    expect(levelPlan(0)).toEqual(levelPlan(1))
    expect(levelPlan(Number.NaN)).toEqual(levelPlan(1))
    expect(levelPlan(2.9)).toEqual(levelPlan(2))
  })
})

describe('getLevelConfig', () => {
  it('turns the plan into Classic rules', () => {
    const config = getLevelConfig(3, rulesFor('classic'))

    expect(config).toMatchObject({
      level: 3,
      orbCount: 2,
      orbTiers: [1, 0],
      orbSpeeds: [BASE_BALL_SPEED * 1.2, BASE_BALL_SPEED],
      lives: 3,
      wallBudget: null,
      timeLimitTicks: null,
      targetPercent: 75,
      parSeconds: 40,
      change: 'speedUp',
    })
  })

  it('adds a countdown in Time Attack and a wall budget in Limited Walls', () => {
    expect(getLevelConfig(5, rulesFor('timeAttack')).timeLimitTicks).toBe((30 + 15 * 3) * TICKS_PER_SECOND)
    expect(getLevelConfig(5, rulesFor('limitedWalls')).wallBudget).toBe(4 + 2 * 3)
  })

  it('repeats the player settings every round in Custom', () => {
    const rules = rulesFor('custom', { ...CUSTOM_PRESETS.hard, speed: 1.3 })
    const first = getLevelConfig(1, rules)
    const later = getLevelConfig(4, rules)

    expect(first).toMatchObject({
      orbCount: CUSTOM_PRESETS.hard.orbCount,
      orbSpeeds: Array(CUSTOM_PRESETS.hard.orbCount).fill(BASE_BALL_SPEED * 1.3),
      targetPercent: CUSTOM_PRESETS.hard.targetPercent,
      wallBudget: CUSTOM_PRESETS.hard.walls,
      timeLimitTicks: (CUSTOM_PRESETS.hard.timeLimitSeconds ?? 0) * TICKS_PER_SECOND,
      change: 'first',
    })
    expect(later).toMatchObject({ level: 4, orbCount: first.orbCount, change: 'repeat' })
  })
})

describe('tierForSpeed', () => {
  it('maps any speed to the closest-below colour tier', () => {
    expect(tierForSpeed(0.6)).toBe(0)
    expect(tierForSpeed(1.19)).toBe(0)
    expect(tierForSpeed(1.2)).toBe(1)
    expect(tierForSpeed(1.5)).toBe(2)
    expect(tierForSpeed(2)).toBe(3)
  })
})
