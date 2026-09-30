import { logger } from '@/lib/logger'

/** The subset of the Web Storage API the app relies on. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const STORAGE_KEYS = {
  settings: 'traptheorb.v1.settings',
  highScores: 'traptheorb.v1.highScores',
  savedRun: 'traptheorb.v1.savedRun',
} as const

/** localStorage when it is usable; null in private modes that block it. */
export function getBrowserStore(): KeyValueStore | null {
  try {
    if (typeof window === 'undefined') return null
    const store = window.localStorage
    const probe = '__traptheorb_probe__'
    store.setItem(probe, probe)
    store.removeItem(probe)
    return store
  } catch (error: unknown) {
    logger.warn('localStorage unavailable, progress will not be saved', error)
    return null
  }
}

/** Parsed JSON for `key`, or null when missing or unreadable. */
export function readJson(store: KeyValueStore | null, key: string): unknown {
  if (!store) return null
  try {
    const raw = store.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  } catch (error: unknown) {
    logger.warn(`Ignoring unreadable data in ${key}`, error)
    return null
  }
}

/** Serialises `value` into `key`; returns false instead of throwing on failure. */
export function writeJson(store: KeyValueStore | null, key: string, value: unknown): boolean {
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch (error: unknown) {
    logger.warn(`Could not save ${key}`, error)
    return false
  }
}
