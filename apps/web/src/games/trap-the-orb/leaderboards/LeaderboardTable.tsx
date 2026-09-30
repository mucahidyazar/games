import { boardById, type BoardId, type BoardPeriod } from '@games/contract'
import type { ReactNode } from 'react'
import { useLeaderboard } from '@/features/account/queries'
import { BOARD_CONTENT, formatBoardValue } from './boardContent'
import { RankBadge } from './RankBadge'
import { timeAgo } from './timeAgo'

type LeaderboardTableProps = {
  readonly board: BoardId
  readonly period: BoardPeriod
  readonly date?: string
}

function Message({ children, action }: { readonly children: string; readonly action?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[0.9rem] text-muted">{children}</p>
      {action}
    </div>
  )
}

/** One leaderboard table, loaded from the server. */
export function LeaderboardTable({ board, period, date }: LeaderboardTableProps) {
  const query = useLeaderboard(board, period, date)
  const content = BOARD_CONTENT[board]
  const hasLevel = boardById(board).kind === 'score'

  if (query.isPending) {
    return (
      <ul aria-label="Loading leaderboard" className="space-y-2.5 p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="h-8 animate-pulse rounded-md bg-sunken motion-reduce:animate-none" />
        ))}
      </ul>
    )
  }
  if (query.isError) {
    return (
      <Message
        action={
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-3 text-[0.85rem] font-semibold text-teal-700 underline-offset-4 hover:underline"
          >
            Try again
          </button>
        }
      >
        The leaderboard can’t be loaded right now.
      </Message>
    )
  }

  const { entries, me } = query.data
  if (entries.length === 0) return <Message>No results yet — play a ranked run to claim the top spot.</Message>
  const isMeListed = me !== null && entries.some((entry) => entry.rank === me.rank)

  return (
    <table className="w-full text-[0.86rem]">
      <thead className="text-left text-[0.7rem] tracking-[0.08em] text-subtle uppercase">
        <tr className="border-b border-divider">
          <th scope="col" className="w-14 py-2.5 pl-4 font-semibold">
            #
          </th>
          <th scope="col" className="py-2.5 font-semibold">
            Player
          </th>
          <th scope="col" className="py-2.5 pr-4 text-right font-semibold">
            {content.valueLabel}
          </th>
          {hasLevel && (
            <th scope="col" className="hidden py-2.5 pr-4 text-right font-semibold sm:table-cell">
              Level
            </th>
          )}
          <th scope="col" className="hidden py-2.5 pr-4 text-right font-semibold md:table-cell">
            When
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-divider">
        {entries.map((entry) => {
          const isPlayer = entry.rank === me?.rank
          return (
            <tr
              key={entry.rank}
              aria-current={isPlayer ? 'true' : undefined}
              className={isPlayer ? 'bg-teal-50' : undefined}
            >
              <td className="py-2.5 pl-4">
                <RankBadge rank={entry.rank} isPlayer={isPlayer} />
              </td>
              <td
                className={`max-w-[16ch] truncate py-2.5 ${isPlayer ? 'font-bold text-teal-800' : 'font-semibold text-ink'}`}
              >
                {entry.nickname}
              </td>
              <td className="tabular py-2.5 pr-4 text-right font-bold text-ink">
                {formatBoardValue(board, entry.value)}
              </td>
              {hasLevel && (
                <td className="tabular hidden py-2.5 pr-4 text-right text-muted sm:table-cell">{entry.level ?? '—'}</td>
              )}
              <td className="hidden py-2.5 pr-4 text-right text-muted md:table-cell">{timeAgo(entry.achievedAt)}</td>
            </tr>
          )
        })}
      </tbody>
      {me && !isMeListed && (
        <tfoot>
          <tr aria-current="true" className="border-t-2 border-teal-200 bg-teal-50">
            <td className="py-2.5 pl-4">
              <RankBadge rank={me.rank} isPlayer />
            </td>
            <td className="py-2.5 font-bold text-teal-800">You</td>
            <td className="tabular py-2.5 pr-4 text-right font-bold text-ink">{formatBoardValue(board, me.value)}</td>
            {hasLevel && <td className="hidden sm:table-cell" />}
            <td className="hidden md:table-cell" />
          </tr>
        </tfoot>
      )}
    </table>
  )
}
