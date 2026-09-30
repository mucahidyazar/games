import { createContext, useContext } from 'react'
import type { GameController } from '../controller/GameController'

/** The one game controller of the page, shared by the board and the mode picker. */
export const GameControllerContext = createContext<GameController | null>(null)

export function useGameController(): GameController {
  const controller = useContext(GameControllerContext)
  if (!controller) throw new Error('useGameController must be used inside <GameControllerProvider>')
  return controller
}
