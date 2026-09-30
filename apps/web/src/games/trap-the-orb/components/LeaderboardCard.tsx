import type { LeaderboardResponse } from '@games/contract'
import type { GameMode } from '@games/trap-the-orb-engine'
import { Link } from '@/app/Link'
import { ArrowRightIcon, TrophyIcon } from '@/components/icons'
import { useLeaderboard } from '@/features/account/queries'
import {
  BOARD_CONTENT,
  defaultPeriodFor,
  formatBoardValue,
  leaderboardsHref,
  PERIOD_LABELS,
  scoreBoardFor,
} from '@/games/trap-the-orb/leaderboards/boardContent'
import { RankBadge } from '@/games/trap-the-orb/leaderboards/RankBadge'
import { gamePaths } from '../game'

type LeaderboardCardProps = {
  readonly mode: GameMode
}

/** Rows shown in the sidebar; the full table lives on the leaderboards page. */
const TOP_ROWS = 5

function SeeAllLink({ href }: { readonly href: string }) {
  return (
    <Link
      href={href}
      className="group ml-auto inline-flex shrink-0 items-center gap-1 rounded-md text-[0.8rem] font-semibold whitespace-nowrap text-teal-700"
    >
      See all
      <ArrowRightIcon className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  )
}

function Message({ children }: { readonly children: string }) {
  return <p className="rounded-[8px] bg-page px-3 py-3 text-center text-[0.8rem] leading-snug text-muted">{children}</p>
}

function Rows({ data }: { readonly data: LeaderboardResponse }) {
  const top = data.entries.slice(0, TOP_ROWS)
  const me = data.me
  const isMeListed = me !== null && top.some((entry) => entry.rank === me.rank)

  if (top.length === 0) return <Message>No scores yet — be the first on the board.</Message>
  return (
    <ol className="divide-y divide-divider">
      {top.map((entry) => {
        const isPlayer = entry.rank === me?.rank
        return (
          <li
            key={entry.rank}
            aria-current={isPlayer ? 'true' : undefined}
            className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-[8px] px-2 py-[7px] ${
              isPlayer ? 'bg-teal-100 font-bold text-teal-800' : 'text-ink'
            }`}
          >
            <RankBadge rank={entry.rank} isPlayer={isPlayer} />
            <span className={`truncate text-[0.86rem] ${isPlayer ? '' : 'font-medium'}`}>{entry.nickname}</span>
            <span className={`tabular text-right text-[0.82rem] ${isPlayer ? '' : 'text-muted'}`}>
              {formatBoardValue(data.board, entry.value)}
            </span>
          </li>
        )
      })}
      {me && !isMeListed && (
        <li
          aria-current="true"
          className="mt-1 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-[8px] bg-teal-100 px-2 py-[7px] font-bold text-teal-800"
        >
          <RankBadge rank={me.rank} isPlayer />
          <span className="truncate text-[0.86rem]">You</span>
          <span className="tabular text-right text-[0.82rem]">{formatBoardValue(data.board, me.value)}</span>
        </li>
      )}
    </ol>
  )
}

/** Top of the selected mode's leaderboard, next to the game. */
export function LeaderboardCard({ mode }: LeaderboardCardProps) {
  const board = scoreBoardFor(mode)
  const period = board ? defaultPeriodFor(board) : 'all'
  const query = useLeaderboard(board ?? 'score.classic', period, undefined, board !== null)

  return (
    <section aria-labelledby="leaderboard-title" className="card px-3 pt-3.5 pb-3">
      <header className="mb-2 flex items-center gap-2 px-2">
        <TrophyIcon className="size-[18px] shrink-0 text-teal-500" />
        <div className="min-w-0">
          <h2 id="leaderboard-title" className="text-[0.95rem] leading-tight font-bold tracking-[-0.01em]">
            Leaderboard
          </h2>
          {board && (
            <p className="truncate text-[0.7rem] font-semibold text-teal-700">
              {BOARD_CONTENT[board].name} · {PERIOD_LABELS[period]}
            </p>
          )}
        </div>
        <SeeAllLink href={board ? leaderboardsHref(board, period) : gamePaths.leaderboards()} />
      </header>
      {!board && <Message>Zen and Custom are for practice, so they have no leaderboard.</Message>}
      {board && query.isPending && (
        <ul aria-label="Loading leaderboard" className="space-y-2 px-2 py-1">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="h-6 animate-pulse rounded-md bg-sunken motion-reduce:animate-none" />
          ))}
        </ul>
      )}
      {board && query.isError && <Message>The leaderboard can’t be loaded right now.</Message>}
      {board && query.data && <Rows data={query.data} />}
    </section>
  )
}
