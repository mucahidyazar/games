import { describe, expect, it } from 'vitest'
import {
  finishRunRequestSchema,
  leaderboardQuerySchema,
  MAX_RUN_INPUTS,
  nicknameSchema,
  startRunRequestSchema,
} from './schemas'

describe('startRunRequestSchema', () => {
  it('accepts ranked modes only', () => {
    expect(startRunRequestSchema.safeParse({ mode: 'classic', field: 'portrait' }).success).toBe(true)
    expect(startRunRequestSchema.safeParse({ mode: 'zen', field: 'landscape' }).success).toBe(false)
    expect(startRunRequestSchema.safeParse({ mode: 'custom', field: 'landscape' }).success).toBe(false)
  })
})

describe('finishRunRequestSchema', () => {
  const valid = { endTick: 1200, inputs: [{ t: 30, c: 10, r: 20, o: 'v' }], clientScore: 540, clientLevel: 2 }

  it('accepts a well-formed recording', () => {
    expect(finishRunRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects oversized or malformed recordings', () => {
    const tooMany = Array.from({ length: MAX_RUN_INPUTS + 1 }, (_, t) => ({ t, c: 1, r: 1, o: 'v' }))
    expect(finishRunRequestSchema.safeParse({ ...valid, inputs: tooMany }).success).toBe(false)
    expect(finishRunRequestSchema.safeParse({ ...valid, endTick: -1 }).success).toBe(false)
    expect(finishRunRequestSchema.safeParse({ ...valid, inputs: [{ t: 1.5, c: 1, r: 1, o: 'v' }] }).success).toBe(false)
    expect(finishRunRequestSchema.safeParse({ ...valid, inputs: [{ t: 1, c: 1, r: 1, o: 'x' }] }).success).toBe(false)
  })
})

describe('nicknameSchema', () => {
  it('accepts friendly names in any alphabet and trims them', () => {
    expect(nicknameSchema.parse('  Mücahid_07 ')).toBe('Mücahid_07')
    expect(nicknameSchema.safeParse('Orb Master').success).toBe(true)
  })

  it('rejects names that are too short, too long or full of symbols', () => {
    expect(nicknameSchema.safeParse('ab').success).toBe(false)
    expect(nicknameSchema.safeParse('a'.repeat(17)).success).toBe(false)
    expect(nicknameSchema.safeParse('<script>').success).toBe(false)
    expect(nicknameSchema.safeParse('bad\nname').success).toBe(false)
  })
})

describe('leaderboardQuerySchema', () => {
  it('validates the board, the period and an optional day', () => {
    expect(leaderboardQuerySchema.safeParse({ board: 'score.classic', period: 'week' }).success).toBe(true)
    expect(leaderboardQuerySchema.safeParse({ board: 'score.daily', period: 'day', date: '2026-09-24' }).success).toBe(true)
    expect(leaderboardQuerySchema.safeParse({ board: 'score.daily', period: 'day', date: '24/09/2026' }).success).toBe(false)
    expect(leaderboardQuerySchema.safeParse({ board: 'nope', period: 'all' }).success).toBe(false)
  })
})

describe('shared enums', () => {
  it('lists the same modes and badges as the engine', async () => {
    const { BADGES, GAME_MODES, RANKED_MODES } = await import('@games/trap-the-orb-engine')
    const { badgeIdSchema, gameModeSchema, rankedModeSchema } = await import('./schemas')

    for (const mode of GAME_MODES) expect(gameModeSchema.safeParse(mode).success).toBe(true)
    for (const mode of RANKED_MODES) expect(rankedModeSchema.safeParse(mode).success).toBe(true)
    for (const badge of BADGES) expect(badgeIdSchema.safeParse(badge.id).success).toBe(true)
    expect(gameModeSchema.safeParse('easy').success).toBe(false)
  })
})
