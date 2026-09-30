import { createContext, useContext } from 'react'
import type { PlayerSnapshot, PlayerStore } from './playerStore'

export interface PlayerData extends PlayerSnapshot {
  readonly store: PlayerStore
}

export const PlayerDataContext = createContext<PlayerData | null>(null)

export function usePlayerData(): PlayerData {
  const value = useContext(PlayerDataContext)
  if (!value) throw new Error('usePlayerData must be used inside <PlayerDataProvider>')
  return value
}
