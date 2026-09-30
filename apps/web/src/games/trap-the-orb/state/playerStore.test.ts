import { CUSTOM_PRESETS } from '@games/trap-the-orb-engine'
import { describe, expect, it, vi } from 'vitest'
import type { SoundPlayer } from '../audio/sfx'
import { STORAGE_KEYS } from '../storage/keyValueStore'
import { createMemoryStore } from '../storage/memoryStore'
import { DEFAULT_SETTINGS } from '../storage/settings'
import { createPlayerStore } from './playerStore'

const fakeSound = (): SoundPlayer => ({ play: vi.fn(), unlock: vi.fn(), setEnabled: vi.fn() })

describe('createPlayerStore', () => {
  it('loads persisted data on creation', () => {
    const storage = createMemoryStore({
      [STORAGE_KEYS.settings]: JSON.stringify({ nickname: 'Luna', soundEnabled: false, lastMode: 'zen' }),
    })

    const store = createPlayerStore(storage, fakeSound())

    expect(store.getSnapshot().settings).toEqual({
      ...DEFAULT_SETTINGS,
      nickname: 'Luna',
      soundEnabled: false,
      lastMode: 'zen',
    })
    expect(store.getSnapshot().canPersist).toBe(true)
  })

  it('toggles sound, persists it and notifies subscribers with a new snapshot', () => {
    const storage = createMemoryStore()
    const sound = fakeSound()
    const store = createPlayerStore(storage, sound)
    const listener = vi.fn()
    store.subscribe(listener)
    const before = store.getSnapshot()

    store.setSoundEnabled(false)

    expect(sound.setEnabled).toHaveBeenCalledWith(false)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).not.toBe(before)
    expect(store.getSnapshot().settings.soundEnabled).toBe(false)
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.settings) ?? '{}')).toMatchObject({ soundEnabled: false })
  })

  it('remembers the last mode and the Custom setup', () => {
    const storage = createMemoryStore()
    const store = createPlayerStore(storage, fakeSound())
    const listener = vi.fn()
    store.subscribe(listener)

    store.setLastMode('hardcore')
    store.setLastMode('hardcore')
    store.setCustomSettings({ ...CUSTOM_PRESETS.hard, orbCount: 99 })

    expect(listener).toHaveBeenCalledTimes(2)
    const reloaded = createPlayerStore(storage, fakeSound()).getSnapshot().settings
    expect(reloaded.lastMode).toBe('hardcore')
    expect(reloaded.custom).toEqual({ ...CUSTOM_PRESETS.hard, orbCount: 12 })
  })

  it('saves qualifying high scores with a sanitised name and remembers the nickname', () => {
    const store = createPlayerStore(createMemoryStore(), fakeSound())

    const rank = store.submitHighScore({ name: '  <Grid>  Master ', mode: 'classic', score: 1200, level: 4 })

    expect(rank).toBe(1)
    expect(store.getSnapshot().highScores[0]).toMatchObject({
      name: 'Grid Master',
      mode: 'classic',
      score: 1200,
      level: 4,
    })
    expect(store.getSnapshot().settings.nickname).toBe('Grid Master')
  })

  it('uses a default name and rejects scores that do not qualify', () => {
    const store = createPlayerStore(createMemoryStore(), fakeSound())

    expect(store.submitHighScore({ name: '   ', mode: 'classic', score: 50, level: 1 })).toBe(1)
    expect(store.getSnapshot().highScores[0]?.name).toBe('Player')
    expect(store.submitHighScore({ name: 'Zero', mode: 'classic', score: 0, level: 1 })).toBeNull()
  })

  it('ranks scores within their own mode', () => {
    const store = createPlayerStore(createMemoryStore(), fakeSound())

    store.submitHighScore({ name: 'Ada', mode: 'classic', score: 5000, level: 6 })

    expect(store.submitHighScore({ name: 'Ada', mode: 'hardcore', score: 800, level: 3 })).toBe(1)
  })

  it('clears scores but keeps settings', () => {
    const storage = createMemoryStore()
    const store = createPlayerStore(storage, fakeSound())
    store.submitHighScore({ name: 'Ada', mode: 'classic', score: 500, level: 2 })

    store.clearScores()

    expect(store.getSnapshot().highScores).toEqual([])
    expect(store.getSnapshot().settings.nickname).toBe('Ada')
    expect(storage.getItem(STORAGE_KEYS.highScores)).toBeNull()
  })

  it('keeps working in memory when storage is unavailable', () => {
    const store = createPlayerStore(null, fakeSound())

    expect(store.getSnapshot().canPersist).toBe(false)
    expect(store.submitHighScore({ name: 'Ada', mode: 'classic', score: 10, level: 1 })).toBe(1)
    expect(store.getSnapshot().highScores).toHaveLength(1)
  })

  it('stops notifying after unsubscribe', () => {
    const store = createPlayerStore(createMemoryStore(), fakeSound())
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    store.setSoundEnabled(false)

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('sound unlocking', () => {
  it('unlocks audio only when sound is switched on by the player', () => {
    const sound = fakeSound()
    const store = createPlayerStore(createMemoryStore(), sound)

    expect(sound.unlock).not.toHaveBeenCalled()
    store.setSoundEnabled(false)
    expect(sound.unlock).not.toHaveBeenCalled()
    store.setSoundEnabled(true)
    expect(sound.unlock).toHaveBeenCalledTimes(1)
  })
})

describe('saved run', () => {
  it('remembers the mode and level to continue from, but only from level 2 on', () => {
    const storage = createMemoryStore()
    const store = createPlayerStore(storage, fakeSound())

    store.saveRun({ mode: 'zen', custom: null, level: 1, score: 0 })
    expect(store.getSnapshot().savedRun).toBeNull()

    store.saveRun({ mode: 'zen', custom: null, level: 4, score: 5_600 })
    expect(store.getSnapshot().savedRun).toMatchObject({ mode: 'zen', level: 4, score: 5_600 })
    expect(createPlayerStore(storage, fakeSound()).getSnapshot().savedRun).toMatchObject({
      mode: 'zen',
      custom: null,
      level: 4,
      score: 5_600,
    })
  })

  it('keeps the Custom setup of a Custom run only', () => {
    const store = createPlayerStore(createMemoryStore(), fakeSound())

    store.saveRun({ mode: 'custom', custom: CUSTOM_PRESETS.expert, level: 3, score: 100 })
    expect(store.getSnapshot().savedRun?.custom).toEqual(CUSTOM_PRESETS.expert)

    store.saveRun({ mode: 'classic', custom: CUSTOM_PRESETS.expert, level: 3, score: 100 })
    expect(store.getSnapshot().savedRun?.custom).toBeNull()
  })

  it('forgets the saved run when asked', () => {
    const store = createPlayerStore(createMemoryStore(), fakeSound())
    store.saveRun({ mode: 'classic', custom: null, level: 3, score: 900 })
    const listener = vi.fn()
    store.subscribe(listener)

    store.clearRun()
    store.clearRun()

    expect(store.getSnapshot().savedRun).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('clears the saved run when a new run of the same mode starts', () => {
    const store = createPlayerStore(createMemoryStore(), fakeSound())
    store.saveRun({ mode: 'zen', custom: null, level: 3, score: 900 })

    store.saveRun({ mode: 'custom', custom: null, level: 1, score: 0 })
    expect(store.getSnapshot().savedRun?.mode).toBe('zen')

    store.saveRun({ mode: 'zen', custom: null, level: 1, score: 0 })
    expect(store.getSnapshot().savedRun).toBeNull()
  })
})
