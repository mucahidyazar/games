import type { KeyValueStore } from './keyValueStore'

export interface MemoryStoreOptions {
  /** Simulates a full or locked storage where every write throws. */
  readonly failWrites?: boolean
}

/** In-memory KeyValueStore, used by tests and as a stand-in for blocked storage. */
export function createMemoryStore(
  initial: Readonly<Record<string, string>> = {},
  { failWrites = false }: MemoryStoreOptions = {},
): KeyValueStore {
  const data = new Map(Object.entries(initial))

  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (failWrites) throw new DOMException('Storage is full', 'QuotaExceededError')
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}
