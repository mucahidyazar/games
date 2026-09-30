import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from './keyValueStore'
import { createMemoryStore } from './memoryStore'
import {
  addHighScore,
  highScoresFor,
  loadHighScores,
  MAX_HIGH_SCORES,
  qualifiesForHighScores,
  saveHighScores,
  type HighScore,
} from './scores'

const entry = (score: number, overrides: Partial<HighScore> = {}): HighScore => ({
  id: `id-${score}-${overrides.mode ?? 'classic'}`,
  name: 'Ada',
  mode: 'classic',
  score,
  level: 3,
  createdAt: 1_700_000_000_000,
  ...overrides,
})

const fullTable = (): HighScore[] => Array.from({ length: MAX_HIGH_SCORES }, (_, i) => entry(1000 - i * 10))

describe('high scores', () => {
  it('inserts entries in descending score order and reports the rank', () => {
    const { scores, rank } = addHighScore([entry(900), entry(300)], entry(500))

    expect(scores.map((score) => score.score)).toEqual([900, 500, 300])
    expect(rank).toBe(2)
  })

  it('keeps only the best entries and ignores ones that do not make the cut', () => {
    const full = fullTable()

    const low = addHighScore(full, entry(1))
    const high = addHighScore(full, entry(5000))

    expect(low.rank).toBeNull()
    expect(low.scores).toBe(full)
    expect(high.rank).toBe(1)
    expect(high.scores).toHaveLength(MAX_HIGH_SCORES)
    expect(high.scores.at(-1)?.score).toBe(920)
  })

  it('keeps a separate table per mode', () => {
    const full = fullTable()

    const { scores, rank } = addHighScore(full, entry(5, { mode: 'hardcore' }))

    expect(rank).toBe(1)
    expect(highScoresFor(scores, 'classic')).toHaveLength(MAX_HIGH_SCORES)
    expect(highScoresFor(scores, 'hardcore').map((score) => score.score)).toEqual([5])
  })

  it('knows whether a score qualifies in its mode', () => {
    const full = fullTable()

    expect(qualifiesForHighScores([], 'classic', 0)).toBe(false)
    expect(qualifiesForHighScores([], 'classic', 10)).toBe(true)
    expect(qualifiesForHighScores(full, 'classic', 905)).toBe(false)
    expect(qualifiesForHighScores(full, 'classic', 915)).toBe(true)
    expect(qualifiesForHighScores(full, 'daily', 1)).toBe(true)
  })

  it('round-trips through storage and drops corrupted rows', () => {
    const store = createMemoryStore()
    saveHighScores(store, [entry(700), entry(900)])
    const saved = JSON.parse(store.getItem(STORAGE_KEYS.highScores) ?? '[]') as unknown[]
    store.setItem(
      STORAGE_KEYS.highScores,
      JSON.stringify([...saved, { name: 42 }, 'nope', { ...entry(50), mode: 'turbo' }]),
    )

    expect(loadHighScores(store).map((score) => score.score)).toEqual([900, 700])
  })

  it('treats scores saved before modes existed as Classic', () => {
    const { mode: _mode, ...legacy } = entry(640)
    const store = createMemoryStore({ [STORAGE_KEYS.highScores]: JSON.stringify([legacy]) })

    expect(loadHighScores(store)).toEqual([entry(640)])
  })

  it('keeps at most the table size per mode when loading', () => {
    const store = createMemoryStore()
    saveHighScores(store, [...fullTable(), entry(1), entry(2, { mode: 'zen' })])

    const loaded = loadHighScores(store)

    expect(highScoresFor(loaded, 'classic')).toHaveLength(MAX_HIGH_SCORES)
    expect(highScoresFor(loaded, 'zen')).toHaveLength(1)
  })

  it('falls back to an empty list for invalid JSON or missing storage', () => {
    const store = createMemoryStore({ [STORAGE_KEYS.highScores]: '{not json' })

    expect(loadHighScores(store)).toEqual([])
    expect(loadHighScores(null)).toEqual([])
  })

  it('reports failed writes instead of throwing', () => {
    const store = createMemoryStore({}, { failWrites: true })

    expect(saveHighScores(store, [entry(10)])).toBe(false)
    expect(saveHighScores(null, [entry(10)])).toBe(false)
  })
})
