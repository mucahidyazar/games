import { HARDCORE_LIVES } from './constants'
import type { CustomSettings, GameMode, ModeRules } from './types'

export const GAME_MODES: readonly GameMode[] = [
  'classic',
  'daily',
  'timeAttack',
  'limitedWalls',
  'hardcore',
  'zen',
  'custom',
]

/** Modes with fixed rules. Only these reach leaderboards and earn badges. */
export const RANKED_MODES: readonly GameMode[] = ['classic', 'daily', 'timeAttack', 'limitedWalls', 'hardcore']

export function isGameMode(value: unknown): value is GameMode {
  return typeof value === 'string' && (GAME_MODES as readonly string[]).includes(value)
}

export function isRankedMode(mode: GameMode): boolean {
  return RANKED_MODES.includes(mode)
}

interface Range {
  readonly min: number
  readonly max: number
}

export const CUSTOM_LIMITS: Readonly<Record<keyof CustomSettings, Range>> = {
  orbCount: { min: 1, max: 12 },
  speed: { min: 0.6, max: 2 },
  lives: { min: 1, max: 9 },
  walls: { min: 3, max: 40 },
  timeLimitSeconds: { min: 30, max: 300 },
  targetPercent: { min: 50, max: 95 },
}

export type CustomPreset = 'easy' | 'normal' | 'hard' | 'expert'

/** Starting points for Custom; the player can fine-tune every value. */
export const CUSTOM_PRESETS: Readonly<Record<CustomPreset, CustomSettings>> = {
  easy: { orbCount: 2, speed: 0.8, lives: null, walls: null, timeLimitSeconds: null, targetPercent: 70 },
  normal: { orbCount: 3, speed: 1, lives: 4, walls: null, timeLimitSeconds: null, targetPercent: 75 },
  hard: { orbCount: 5, speed: 1.3, lives: 3, walls: 16, timeLimitSeconds: 120, targetPercent: 80 },
  expert: { orbCount: 8, speed: 1.6, lives: 2, walls: 18, timeLimitSeconds: 90, targetPercent: 85 },
}

const clamp = (value: number, { min, max }: Range): number => Math.min(max, Math.max(min, value))

function wholeNumber(value: unknown, range: Range, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.round(value), range) : fallback
}

/** Like `wholeNumber`, but `null` (unlimited) is a valid choice. */
function optionalWholeNumber(value: unknown, range: Range, fallback: number | null): number | null {
  if (value === null) return null
  return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.round(value), range) : fallback
}

/** Clamps untrusted Custom settings into the allowed ranges; missing or invalid values fall back to Normal. */
export function sanitizeCustomSettings(input: unknown): CustomSettings {
  const base = CUSTOM_PRESETS.normal
  if (typeof input !== 'object' || input === null) return base
  const raw = input as Partial<Record<keyof CustomSettings, unknown>>

  const speed =
    typeof raw.speed === 'number' && Number.isFinite(raw.speed)
      ? Math.round(clamp(raw.speed, CUSTOM_LIMITS.speed) * 10) / 10
      : base.speed

  return {
    orbCount: wholeNumber(raw.orbCount, CUSTOM_LIMITS.orbCount, base.orbCount),
    speed,
    lives: optionalWholeNumber(raw.lives, CUSTOM_LIMITS.lives, base.lives),
    walls: optionalWholeNumber(raw.walls, CUSTOM_LIMITS.walls, base.walls),
    timeLimitSeconds: optionalWholeNumber(raw.timeLimitSeconds, CUSTOM_LIMITS.timeLimitSeconds, base.timeLimitSeconds),
    targetPercent: wholeNumber(raw.targetPercent, CUSTOM_LIMITS.targetPercent, base.targetPercent),
  }
}

/** The rules a mode plays by. Custom settings are sanitised before use. */
export function rulesFor(mode: GameMode, custom?: CustomSettings): ModeRules {
  const base: ModeRules = {
    mode,
    ranked: isRankedMode(mode),
    livesPolicy: 'perLevel',
    runLives: 0,
    timed: false,
    limitedWalls: false,
    custom: null,
  }

  switch (mode) {
    case 'timeAttack':
      return { ...base, timed: true }
    case 'limitedWalls':
      return { ...base, limitedWalls: true }
    case 'hardcore':
      return { ...base, livesPolicy: 'perRun', runLives: HARDCORE_LIVES }
    case 'zen':
      return { ...base, livesPolicy: 'infinite' }
    case 'custom': {
      const settings = sanitizeCustomSettings(custom)
      return {
        ...base,
        livesPolicy: settings.lives === null ? 'infinite' : 'perLevel',
        timed: settings.timeLimitSeconds !== null,
        limitedWalls: settings.walls !== null,
        custom: settings,
      }
    }
    default:
      return base
  }
}
