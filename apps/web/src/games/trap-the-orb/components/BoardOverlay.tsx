import { LevelCompletePanel } from './overlay/LevelCompletePanel'
import { PausedPanel } from './overlay/PausedPanel'
import { ReadyPanel } from './overlay/ReadyPanel'
import { ResultPanel } from './overlay/ResultPanel'
import type { OverlayProps } from './overlay/types'

export type { OverlayAccount, OverlayProps } from './overlay/types'

/** Card shown on top of the board whenever the game is not actively running. */
export function BoardOverlay(props: OverlayProps) {
  const { hud, flow } = props
  const isRunActive = hud.inRun && hud.status !== 'gameOver'
  if (flow.result && !isRunActive) return <ResultPanel {...props} result={flow.result} />

  switch (hud.status) {
    case 'ready':
      return <ReadyPanel {...props} />
    case 'paused':
      return <PausedPanel {...props} />
    case 'levelComplete':
      return hud.lastResult ? <LevelCompletePanel {...props} result={hud.lastResult} /> : null
    default:
      return null
  }
}
