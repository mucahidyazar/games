import { isGameMode, sanitizeCustomSettings, type CustomSettings, type GameMode } from '@games/trap-the-orb-engine'
import * as z from 'zod/mini'
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from './keyValueStore'

/** Highest level a saved run may point at — guards against tampered storage. */
const MAX_SAVED_LEVEL = 500

const savedRunSchema = z.object({
  mode: z.string(),
  custom: z.optional(z.unknown()),
  level: z.int().check(z.gte(2), z.lte(MAX_SAVED_LEVEL)),
  score: z.int().check(z.gte(0)),
  savedAt: z.number(),
})

/** Where to pick an unranked game back up: the start of a level, with the score earned so far. */
export interface SavedRun {
  readonly mode: GameMode
  /** The setup of a Custom run; null for every other mode. */
  readonly custom: CustomSettings | null
  readonly level: number
  readonly score: number
  readonly savedAt: number
}

export function loadSavedRun(store: KeyValueStore | null): SavedRun | null {
  const parsed = savedRunSchema.safeParse(readJson(store, STORAGE_KEYS.savedRun))
  if (!parsed.success) return null
  const { mode, custom, level, score, savedAt } = parsed.data
  if (!isGameMode(mode)) return null
  return { mode, custom: mode === 'custom' ? sanitizeCustomSettings(custom) : null, level, score, savedAt }
}

export function saveSavedRun(store: KeyValueStore | null, run: SavedRun): boolean {
  return writeJson(store, STORAGE_KEYS.savedRun, run)
}

export function clearSavedRun(store: KeyValueStore | null): void {
  store?.removeItem(STORAGE_KEYS.savedRun)
}
