import type { BadgeId, BadgeTier } from '@games/trap-the-orb-engine'
import { badgeContent, TIER_COLORS, TIER_NAMES } from './badgeContent'

type BadgeMedalProps = {
  readonly id: BadgeId
  /** 0 = not earned yet. */
  readonly tier: BadgeTier | 0
  readonly size?: 'sm' | 'md' | 'lg'
}

const SIZES = { sm: 'size-8 text-[0.95rem]', md: 'size-11 text-[1.2rem]', lg: 'size-14 text-[1.5rem]' } as const

/** A round medal: the badge glyph in its tier colours, or greyed out while locked. */
export function BadgeMedal({ id, tier, size = 'md' }: BadgeMedalProps) {
  const content = badgeContent(id)
  const colors = tier === 0 ? { ring: '#d5dde7', fill: '#f2f5f9', text: '#9aa8bd' } : TIER_COLORS[tier]
  const label = tier === 0 ? `${content.name} (locked)` : `${content.name}, ${TIER_NAMES[tier]}`

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`grid shrink-0 place-items-center rounded-full border-[3px] font-bold ${SIZES[size]}`}
      style={{ borderColor: colors.ring, background: colors.fill, color: colors.text }}
    >
      <span aria-hidden="true">{content.icon}</span>
    </span>
  )
}
