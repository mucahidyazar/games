import type { DialogId } from '@/app/navigation'
import type { GameController, HudSnapshot } from '../../controller/GameController'
import type { RunFlow, RunFlowAccount } from '../../run/useRunFlow'
import type { SavedRun } from '../../storage/savedRun'

export interface OverlayAccount extends RunFlowAccount {
  /** Today's Daily Challenge already has a ranked result, so replays are practice. */
  readonly hasPlayedDailyToday: boolean
}

export interface OverlayProps {
  readonly hud: HudSnapshot
  readonly controller: GameController
  readonly flow: RunFlow
  readonly account: OverlayAccount
  /** An unfinished run of the selected mode that can be continued. */
  readonly savedRun: SavedRun | null
  /** From a finished run's result back to the start screen, to pick a mode or change the setup. */
  readonly onBackToReady: () => void
  /** Leaves a practice run for the start screen; it can be continued from its last level later. */
  readonly onLeaveRun: () => void
  readonly onOpenDialog: (id: DialogId) => void
  /** Returns focus to the board after an overlay button was used. */
  readonly onAfterAction: () => void
}
