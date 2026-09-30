import { Link } from '@/app/Link'
import { paths } from '@/app/site'
import { ArrowRightIcon, TrophyIcon } from '@/components/icons'
import { useLeaderboard } from '@/features/account/queries'
import { formatNumber } from '@/lib/format'
import { gameById } from '@/sites/games'
import { leaderboardsHref } from '@/games/trap-the-orb/leaderboards/boardContent'

const TOP_ROWS = 5
const PODIUM = ['bg-gold text-[#0f2548]', 'bg-silver text-[#0f2548]', 'bg-bronze text-[#0f2548]'] as const

/** This week's best Classic scores in Trap The Orb, straight from the leaderboards. */
export function TopPlayers() {
  const game = gameById('trap-the-orb')
  const query = useLeaderboard('score.classic', 'week')
  const entries = query.data?.entries.slice(0, TOP_ROWS) ?? []

  return (
    <section aria-labelledby="top-players-title" className="rounded-[18px] bg-sunken ring-1 ring-line">
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className="grid size-9 place-items-center rounded-[10px] bg-gold/15 text-reward">
          <TrophyIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="top-players-title" className="text-[1.05rem] font-extrabold tracking-[-0.01em] text-ink">
            This week’s top players
          </h2>
          <p className="text-[0.78rem] text-muted">{game.name} · Classic · verified runs only</p>
        </div>
        <Link
          href={leaderboardsHref('score.classic')}
          className="group inline-flex shrink-0 items-center gap-1 rounded text-[0.82rem] font-semibold text-accent hover:text-teal-800"
        >
          All boards
          <ArrowRightIcon className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </header>

      {query.isPending && (
        <ul aria-label="Loading top players" className="space-y-2 px-5 pb-5">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="h-9 animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" />
          ))}
        </ul>
      )}
      {query.isError && (
        <div className="px-5 pb-5 text-[0.84rem] text-muted" role="status">
          <p>The leaderboard can’t be loaded right now. You can still play as a guest.</p>
          <button type="button" onClick={() => void query.refetch()} className="mt-2 min-h-9 rounded font-semibold text-accent underline-offset-4 hover:underline">Try again</button>
        </div>
      )}
      {query.data && entries.length === 0 && (
        <p className="px-5 pb-5 text-[0.84rem] text-muted">
          No verified scores yet this week.{' '}
          <Link href={paths.game(game.id)} className="font-semibold text-accent hover:text-teal-800">
            Be the first.
          </Link>
        </p>
      )}
      {entries.length > 0 && (
        <ol className="px-2 pb-3">
          {entries.map((entry) => (
            <li
              key={entry.rank}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-[0.9rem] text-muted transition hover:bg-sunken"
            >
              <span
                className={`tabular grid h-6 min-w-6 place-items-center rounded-full px-1 text-[0.72rem] font-bold ${
                  PODIUM[entry.rank - 1] ?? 'bg-sunken text-muted'
                }`}
              >
                {entry.rank}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{entry.nickname}</span>
              {entry.level !== null && <span className="text-[0.76rem] text-muted">Level {entry.level}</span>}
              <span className="tabular font-bold text-ink">{formatNumber(entry.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
