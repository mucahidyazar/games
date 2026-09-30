import { isRankedMode, type CustomSettings, type GameMode } from '@games/trap-the-orb-engine'
import { useEffect, useEffectEvent, useRef, useSyncExternalStore, type RefObject } from 'react'
import type { DialogId } from '@/app/navigation'
import { useAccount, useRefreshAfterRun } from '@/features/account/queries'
import { AppDownloadStrip } from '@/games/trap-the-orb/apps/AppDownloadStrip'
import type { GameController } from '../controller/GameController'
import { useGameShortcuts } from '../hooks/useGameShortcuts'
import { primaryActionFor } from '../run/primaryAction'
import { useRunFlow, type AccountStatus } from '../run/useRunFlow'
import { useGameController } from '../state/gameControllerContext'
import { usePlayerData } from '../state/playerDataContext'
import type { PlayerStore } from '../state/playerStore'
import { BoardOverlay } from './BoardOverlay'
import { ControlsHint } from './ControlsHint'
import { GameBoard } from './GameBoard'
import { GameHeader } from './GameHeader'
import { LeaderboardCard } from './LeaderboardCard'
import { TipCard } from './TipCard'

type GameScreenProps = {
  /** The mode picked in the URL or, on the home page, the last one played. */
  readonly mode: GameMode
  /** False while another page is showing; the board then pauses and hides. */
  readonly isActive: boolean
  readonly isDialogOpen: boolean
  readonly onOpenDialog: (id: DialogId) => void
}

/** Brings the whole board on screen (landscape phones, short laptop screens) when a level starts. */
function ensureInView(element: HTMLElement | null): void {
  if (!element || typeof element.scrollIntoView !== 'function') return
  const { top, bottom } = element.getBoundingClientRect()
  if (top >= 0 && bottom <= window.innerHeight) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
}

/** Keeps unranked runs resumable: saved at every level start, forgotten at game over. */
function useSaveCasualRuns(controller: GameController, store: PlayerStore, boardRef: RefObject<HTMLElement | null>): void {
  useEffect(
    () =>
      controller.onGameEvents((events, state) => {
        const { mode, custom } = controller.getMode()
        const isCasual = !isRankedMode(mode)
        for (const event of events) {
          switch (event.type) {
            case 'runStarted':
            case 'levelStarted':
              if (isCasual) store.saveRun({ mode, custom, level: event.level, score: event.score })
              ensureInView(boardRef.current)
              break
            case 'levelComplete':
              // Closing the tab on the "level cleared" card should continue with the next level.
              if (isCasual) store.saveRun({ mode, custom, level: event.result.level + 1, score: state.score })
              break
            case 'gameOver':
              if (isCasual) store.clearRun()
              break
            default:
              break
          }
        }
      }),
    [controller, store, boardRef],
  )
}

export function GameScreen({ mode, isActive, isDialogOpen, onOpenDialog }: GameScreenProps) {
  const controller = useGameController()
  const { store, settings, savedRun } = usePlayerData()
  const hud = useSyncExternalStore(controller.subscribe, controller.getHud, controller.getHud)
  const account = useAccount()
  const refreshAfterRun = useRefreshAfterRun()
  const boardRef = useRef<HTMLDivElement>(null)
  const custom: CustomSettings | null = mode === 'custom' ? settings.custom : null

  const accountStatus: AccountStatus =
    account.status === 'signedIn' && account.isLoadingProfile ? 'loading' : account.status
  const flow = useRunFlow({
    controller,
    account: { status: accountStatus, nickname: account.nickname },
    onNeedNickname: () => onOpenDialog('account'),
    onRunVerified: refreshAfterRun,
  })
  const hasPlayedDailyToday = account.me?.dailyPlayedToday ?? false
  const matchingSave = savedRun?.mode === mode ? savedRun : null

  useSaveCasualRuns(controller, store, boardRef)

  // Picking another mode ends the run in progress (a ranked one is still submitted).
  const syncMode = useEffectEvent((nextMode: GameMode, nextCustom: CustomSettings | null) => {
    const current = controller.getMode()
    if (current.mode === nextMode && current.custom === nextCustom) return
    if (controller.isRunActive()) flow.endRun()
    controller.setMode(nextMode, nextCustom)
    flow.reset()
  })
  useEffect(() => syncMode(mode, custom), [mode, custom])

  useEffect(() => {
    controller.setVisible(isActive)
  }, [controller, isActive])

  useEffect(() => {
    if (isDialogOpen) controller.pause()
  }, [controller, isDialogOpen])

  // Development only: lets automated play-testing scripts drive the game.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const target = window as Window & { __trapTheOrb?: GameController }
    target.__trapTheOrb = controller
    return () => {
      delete target.__trapTheOrb
    }
  }, [controller])

  useGameShortcuts({
    controller,
    isEnabled: isActive && !isDialogOpen,
    onToggleSound: () => store.setSoundEnabled(!settings.soundEnabled),
  })

  const primaryAction = primaryActionFor(hud, flow.result !== null, matchingSave !== null)
  const runPrimaryAction = (): void => {
    switch (primaryAction) {
      case 'pause':
        controller.pause()
        break
      case 'resume':
        controller.resume()
        break
      case 'next':
        controller.nextLevel()
        break
      case 'continue':
        if (matchingSave) flow.continueSaved(matchingSave)
        break
      case 'play':
      case 'playAgain':
        flow.start()
        break
    }
  }
  // The flag button asks first: it pauses, and the pause card offers "End run".
  const endRun = (): void => (hud.status === 'playing' ? controller.pause() : flow.endRun())
  const focusBoard = (): void => boardRef.current?.focus({ preventScroll: true })

  /** From a finished run's result back to the start screen. */
  const backToReady = (): void => {
    if (controller.isRunActive()) return
    if (hud.inRun) controller.abandonRun()
    flow.reset()
  }
  /** Leaves a practice run for the start screen; its save lets it be continued later. */
  const leaveRun = (): void => {
    if (isRankedMode(controller.getMode().mode)) return
    controller.abandonRun()
    flow.reset()
  }

  return (
    <section id="play" aria-labelledby="game-title" hidden={!isActive} className="scroll-mt-4">
      <GameHeader
        hud={hud}
        controller={controller}
        primaryAction={primaryAction}
        isBusy={flow.isStarting}
        onPrimaryAction={runPrimaryAction}
        onEndRun={endRun}
        onAfterAction={focusBoard}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <GameBoard
            controller={controller}
            hud={hud}
            boardRef={boardRef}
            onPrimaryAction={runPrimaryAction}
            overlay={
              <BoardOverlay
                hud={hud}
                controller={controller}
                flow={flow}
                account={{ status: accountStatus, nickname: account.nickname, hasPlayedDailyToday }}
                savedRun={matchingSave}
                onBackToReady={backToReady}
                onLeaveRun={leaveRun}
                onOpenDialog={onOpenDialog}
                onAfterAction={focusBoard}
              />
            }
          />
          <ControlsHint />
        </div>

        <div className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <LeaderboardCard mode={hud.mode} />
          <TipCard level={hud.level} />
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
          <AppDownloadStrip />
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {hud.announcement}
      </p>
    </section>
  )
}
