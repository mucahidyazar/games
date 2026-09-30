import { RANKED_MODES, type GameMode } from '@games/trap-the-orb-engine'
import { useState } from 'react'
import { modeInfo } from '@/games/trap-the-orb/modes/modeContent'
import { usePlayerData } from '@/games/trap-the-orb/state/playerDataContext'
import { highScoresFor } from '@/games/trap-the-orb/storage/scores'
import { formatNumber } from '@/lib/format'
import { RankBadge } from './RankBadge'
import { timeAgo } from './timeAgo'

type DeviceScoresProps = {
  readonly isSignedIn: boolean
}

/** Guest scores saved in this browser, one table per ranked mode. */
export function DeviceScores({ isSignedIn }: DeviceScoresProps) {
  const { store, highScores, canPersist } = usePlayerData()
  const [mode, setMode] = useState<GameMode>('classic')
  const [isConfirmingClear, setIsConfirmingClear] = useState(false)
  const scores = highScoresFor(highScores, mode)

  return (
    <div>
      <div role="group" aria-label="Mode" className="flex flex-wrap gap-1.5 border-b border-divider px-4 py-3">
        {RANKED_MODES.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
            className={`h-8 rounded-full px-3 text-[0.8rem] font-semibold transition ${
              mode === id ? 'bg-action text-on-action' : 'bg-sunken text-ink-soft hover:bg-teal-100 hover:text-teal-800'
            }`}
          >
            {modeInfo(id).name}
          </button>
        ))}
      </div>

      {scores.length === 0 ? (
        <p className="px-4 py-10 text-center text-[0.9rem] text-muted">
          No {modeInfo(mode).name} scores on this device yet.
        </p>
      ) : (
        <table className="w-full text-[0.86rem]">
          <thead className="text-left text-[0.7rem] tracking-[0.08em] text-subtle uppercase">
            <tr className="border-b border-divider">
              <th scope="col" className="w-14 py-2.5 pl-4 font-semibold">
                #
              </th>
              <th scope="col" className="py-2.5 font-semibold">
                Name
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-semibold">
                Score
              </th>
              <th scope="col" className="hidden py-2.5 pr-4 text-right font-semibold sm:table-cell">
                Level
              </th>
              <th scope="col" className="hidden py-2.5 pr-4 text-right font-semibold md:table-cell">
                When
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {scores.map((entry, index) => (
              <tr key={entry.id}>
                <td className="py-2.5 pl-4">
                  <RankBadge rank={index + 1} />
                </td>
                <td className="max-w-[14ch] truncate py-2.5 font-semibold text-ink">{entry.name}</td>
                <td className="tabular py-2.5 pr-4 text-right font-bold text-ink">{formatNumber(entry.score)}</td>
                <td className="tabular hidden py-2.5 pr-4 text-right text-muted sm:table-cell">{entry.level}</td>
                <td className="hidden py-2.5 pr-4 text-right text-muted md:table-cell">
                  {timeAgo(new Date(entry.createdAt).toISOString())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3.5 text-[0.78rem] text-muted">
        <p className="max-w-[52ch]">
          {canPersist
            ? 'Guest scores stay in this browser only.'
            : 'Your browser is blocking storage, so guest scores last until you close this tab.'}{' '}
          {!isSignedIn && 'Sign in to put your runs on the global leaderboards.'}
        </p>
        {highScores.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (!isConfirmingClear) {
                setIsConfirmingClear(true)
                return
              }
              store.clearScores()
              setIsConfirmingClear(false)
            }}
            onBlur={() => setIsConfirmingClear(false)}
            className={`rounded-(--radius-control) border px-3.5 py-2 font-semibold transition ${
              isConfirmingClear
                ? 'border-coral-600 bg-coral-600 text-white'
                : 'border-line-strong text-ink-soft hover:border-coral-400 hover:text-coral-600'
            }`}
          >
            {isConfirmingClear ? 'Click again to clear' : 'Clear device scores'}
          </button>
        )}
      </footer>
    </div>
  )
}
