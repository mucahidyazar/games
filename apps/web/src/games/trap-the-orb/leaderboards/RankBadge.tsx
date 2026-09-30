const PODIUM_BADGES = ['bg-gold text-ink', 'bg-silver text-ink', 'bg-bronze text-ink'] as const

/** Rank number; the top three get podium colours, the player's own row a teal one. */
export function RankBadge({ rank, isPlayer = false }: { readonly rank: number; readonly isPlayer?: boolean }) {
  const podium = PODIUM_BADGES[rank - 1]
  const base = 'grid h-6 min-w-6 place-items-center rounded-full px-1 text-[0.74rem] font-bold tabular'
  if (podium) return <span className={`${base} ${podium}`}>{rank}</span>
  if (isPlayer) return <span className={`${base} bg-teal-200 text-teal-800`}>{rank}</span>
  return <span className={`${base} text-ink`}>{rank}</span>
}
