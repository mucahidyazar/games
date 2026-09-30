import type { ReactNode } from 'react'
import { ArrowRightIcon, FlagIcon, PauseIcon, PlayIcon, RestartIcon, WallDirectionIcon } from '@/components/icons'
import type { GameController, HudSnapshot } from '../controller/GameController'
import type { PrimaryAction } from '../run/primaryAction'
import { HudBar } from './HudBar'
import { OrbLineup } from './OrbLineup'

type GameHeaderProps = {
  readonly hud: HudSnapshot
  readonly controller: GameController
  readonly primaryAction: PrimaryAction
  readonly isBusy: boolean
  readonly onPrimaryAction: () => void
  /** Ends a ranked run early (its score still counts). */
  readonly onEndRun: () => void
  readonly onAfterAction: () => void
}

const ICON_CLASS = 'size-4'

const PRIMARY: Readonly<Record<PrimaryAction, { readonly label: string; readonly icon: ReactNode }>> = {
  play: { label: 'Play', icon: <PlayIcon className={ICON_CLASS} /> },
  continue: { label: 'Continue', icon: <PlayIcon className={ICON_CLASS} /> },
  pause: { label: 'Pause', icon: <PauseIcon className={ICON_CLASS} /> },
  resume: { label: 'Resume', icon: <PlayIcon className={ICON_CLASS} /> },
  next: { label: 'Next', icon: <ArrowRightIcon className={ICON_CLASS} /> },
  playAgain: { label: 'Again', icon: <PlayIcon className={ICON_CLASS} /> },
}

const SQUARE_BUTTON =
  'card grid size-10 shrink-0 place-items-center rounded-(--radius-control) text-icon transition duration-200 hover:text-teal-700 enabled:hover:-translate-y-px enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45'

export function GameHeader({
  hud,
  controller,
  primaryAction,
  isBusy,
  onPrimaryAction,
  onEndRun,
  onAfterAction,
}: GameHeaderProps) {
  const primary = PRIMARY[primaryAction]
  const isRunActive = hud.inRun && (hud.status === 'playing' || hud.status === 'paused')
  const isVertical = hud.orientation === 'vertical'
  const run = (command: () => void) => () => {
    command()
    onAfterAction()
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-x-5">
      <div className="min-w-0">
        <h2 id="game-title" className="text-[1.3rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[1.5rem]">
          Level {hud.level}
        </h2>
        <p className="mt-1 flex min-w-0 items-center gap-2 text-[0.78rem] text-muted">
          <OrbLineup tiers={hud.orbTiers} size="sm" />
          <span className="truncate">
            {hud.orbCount} {hud.orbCount === 1 ? 'orb' : 'orbs'} · clear at {hud.targetPercent}%
          </span>
        </p>
      </div>

      <div className="col-span-2 row-start-2 min-w-0 xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:ml-auto xl:w-full xl:max-w-[720px]">
        <HudBar hud={hud} />
      </div>

      <div className="col-start-2 row-start-1 flex items-center gap-2 xl:col-start-3">
        <button
          type="button"
          onClick={run(() => controller.toggleOrientation())}
          aria-label={`Wall direction: ${hud.orientation}. Switch to ${isVertical ? 'horizontal' : 'vertical'}`}
          title={`Walls grow ${isVertical ? 'up and down' : 'left and right'} — right-click or Space to switch`}
          className={SQUARE_BUTTON}
        >
          <WallDirectionIcon vertical={isVertical} className="size-5 text-teal-700" />
        </button>
        <button
          type="button"
          disabled={hud.status === 'loading' || isBusy}
          aria-busy={isBusy || undefined}
          onClick={run(onPrimaryAction)}
          className="inline-flex h-10 min-w-[84px] items-center justify-center gap-2 rounded-(--radius-control) bg-coral-600 px-3 text-[0.9rem] font-bold text-white shadow-coral transition duration-200 ease-(--ease-out-expo) hover:-translate-y-px hover:bg-coral-700 sm:min-w-[96px] sm:px-4 active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
        >
          {primary.icon}
          {primary.label}
        </button>
        {hud.rankedMode ? (
          <button
            type="button"
            disabled={!isRunActive}
            onClick={run(onEndRun)}
            aria-label="End run"
            title="End run — keeps the score you have so far"
            className={SQUARE_BUTTON}
          >
            <FlagIcon className="size-[18px]" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!isRunActive}
            onClick={run(() => controller.restartLevel())}
            aria-label="Restart level"
            title="Restart level"
            className={SQUARE_BUTTON}
          >
            <RestartIcon className="size-[18px]" />
          </button>
        )}
      </div>
    </div>
  )
}
