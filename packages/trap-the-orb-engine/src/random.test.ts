import { describe, expect, it } from 'vitest'
import { dailySeed, nextRandom, randomSeed } from './random'

describe('nextRandom', () => {
  it('returns values in [0, 1) and a new seed, deterministically', () => {
    const [a, seedA] = nextRandom(1)
    const [b, seedB] = nextRandom(1)

    expect(a).toBe(b)
    expect(seedA).toBe(seedB)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(1)
    expect(seedA).not.toBe(1)
  })
})

describe('randomSeed', () => {
  it('produces unsigned 32-bit integers', () => {
    const seed = randomSeed()

    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 32)
  })
})

describe('dailySeed', () => {
  it('gives everyone the same seed on a given day and a new one the next day', () => {
    expect(dailySeed('2026-09-24')).toBe(dailySeed('2026-09-24'))
    expect(dailySeed('2026-09-25')).not.toBe(dailySeed('2026-09-24'))
    expect(Number.isInteger(dailySeed('2026-09-24'))).toBe(true)
  })
})
