import {
  BASE_BALL_SPEED,
  MAX_SPEED_TIER,
  PAR_BASE_SECONDS,
  PAR_SECONDS_PER_ORB,
  SPEED_TIERS,
  TARGET_PERCENT,
  TICKS_PER_SECOND,
  TIME_LIMIT_BASE_SECONDS,
  TIME_LIMIT_SECONDS_PER_ORB,
  WALL_BUDGET_BASE,
  WALL_BUDGET_PER_ORB,
  WALL_SPEED,
} from './constants'
import type { LevelChange, LevelConfig, ModeRules } from './types'

/** Highest level we plan for; later levels repeat its difficulty. */
const MAX_LEVEL = 9999

export interface LevelPlan {
  /** Speed tier of each orb, fastest first. */
  readonly orbTiers: readonly number[]
  readonly change: LevelChange
}

/*
 * The Classic progression is a sawtooth that rises over time:
 *
 *   • A stage with n orbs starts with every orb at the stage's base speed,
 *     then speeds orbs up one tier at a time (two at a time from five orbs).
 *   • When all of them are faster, the next stage adds an orb. If the base
 *     speed stays the same, everyone calms down again — a breather level.
 *   • Base speed rises with the orb count: calm up to 3 orbs, quick up to 6,
 *     fast beyond — so every stage starts harder than the previous one.
 *
 *   L1  ●            L5  ● ● ●        L9   ◆ ◆ ◆ ◆
 *   L2  ● ●          L6  ◆ ● ●        …
 *   L3  ◆ ●          L7  ◆ ◆ ●        (● calm, ◆ quick, ▲ fast, ★ blazing)
 *   L4  ◆ ◆          L8  ◆ ◆ ◆
 */
const baseTierFor = (orbs: number): number => (orbs <= 3 ? 0 : orbs <= 6 ? 1 : 2)
const promotionsPerLevel = (orbs: number): number => (orbs >= 5 ? 2 : 1)
const stageLength = (orbs: number): number => (orbs === 1 ? 1 : 1 + Math.ceil(orbs / promotionsPerLevel(orbs)))

const normalizeLevel = (level: number): number =>
  Number.isFinite(level) ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(level))) : 1

function tiersFor(level: number): number[] {
  let remaining = level - 1
  let orbs = 1
  while (remaining >= stageLength(orbs)) {
    remaining -= stageLength(orbs)
    orbs++
  }
  const base = baseTierFor(orbs)
  const promoted = Math.min(orbs, remaining * promotionsPerLevel(orbs))
  return Array.from({ length: orbs }, (_, index) => Math.min(MAX_SPEED_TIER, index < promoted ? base + 1 : base))
}

/** Orb line-up of a Classic level and what changed compared with the previous level. */
export function levelPlan(level: number): LevelPlan {
  const safeLevel = normalizeLevel(level)
  const orbTiers = tiersFor(safeLevel)
  if (safeLevel === 1) return { orbTiers, change: 'first' }

  const previous = tiersFor(safeLevel - 1)
  if (orbTiers.length === previous.length) return { orbTiers, change: 'speedUp' }
  const slowedDown = previous.some((tier, index) => tier > (orbTiers[index] ?? 0))
  return { orbTiers, change: slowedDown ? 'breather' : 'newOrb' }
}

/** Colour tier for an arbitrary speed multiplier (Custom mode). */
export function tierForSpeed(multiplier: number): number {
  let tier = 0
  SPEED_TIERS.forEach((threshold, index) => {
    if (multiplier >= threshold) tier = index
  })
  return tier
}

const parFor = (orbCount: number): number => PAR_BASE_SECONDS + PAR_SECONDS_PER_ORB * orbCount

function customLevelConfig(level: number, rules: ModeRules): LevelConfig {
  const custom = rules.custom
  if (!custom) throw new Error('Custom rules need custom settings')
  const tier = tierForSpeed(custom.speed)

  return {
    level,
    orbCount: custom.orbCount,
    orbTiers: Array<number>(custom.orbCount).fill(tier),
    orbSpeeds: Array<number>(custom.orbCount).fill(BASE_BALL_SPEED * custom.speed),
    lives: custom.lives ?? custom.orbCount + 1,
    wallBudget: custom.walls,
    timeLimitTicks: custom.timeLimitSeconds === null ? null : custom.timeLimitSeconds * TICKS_PER_SECOND,
    wallSpeed: WALL_SPEED,
    targetPercent: custom.targetPercent,
    parSeconds: parFor(custom.orbCount),
    change: level === 1 ? 'first' : 'repeat',
  }
}

/** Everything a level needs: the orb line-up plus the limits of the current mode. */
export function getLevelConfig(level: number, rules: ModeRules): LevelConfig {
  const safeLevel = normalizeLevel(level)
  if (rules.custom) return customLevelConfig(safeLevel, rules)

  const plan = levelPlan(safeLevel)
  const orbCount = plan.orbTiers.length
  return {
    level: safeLevel,
    orbCount,
    orbTiers: plan.orbTiers,
    orbSpeeds: plan.orbTiers.map((tier) => BASE_BALL_SPEED * (SPEED_TIERS[tier] ?? 1)),
    lives: rules.livesPolicy === 'perRun' ? rules.runLives : orbCount + 1,
    wallBudget: rules.limitedWalls ? WALL_BUDGET_BASE + WALL_BUDGET_PER_ORB * orbCount : null,
    timeLimitTicks: rules.timed
      ? (TIME_LIMIT_BASE_SECONDS + TIME_LIMIT_SECONDS_PER_ORB * orbCount) * TICKS_PER_SECOND
      : null,
    wallSpeed: WALL_SPEED,
    targetPercent: TARGET_PERCENT,
    parSeconds: parFor(orbCount),
    change: plan.change,
  }
}
