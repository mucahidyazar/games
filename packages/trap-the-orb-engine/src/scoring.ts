import {
  AREA_BONUS_PER_PERCENT,
  LIFE_BONUS,
  POINTS_PER_PERCENT,
  TICKS_PER_SECOND,
  TIME_BONUS_PER_SECOND,
  WALL_BONUS,
} from './constants'
import type { LevelConfig, LevelResult, ModeRules } from './types'

/** Points for newly claimed area: 10 per percent, multiplied by the level. */
export function capturePoints(percentGained: number, level: number): number {
  return Math.round(percentGained * POINTS_PER_PERCENT) * level
}

/** Level time in whole milliseconds. */
export const ticksToMs = (ticks: number): number => Math.round((ticks * 1000) / TICKS_PER_SECOND)

export interface LevelOutcome {
  readonly config: LevelConfig
  readonly rules: ModeRules
  readonly percent: number
  readonly levelTicks: number
  readonly livesLeft: number
  readonly wallsLeft: number | null
}

/** End-of-level payout for extra territory, remaining lives, speed and — in Limited Walls — unused walls. */
export function computeLevelResult({ config, rules, percent, levelTicks, livesLeft, wallsLeft }: LevelOutcome): LevelResult {
  const { level } = config
  const elapsedSeconds = Math.floor(levelTicks / TICKS_PER_SECOND)
  const secondsLeft =
    config.timeLimitTicks === null
      ? Math.max(0, config.parSeconds - elapsedSeconds)
      : Math.max(0, Math.floor((config.timeLimitTicks - levelTicks) / TICKS_PER_SECOND))

  const areaBonus = Math.max(0, Math.floor(percent) - config.targetPercent) * AREA_BONUS_PER_PERCENT * level
  const livesBonus = rules.livesPolicy === 'infinite' ? 0 : Math.max(0, livesLeft) * LIFE_BONUS * level
  const timeBonus = secondsLeft * TIME_BONUS_PER_SECOND * level
  const wallBonus = wallsLeft === null ? 0 : Math.max(0, wallsLeft) * WALL_BONUS * level

  return {
    level,
    percent,
    elapsedMs: ticksToMs(levelTicks),
    livesLeft,
    wallsLeft,
    areaBonus,
    livesBonus,
    timeBonus,
    wallBonus,
    totalBonus: areaBonus + livesBonus + timeBonus + wallBonus,
  }
}
