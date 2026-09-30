import {
  CUSTOM_PRESETS,
  isGameMode,
  sanitizeCustomSettings,
  type CustomSettings,
  type GameMode,
} from '@games/trap-the-orb-engine'
import * as z from 'zod/mini'
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from './keyValueStore'

export const MAX_NICKNAME_LENGTH = 16

export interface Settings {
  /** Name for scores saved on this device (signed-in players use their account nickname). */
  readonly nickname: string
  readonly soundEnabled: boolean
  /** The mode the home page opens with. */
  readonly lastMode: GameMode
  /** The player's Custom mode setup. */
  readonly custom: CustomSettings
}

export const DEFAULT_SETTINGS: Settings = {
  nickname: '',
  soundEnabled: true,
  lastMode: 'classic',
  custom: CUSTOM_PRESETS.normal,
}

const nicknameSchema = z.string().check(z.maxLength(64))
const soundSchema = z.boolean()

// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f<>]/g

/** Display-safe nickname: no control characters or brackets, single spaces, max 16 chars. */
export function sanitizeNickname(input: string): string {
  return input.replace(UNSAFE_CHARACTERS, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NICKNAME_LENGTH).trim()
}

/** Stored settings, repaired field by field so one bad value never resets everything. */
export function loadSettings(store: KeyValueStore | null): Settings {
  const raw = readJson(store, STORAGE_KEYS.settings)
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS

  const record = raw as Record<string, unknown>
  const nickname = nicknameSchema.safeParse(record.nickname)
  const soundEnabled = soundSchema.safeParse(record.soundEnabled)

  return {
    nickname: nickname.success ? sanitizeNickname(nickname.data) : DEFAULT_SETTINGS.nickname,
    soundEnabled: soundEnabled.success ? soundEnabled.data : DEFAULT_SETTINGS.soundEnabled,
    lastMode: isGameMode(record.lastMode) ? record.lastMode : DEFAULT_SETTINGS.lastMode,
    custom: record.custom === undefined ? DEFAULT_SETTINGS.custom : sanitizeCustomSettings(record.custom),
  }
}

export function saveSettings(store: KeyValueStore | null, settings: Settings): boolean {
  return writeJson(store, STORAGE_KEYS.settings, {
    nickname: sanitizeNickname(settings.nickname),
    soundEnabled: settings.soundEnabled,
    lastMode: settings.lastMode,
    custom: sanitizeCustomSettings(settings.custom),
  })
}
