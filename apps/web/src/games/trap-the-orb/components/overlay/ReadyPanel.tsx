import { RANKED_MODES, type GameMode } from '@games/trap-the-orb-engine'
import { useId, useState, type ReactNode } from 'react'
import { Link } from '@/app/Link'
import { ChevronDownIcon, PlayIcon } from '@/components/icons'
import type { ApiError } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import { gamePaths } from '../../game'
import { CustomSettingsForm } from '../../modes/CustomSettingsForm'
import { MODES, modeInfo, ruleChips, type ModeInfo } from '../../modes/modeContent'
import { usePlayerData } from '../../state/playerDataContext'
import { ActionButton, Panel, Spinner, TextButton } from './Panel'
import type { OverlayProps } from './types'

const GROUPS: ReadonlyArray<{ readonly label: string; readonly modes: readonly ModeInfo[] }> = [
  { label: 'Ranked', modes: MODES.filter((mode) => RANKED_MODES.includes(mode.id)) },
  { label: 'Practice', modes: MODES.filter((mode) => !RANKED_MODES.includes(mode.id)) },
]

/**
 * Every mode, grouped. Picking one only shows it next to the list (and in the
 * orbs behind the panel); nothing starts until Play. The URL follows the
 * choice without adding history entries. On narrow boards the list folds
 * behind a "Change" button so the details and Play stay in view.
 */
function ModeList({ current }: { readonly current: GameMode }) {
  const [isOpen, setIsOpen] = useState(false)
  const listId = useId()
  const mode = modeInfo(current)

  return (
    <nav
      aria-label="Game modes"
      className="min-h-0 overflow-y-auto border-b border-divider p-2.5 @min-[560px]:border-r @min-[560px]:border-b-0"
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={`Change mode (now ${mode.name})`}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-2.5 rounded-[12px] bg-sunken px-2.5 py-2 text-left transition hover:bg-teal-50 @min-[560px]:hidden"
      >
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-teal-600 text-[0.85rem] text-white"
        >
          {mode.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.6rem] font-bold tracking-[0.14em] text-subtle uppercase">Mode</span>
          <span className="block truncate text-[0.92rem] leading-tight font-bold text-ink">{mode.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[0.8rem] font-semibold text-teal-700">
          Change
          <ChevronDownIcon className={`size-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div id={listId} className={`${isOpen ? 'mt-2.5' : 'hidden'} @min-[560px]:mt-0 @min-[560px]:block`}>
        {GROUPS.map((group) => (
          <div key={group.label} className="[&+&]:mt-2.5">
            <p aria-hidden="true" className="px-2 pb-1 text-[0.6rem] font-bold tracking-[0.14em] text-subtle uppercase">
              {group.label}
            </p>
            <ul aria-label={`${group.label} modes`} className="grid grid-cols-2 gap-1 @min-[560px]:grid-cols-1">
              {group.modes.map((item) => {
                const isCurrent = item.id === current
                return (
                  <li key={item.id}>
                    <Link
                      href={gamePaths.play(item.id)}
                      replace
                      aria-current={isCurrent ? 'true' : undefined}
                      onClick={() => setIsOpen(false)}
                      className={`flex h-8 items-center gap-2 rounded-[10px] px-2 text-[0.82rem] font-semibold transition duration-200 ${
                        isCurrent
                          ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                          : 'text-ink-soft hover:bg-sunken hover:text-ink active:scale-[0.98]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`grid size-6 shrink-0 place-items-center rounded-[7px] text-[0.78rem] transition ${
                          isCurrent ? 'bg-teal-600 text-white' : 'bg-sunken text-teal-700'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.short}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

function startErrorText(error: ApiError): string {
  if (error.code === 'network') return 'the server can’t be reached'
  if (error.status === 401) return 'please sign in again'
  if (error.status === 429) return 'too many attempts, wait a moment'
  return 'something went wrong'
}

/** One line under the details about ranking: who is playing and whether this run counts. */
function RankingNote({ hud, account, flow, onOpenDialog }: OverlayProps): ReactNode {
  if (flow.startError) {
    return (
      <span className="text-danger">
        Couldn’t start a ranked run: {startErrorText(flow.startError)}.{' '}
        <TextButton onClick={() => flow.start()}>Try again</TextButton> or{' '}
        <TextButton onClick={() => flow.startOffline()}>play unranked</TextButton>.
      </span>
    )
  }
  if (!hud.rankedMode) return 'Practice mode — never ranked.'

  switch (account.status) {
    case 'loading':
      return 'Checking your account…'
    case 'anonymous':
      return (
        <>
          Playing as a guest. <TextButton onClick={() => onOpenDialog('account')}>Sign in</TextButton> to rank your
          scores.
        </>
      )
    case 'signedIn':
      if (!account.nickname) {
        return (
          <>
            <TextButton onClick={() => onOpenDialog('account')}>Pick a nickname</TextButton> to get on the leaderboards.
          </>
        )
      }
      if (hud.mode === 'daily' && account.hasPlayedDailyToday) {
        return 'You’ve had today’s ranked attempt — replays are practice.'
      }
      return (
        <>
          Ranked as <strong className="font-semibold text-ink">{account.nickname}</strong> — this run counts.
        </>
      )
  }
}

function RuleChips({ chips }: { readonly chips: readonly string[] }) {
  return (
    <ul aria-label="Rules" className="mt-3 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <li
          key={chip}
          className="rounded-full bg-teal-50 px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap text-teal-800"
        >
          {chip}
        </li>
      ))}
    </ul>
  )
}

/**
 * The start screen: a menu of every mode next to the chosen one's details (or,
 * for Custom, its setup). The panel never outgrows the board: its body
 * scrolls and the footer with Play stays in view.
 */
export function ReadyPanel(props: OverlayProps) {
  const { hud, controller, flow, savedRun, onOpenDialog, onAfterAction } = props
  const [isEditingSetup, setIsEditingSetup] = useState(false)
  const titleId = useId()
  const { store, settings } = usePlayerData()
  const mode = modeInfo(hud.mode)
  const isCustom = hud.mode === 'custom'
  const isSetup = isCustom && (!savedRun || isEditingSetup)
  const continuing = isSetup ? null : savedRun
  const run = (command: () => void) => () => {
    command()
    onAfterAction()
  }

  const title = continuing ? `Continue from level ${continuing.level}` : isSetup ? 'Set up your game' : mode.tagline

  return (
    <Panel labelledBy={titleId} size="menu">
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] @min-[560px]:grid-cols-[188px_minmax(0,1fr)] @min-[560px]:grid-rows-[minmax(0,1fr)]">
        <ModeList current={hud.mode} />

        <div className="@container flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 id={titleId} className="text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em]">
                {title}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.08em] uppercase ${
                  hud.rankedMode ? 'bg-coral-400/15 text-danger' : 'bg-sunken text-muted'
                }`}
              >
                {hud.rankedMode ? 'Ranked' : 'Practice'}
              </span>
              <span className="ml-auto">
                <TextButton onClick={() => onOpenDialog('how-to-play')}>How to play</TextButton>
              </span>
            </div>

            {continuing && (
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">
                {mode.name} ·{' '}
                <span className="tabular font-semibold text-ink">{formatNumber(continuing.score)}</span> points so far.
                Pick up where you left off, or start a fresh run.
                {isCustom && (
                  <>
                    {' '}
                    <TextButton onClick={() => setIsEditingSetup(true)}>Change setup</TextButton>
                  </>
                )}
              </p>
            )}
            {isSetup && (
              <div className="mt-3">
                <CustomSettingsForm value={settings.custom} onChange={(custom) => store.setCustomSettings(custom)} />
              </div>
            )}
            {!continuing && !isSetup && (
              <>
                <p className="mt-1.5 max-w-[44ch] text-[0.85rem] leading-relaxed text-muted">{mode.description}</p>
                <RuleChips chips={ruleChips(hud.mode, controller.getMode().custom)} />
              </>
            )}
          </div>

          <footer className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-divider px-4 py-3 sm:px-5">
            <p className="min-w-0 flex-1 basis-[12rem] text-[0.76rem] leading-snug text-muted">
              <RankingNote {...props} />
              {/* Mouse players see the controls under the board; touch players only here. */}
              <span className="hidden text-subtle pointer-coarse:block">Tap to build · Swipe to turn</span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {continuing ? (
                <>
                  <ActionButton variant="secondary" onClick={run(() => flow.start())}>
                    New game
                  </ActionButton>
                  <ActionButton onClick={run(() => flow.continueSaved(continuing))}>
                    <PlayIcon className="size-4" /> Continue
                  </ActionButton>
                </>
              ) : (
                <ActionButton isBusy={flow.isStarting} onClick={run(() => flow.start())}>
                  {flow.isStarting ? <Spinner /> : <PlayIcon className="size-4" />}
                  {flow.isStarting ? 'Starting…' : `Play ${mode.short}`}
                </ActionButton>
              )}
            </div>
          </footer>
        </div>
      </div>
    </Panel>
  )
}
