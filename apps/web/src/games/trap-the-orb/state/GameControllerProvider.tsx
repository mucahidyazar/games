import { useState, type ReactNode } from 'react'
import { GameController, parseSeed } from '../controller/GameController'
import { GameControllerContext } from './gameControllerContext'
import { usePlayerData } from './playerDataContext'

type GameControllerProviderProps = {
  readonly children: ReactNode
  /** Injectable for tests. */
  readonly controller?: GameController
}

/**
 * Creates the game controller once for the whole app, so a run survives
 * visits to other pages (the board is hidden, not unmounted).
 */
export function GameControllerProvider({ children, controller: injected }: GameControllerProviderProps) {
  const { store, settings } = usePlayerData()
  const [controller] = useState(
    () =>
      injected ??
      new GameController({
        sound: store.sound,
        seed: parseSeed(window.location.search),
        mode: settings.lastMode,
        custom: settings.lastMode === 'custom' ? settings.custom : null,
      }),
  )
  return <GameControllerContext value={controller}>{children}</GameControllerContext>
}
