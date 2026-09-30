import { describe, expect, it } from 'vitest'
import {
  CUSTOM_LIMITS,
  CUSTOM_PRESETS,
  GAME_MODES,
  isGameMode,
  isRankedMode,
  RANKED_MODES,
  rulesFor,
  sanitizeCustomSettings,
} from './modes'

describe('game modes', () => {
  it('ranks the five fixed-rule modes and keeps Zen and Custom casual', () => {
    expect(RANKED_MODES).toEqual(['classic', 'daily', 'timeAttack', 'limitedWalls', 'hardcore'])
    expect(GAME_MODES.filter((mode) => !isRankedMode(mode))).toEqual(['zen', 'custom'])
  })

  it('recognises valid mode ids', () => {
    expect(isGameMode('timeAttack')).toBe(true)
    expect(isGameMode('easy')).toBe(false)
    expect(isGameMode(42)).toBe(false)
  })
})

describe('rulesFor', () => {
  it('gives Classic and Daily per-level lives without timers or wall limits', () => {
    for (const mode of ['classic', 'daily'] as const) {
      expect(rulesFor(mode)).toMatchObject({
        mode,
        ranked: true,
        livesPolicy: 'perLevel',
        timed: false,
        limitedWalls: false,
        custom: null,
      })
    }
  })

  it('adds the twist of each challenge mode', () => {
    expect(rulesFor('timeAttack')).toMatchObject({ ranked: true, timed: true, limitedWalls: false })
    expect(rulesFor('limitedWalls')).toMatchObject({ ranked: true, timed: false, limitedWalls: true })
    expect(rulesFor('hardcore')).toMatchObject({ ranked: true, livesPolicy: 'perRun', runLives: 1 })
    expect(rulesFor('zen')).toMatchObject({ ranked: false, livesPolicy: 'infinite', timed: false })
  })

  it('builds Custom rules from the player settings', () => {
    const rules = rulesFor('custom', { ...CUSTOM_PRESETS.hard, lives: null })

    expect(rules).toMatchObject({ ranked: false, livesPolicy: 'infinite', timed: true, limitedWalls: true })
    expect(rules.custom).toEqual({ ...CUSTOM_PRESETS.hard, lives: null })
    expect(rulesFor('custom', CUSTOM_PRESETS.normal)).toMatchObject({ livesPolicy: 'perLevel', timed: false })
  })

  it('uses the Normal preset when Custom has no settings', () => {
    expect(rulesFor('custom').custom).toEqual(CUSTOM_PRESETS.normal)
  })
})

describe('sanitizeCustomSettings', () => {
  it('keeps every preset unchanged', () => {
    for (const preset of Object.values(CUSTOM_PRESETS)) {
      expect(sanitizeCustomSettings(preset)).toEqual(preset)
    }
  })

  it('clamps and rounds values into the allowed ranges', () => {
    const settings = sanitizeCustomSettings({
      orbCount: 99.6,
      speed: 0.123,
      lives: 0,
      walls: 1000,
      timeLimitSeconds: 5,
      targetPercent: 100,
    })

    expect(settings).toEqual({
      orbCount: CUSTOM_LIMITS.orbCount.max,
      speed: CUSTOM_LIMITS.speed.min,
      lives: CUSTOM_LIMITS.lives.min,
      walls: CUSTOM_LIMITS.walls.max,
      timeLimitSeconds: CUSTOM_LIMITS.timeLimitSeconds.min,
      targetPercent: CUSTOM_LIMITS.targetPercent.max,
    })
  })

  it('rounds speeds to one decimal and keeps unlimited options', () => {
    expect(sanitizeCustomSettings({ ...CUSTOM_PRESETS.normal, speed: 1.26, lives: null, walls: null })).toMatchObject({
      speed: 1.3,
      lives: null,
      walls: null,
    })
  })

  it('falls back to Normal for missing or garbage input', () => {
    expect(sanitizeCustomSettings(undefined)).toEqual(CUSTOM_PRESETS.normal)
    expect(sanitizeCustomSettings('hard')).toEqual(CUSTOM_PRESETS.normal)
    expect(sanitizeCustomSettings({ orbCount: 'many' })).toEqual(CUSTOM_PRESETS.normal)
  })
})
