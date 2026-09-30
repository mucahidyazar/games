import { sanitizeCustomSettings, type CustomSettings, type GameMode } from '@games/trap-the-orb-engine'
import { createId } from '@/lib/id'
import type { SoundPlayer } from '../audio/sfx'
import { STORAGE_KEYS, type KeyValueStore } from '../storage/keyValueStore'
import { addHighScore, loadHighScores, saveHighScores, type HighScore } from '../storage/scores'
import { clearSavedRun, loadSavedRun, saveSavedRun, type SavedRun } from '../storage/savedRun'
import { loadSettings, sanitizeNickname, saveSettings, type Settings } from '../storage/settings'

const DEFAULT_PLAYER_NAME = 'Player'

export interface PlayerSnapshot {
  readonly settings: Settings
  readonly highScores: readonly HighScore[]
  /** An unfinished unranked game that can be continued, if any. */
  readonly savedRun: SavedRun | null
  /** False when the browser blocks storage — progress then lasts for this visit only. */
  readonly canPersist: boolean
}

export interface HighScoreInput {
  readonly name: string
  readonly mode: GameMode
  readonly score: number
  readonly level: number
}

export interface RunProgress {
  readonly mode: GameMode
  readonly custom: CustomSettings | null
  readonly level: number
  readonly score: number
}

export interface PlayerStore {
  readonly sound: SoundPlayer
  getSnapshot(): PlayerSnapshot
  subscribe(listener: () => void): () => void
  setSoundEnabled(enabled: boolean): void
  /** Remembers the mode the home page should open with. */
  setLastMode(mode: GameMode): void
  setCustomSettings(custom: CustomSettings): void
  /** Saves a finished run on this device; returns its 1-based rank in its mode, or null. */
  submitHighScore(input: HighScoreInput): number | null
  /** Remembers where an unfinished unranked game stands; level 1 needs no saving. */
  saveRun(progress: RunProgress): void
  clearRun(): void
  clearScores(): void
}

/**
 * Settings, high scores and the resumable run of the player on this device.
 * The snapshot is immutable and replaced on every change, which makes it a
 * natural fit for React's useSyncExternalStore.
 */
export function createPlayerStore(storage: KeyValueStore | null, sound: SoundPlayer): PlayerStore {
  const listeners = new Set<() => void>()
  let snapshot: PlayerSnapshot = {
    settings: loadSettings(storage),
    highScores: loadHighScores(storage),
    savedRun: loadSavedRun(storage),
    canPersist: storage !== null,
  }
  sound.setEnabled(snapshot.settings.soundEnabled)

  const update = (patch: Partial<PlayerSnapshot>): void => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  const updateSettings = (patch: Partial<Settings>): void => {
    const settings = { ...snapshot.settings, ...patch }
    saveSettings(storage, settings)
    update({ settings })
  }

  const clearRun = (): void => {
    if (snapshot.savedRun === null) return
    clearSavedRun(storage)
    update({ savedRun: null })
  }

  return {
    sound,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setSoundEnabled(enabled) {
      sound.setEnabled(enabled)
      // Toggling happens from a click or key press, so the audio context may start now.
      if (enabled) sound.unlock()
      updateSettings({ soundEnabled: enabled })
    },
    setLastMode(mode) {
      if (mode !== snapshot.settings.lastMode) updateSettings({ lastMode: mode })
    },
    setCustomSettings(custom) {
      updateSettings({ custom: sanitizeCustomSettings(custom) })
    },
    submitHighScore({ name, mode, score, level }) {
      const cleanName = sanitizeNickname(name) || DEFAULT_PLAYER_NAME
      const entry: HighScore = { id: createId(), name: cleanName, mode, score, level, createdAt: Date.now() }
      const { scores, rank } = addHighScore(snapshot.highScores, entry)
      if (cleanName !== snapshot.settings.nickname) updateSettings({ nickname: cleanName })
      if (rank === null) return null

      saveHighScores(storage, scores)
      update({ highScores: scores })
      return rank
    },
    saveRun({ mode, custom, level, score }) {
      if (level < 2) {
        // A fresh start replaces the save of the same mode only.
        if (snapshot.savedRun?.mode === mode) clearRun()
        return
      }
      const run: SavedRun = { mode, custom: mode === 'custom' ? custom : null, level, score, savedAt: Date.now() }
      saveSavedRun(storage, run)
      update({ savedRun: run })
    },
    clearRun,
    clearScores() {
      storage?.removeItem(STORAGE_KEYS.highScores)
      update({ highScores: [] })
    },
  }
}
