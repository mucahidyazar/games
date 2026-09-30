/**
 * Pure mulberry32 PRNG: returns the next value in [0, 1) together with the
 * seed to use for the following draw, so game state stays reproducible.
 */
export function nextRandom(seed: number): readonly [value: number, nextSeed: number] {
  const nextSeed = (seed + 0x6d2b79f5) >>> 0
  let t = nextSeed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, nextSeed]
}

/** A random 32-bit seed for a fresh game. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0
}

/**
 * Seed of the Daily Challenge for a UTC date (YYYY-MM-DD): the same levels for
 * everyone that day. FNV-1a hash, so the browser and the server agree.
 */
export function dailySeed(isoDate: string): number {
  let hash = 0x811c9dc5
  for (const char of `traptheorb:daily:${isoDate}`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
