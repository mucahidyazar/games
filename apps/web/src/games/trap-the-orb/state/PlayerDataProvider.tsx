import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createSoundPlayer } from '../audio/sfx'
import { getBrowserStore } from '../storage/keyValueStore'
import { PlayerDataContext, type PlayerData } from './playerDataContext'
import { createPlayerStore, type PlayerStore } from './playerStore'

interface PlayerDataProviderProps {
  readonly children: ReactNode
  /** Injectable for tests; defaults to one backed by localStorage. */
  readonly store?: PlayerStore
}

export function PlayerDataProvider({ children, store: injected }: PlayerDataProviderProps) {
  const [store] = useState<PlayerStore>(() => injected ?? createPlayerStore(getBrowserStore(), createSoundPlayer(true)))
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const value = useMemo<PlayerData>(() => ({ ...snapshot, store }), [snapshot, store])

  return <PlayerDataContext value={value}>{children}</PlayerDataContext>
}
