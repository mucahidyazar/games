import { isGameMode, type GameMode } from '@games/trap-the-orb-engine'
import * as z from 'zod/mini'
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from './keyValueStore'

/** Scores kept per mode on this device. */
export const MAX_HIGH_SCORES = 10

const highScoreSchema = z.object({
  id: z.string().check(z.maxLength(64)),
  name: z.string().check(z.maxLength(64)),
  // Scores saved before modes existed were Classic games.
  mode: z.optional(z.string()),
  score: z.int().check(z.gte(0)),
  level: z.int().check(z.gte(1)),
  createdAt: z.number(),
})

export interface HighScore {
  readonly id: string
  readonly name: string
  readonly mode: GameMode
  readonly score: number
  readonly level: number
  readonly createdAt: number
}

const byScore = (a: HighScore, b: HighScore): number => b.score - a.score || a.createdAt - b.createdAt

function parseHighScore(item: unknown): HighScore[] {
  const parsed = highScoreSchema.safeParse(item)
  if (!parsed.success) return []
  const { mode, ...rest } = parsed.data
  if (mode !== undefined && !isGameMode(mode)) return []
  return [{ ...rest, mode: mode ?? 'classic' }]
}

/** High scores of every mode, best first, at most MAX_HIGH_SCORES per mode. */
export function loadHighScores(store: KeyValueStore | null): HighScore[] {
  const raw = readJson(store, STORAGE_KEYS.highScores)
  if (!Array.isArray(raw)) return []

  const counts = new Map<GameMode, number>()
  return raw
    .flatMap(parseHighScore)
    .sort(byScore)
    .filter((score) => {
      const count = counts.get(score.mode) ?? 0
      counts.set(score.mode, count + 1)
      return count < MAX_HIGH_SCORES
    })
}

export function saveHighScores(store: KeyValueStore | null, scores: readonly HighScore[]): boolean {
  return writeJson(store, STORAGE_KEYS.highScores, scores)
}

export function highScoresFor(scores: readonly HighScore[], mode: GameMode): HighScore[] {
  return scores.filter((score) => score.mode === mode)
}

export function qualifiesForHighScores(scores: readonly HighScore[], mode: GameMode, score: number): boolean {
  if (score <= 0) return false
  const table = highScoresFor(scores, mode)
  if (table.length < MAX_HIGH_SCORES) return true
  const lowest = table.at(-1)?.score ?? 0
  return score > lowest
}

export interface AddHighScoreResult {
  readonly scores: readonly HighScore[]
  /** 1-based position of the new entry within its mode, or null when it did not make the table. */
  readonly rank: number | null
}

export function addHighScore(scores: readonly HighScore[], entry: HighScore): AddHighScoreResult {
  if (!qualifiesForHighScores(scores, entry.mode, entry.score)) return { scores, rank: null }

  const table = [...highScoresFor(scores, entry.mode), entry].sort(byScore).slice(0, MAX_HIGH_SCORES)
  const others = scores.filter((score) => score.mode !== entry.mode)
  const index = table.findIndex((score) => score.id === entry.id)
  return { scores: [...others, ...table].sort(byScore), rank: index >= 0 ? index + 1 : null }
}
