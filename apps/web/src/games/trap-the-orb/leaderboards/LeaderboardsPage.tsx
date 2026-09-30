import { boardById, periodsFor, type BoardId, type BoardPeriod } from '@games/contract'
import type { ReactNode } from 'react'
import { navigate, useLocation } from '@/app/router'
import { AdSlot } from '@/components/ads/AdSlot'
import { useAccount } from '@/features/account/queries'
import { gamePaths } from '../game'
import { BOARD_CONTENT, PERIOD_LABELS, RECORD_BOARDS, SCORE_BOARDS } from './boardContent'
import { DeviceScores } from './DeviceScores'
import { LeaderboardTable } from './LeaderboardTable'
import {
  leaderboardSearch,
  parseLeaderboardParams,
  yesterdayKey,
  type LeaderboardParams,
  type LeaderboardTab,
} from './leaderboardParams'

const TABS: ReadonlyArray<{ readonly id: LeaderboardTab; readonly label: string }> = [
  { id: 'scores', label: 'Scores' },
  { id: 'records', label: 'Records' },
  { id: 'device', label: 'This device' },
]

type ChipProps = {
  readonly isActive: boolean
  readonly onClick: () => void
  readonly children: ReactNode
  readonly tone?: 'dark' | 'light'
}

function Chip({ isActive, onClick, children, tone = 'dark' }: ChipProps) {
  const active = tone === 'dark' ? 'bg-action text-on-action' : 'bg-teal-600 text-white'
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={`h-8 shrink-0 rounded-full px-3 text-[0.8rem] font-semibold whitespace-nowrap transition ${
        isActive ? active : 'bg-sunken text-ink-soft hover:bg-teal-100 hover:text-teal-800'
      }`}
    >
      {children}
    </button>
  )
}

function periodOptions(board: BoardId, now: Date): ReadonlyArray<{ period: BoardPeriod; date?: string; label: string }> {
  if (boardById(board).mode === 'daily') {
    return [
      { period: 'day', label: 'Today' },
      { period: 'day', date: yesterdayKey(now), label: 'Yesterday' },
    ]
  }
  return periodsFor(boardById(board)).map((period) => ({ period, label: PERIOD_LABELS[period] }))
}

/** Global leaderboards: one table per ranked mode, record tables, and this device's guest scores. */
export function LeaderboardsPage() {
  const location = useLocation()
  const params = parseLeaderboardParams(location.split('?')[1] ?? '')
  const account = useAccount()
  const now = new Date()

  const update = (next: LeaderboardParams): void =>
    navigate(gamePaths.leaderboards(leaderboardSearch(next)), { replace: true })
  const selectTab = (tab: LeaderboardTab): void => {
    if (tab === 'device') return update({ ...params, tab })
    const board = tab === 'records' ? RECORD_BOARDS[0] : SCORE_BOARDS[0]
    if (board) update(parseLeaderboardParams(leaderboardSearch({ tab, board, period: 'all', date: undefined })))
  }
  const selectBoard = (board: BoardId): void =>
    update(parseLeaderboardParams(leaderboardSearch({ tab: params.tab, board, period: params.period, date: undefined })))
  const boards = params.tab === 'records' ? RECORD_BOARDS : SCORE_BOARDS

  return (
    <div className="mx-auto max-w-[1120px] lg:flex lg:gap-5">
      <section aria-labelledby="leaderboards-title" className="min-w-0 flex-1">
        <h1 id="leaderboards-title" className="text-[1.6rem] font-extrabold tracking-[-0.03em] sm:text-[1.9rem]">
          Leaderboards
        </h1>
        <p className="mt-1 max-w-[62ch] text-[0.9rem] text-muted">
          Only ranked modes count. Every run is replayed on our server before it reaches a table, so what you see here
          was really played.
        </p>

        <div role="tablist" aria-label="Leaderboard type" className="mt-5 flex gap-1 border-b border-divider">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={params.tab === tab.id}
              onClick={() => selectTab(tab.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-[0.9rem] font-semibold transition ${
                params.tab === tab.id
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="card mt-4 overflow-hidden">
          {params.tab === 'device' ? (
            <DeviceScores isSignedIn={account.status === 'signedIn'} />
          ) : (
            <>
              <div className="space-y-3 border-b border-divider px-4 py-3.5">
                <div role="group" aria-label="Board" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                  {boards.map((board) => (
                    <Chip key={board} isActive={params.board === board} onClick={() => selectBoard(board)}>
                      {BOARD_CONTENT[board].name}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.82rem] text-muted">{BOARD_CONTENT[params.board].description}</p>
                  <div role="group" aria-label="Period" className="flex gap-1.5">
                    {periodOptions(params.board, now).map((option) => (
                      <Chip
                        key={option.label}
                        tone="light"
                        isActive={params.period === option.period && params.date === option.date}
                        onClick={() => update({ ...params, period: option.period, date: option.date })}
                      >
                        {option.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
              <LeaderboardTable board={params.board} period={params.period} date={params.date} />
            </>
          )}
        </div>
      </section>

      {/* Collapses when no ad is configured, so the tables use the full width. */}
      <div className="mt-5 empty:hidden lg:mt-0 lg:w-[300px] lg:shrink-0 lg:pt-[4.5rem]">
        <AdSlot />
      </div>
    </div>
  )
}
