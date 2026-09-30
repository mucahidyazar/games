import { CUSTOM_PRESETS } from '@games/trap-the-orb-engine'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from './keyValueStore'
import { createMemoryStore } from './memoryStore'
import { clearSavedRun, loadSavedRun, saveSavedRun } from './savedRun'

describe('saved run', () => {
  it('round-trips the mode, level and score to continue from', () => {
    const store = createMemoryStore()
    const run = { mode: 'zen', custom: null, level: 5, score: 12_340, savedAt: 7 } as const

    expect(saveSavedRun(store, run)).toBe(true)
    expect(loadSavedRun(store)).toEqual(run)
  })

  it('keeps and repairs the setup of a Custom run', () => {
    const store = createMemoryStore({
      [STORAGE_KEYS.savedRun]: JSON.stringify({
        mode: 'custom',
        custom: { ...CUSTOM_PRESETS.hard, speed: 7 },
        level: 3,
        score: 10,
        savedAt: 1,
      }),
    })

    expect(loadSavedRun(store)?.custom).toEqual({ ...CUSTOM_PRESETS.hard, speed: 2 })
  })

  it('drops the Custom setup of other modes', () => {
    const store = createMemoryStore({
      [STORAGE_KEYS.savedRun]: JSON.stringify({
        mode: 'classic',
        custom: CUSTOM_PRESETS.hard,
        level: 3,
        score: 10,
        savedAt: 1,
      }),
    })

    expect(loadSavedRun(store)?.custom).toBeNull()
  })

  it('returns null when nothing is saved or the data is invalid', () => {
    expect(loadSavedRun(createMemoryStore())).toBeNull()
    expect(loadSavedRun(null)).toBeNull()
    const invalid = [
      { mode: 'classic', level: 1, score: 10, savedAt: 1 },
      { mode: 'classic', level: 3, score: -5, savedAt: 1 },
      { mode: 'turbo', level: 3, score: 5, savedAt: 1 },
      { level: 3, score: 5, savedAt: 1 },
      { level: 'x' },
      42,
    ]
    for (const bad of invalid) {
      const store = createMemoryStore({ [STORAGE_KEYS.savedRun]: JSON.stringify(bad) })
      expect(loadSavedRun(store)).toBeNull()
    }
  })

  it('can be cleared', () => {
    const store = createMemoryStore()
    saveSavedRun(store, { mode: 'classic', custom: null, level: 2, score: 900, savedAt: 1 })

    clearSavedRun(store)

    expect(loadSavedRun(store)).toBeNull()
  })
})
