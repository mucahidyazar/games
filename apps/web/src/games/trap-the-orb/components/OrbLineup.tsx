import { SPEED_TIER_INFO } from '../modes/modeContent'

type OrbLineupProps = {
  readonly tiers: readonly number[]
  readonly size?: 'sm' | 'md'
}

/** Coloured dots for the orbs of a level; colour shows speed (calm → blazing). */
export function OrbLineup({ tiers, size = 'md' }: OrbLineupProps) {
  const counts = SPEED_TIER_INFO.map((info, tier) => ({ ...info, count: tiers.filter((t) => t === tier).length }))
  const label = counts
    .filter(({ count }) => count > 0)
    .map(({ name, count }) => `${count} ${name.toLowerCase()}`)
    .join(', ')
  const dot = size === 'sm' ? 'size-2.5' : 'size-3.5'

  return (
    <span role="img" aria-label={`Orbs: ${label}`} className="inline-flex flex-wrap items-center gap-1">
      {tiers.map((tier, index) => {
        const color = SPEED_TIER_INFO[tier]?.color ?? SPEED_TIER_INFO[0]?.color
        return (
          <span
            key={index}
            aria-hidden="true"
            className={`${dot} rounded-full shadow-[inset_-1px_-2px_3px_rgb(0_0_0/0.2)]`}
            style={{ background: `radial-gradient(circle at 35% 30%, #ffffffcc 0 18%, ${color} 45%)` }}
          />
        )
      })}
    </span>
  )
}

/** Legend explaining the orb colours. */
export function SpeedLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[0.72rem] text-muted">
      {SPEED_TIER_INFO.map((info, tier) => (
        <li key={info.name} className="inline-flex items-center gap-1.5">
          <OrbLineup tiers={[tier]} size="sm" />
          {info.name}
        </li>
      ))}
    </ul>
  )
}
