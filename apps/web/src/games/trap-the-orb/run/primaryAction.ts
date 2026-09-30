import type { HudSnapshot } from '../controller/GameController'

/** The one main thing the player can do next, shown on the header button and bound to Enter. */
export type PrimaryAction = 'play' | 'continue' | 'pause' | 'resume' | 'next' | 'playAgain'

export function primaryActionFor(hud: HudSnapshot, hasResult: boolean, canContinue: boolean): PrimaryAction {
  const isRunActive = hud.inRun && hud.status !== 'gameOver'
  if (hasResult && !isRunActive) return 'playAgain'
  switch (hud.status) {
    case 'playing':
      return 'pause'
    case 'paused':
      return 'resume'
    case 'levelComplete':
      return 'next'
    case 'gameOver':
      return 'playAgain'
    default:
      return canContinue ? 'continue' : 'play'
  }
}
