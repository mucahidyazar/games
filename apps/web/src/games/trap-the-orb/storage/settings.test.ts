import { CUSTOM_PRESETS } from '@games/trap-the-orb-engine'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from './keyValueStore'
import { createMemoryStore } from './memoryStore'
import { DEFAULT_SETTINGS, loadSettings, sanitizeNickname, saveSettings } from './settings'

describe('sanitizeNickname', () => {
  it('trims, collapses whitespace and limits the length', () => {
    expect(sanitizeNickname('   Grid   Master  ')).toBe('Grid Master')
    expect(sanitizeNickname('A'.repeat(40))).toHaveLength(16)
  })

  it('removes control characters and angle brackets', () => {
    expect(sanitizeNickname('Ne\u0000o<script>')).toBe('Neoscript')
  })
})

describe('settings storage', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings(createMemoryStore())).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips valid settings', () => {
    const store = createMemoryStore()
    const settings = { nickname: 'Luna', soundEnabled: false, lastMode: 'timeAttack', custom: CUSTOM_PRESETS.hard } as const

    expect(saveSettings(store, settings)).toBe(true)
    expect(loadSettings(store)).toEqual(settings)
  })

  it('repairs partially invalid data field by field', () => {
    const store = createMemoryStore({
      [STORAGE_KEYS.settings]: JSON.stringify({
        nickname: 12,
        soundEnabled: false,
        lastMode: 'turbo',
        custom: { orbCount: 50 },
      }),
    })

    expect(loadSettings(store)).toEqual({
      nickname: '',
      soundEnabled: false,
      lastMode: 'classic',
      custom: { ...CUSTOM_PRESETS.normal, orbCount: 12 },
    })
  })
})
