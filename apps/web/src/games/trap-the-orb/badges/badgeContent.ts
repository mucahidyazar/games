import { badgeById, type BadgeId, type BadgeTier } from '@games/trap-the-orb-engine'

export interface BadgeContent {
  readonly id: BadgeId
  readonly name: string
  readonly icon: string
  /** What earns the badge, with `{n}` replaced by the tier's threshold. */
  readonly goal: string
  readonly format: (value: number) => string
}

const whole = (value: number): string => String(value)
const percent = (value: number): string => `${value}%`
const pace = (value: number): string => `${Math.round(value * 100)}%`

export const BADGE_CONTENT: readonly BadgeContent[] = [
  { id: 'climber', name: 'Climber', icon: '⛰', goal: 'Reach level {n} in a ranked mode', format: whole },
  { id: 'squeeze', name: 'Tight Squeeze', icon: '◎', goal: 'Trap an orb in {n} of the field or less', format: percent },
  { id: 'landGrab', name: 'Land Grab', icon: '▰', goal: 'Claim {n} of the field with one wall', format: percent },
  { id: 'overachiever', name: 'Overachiever', icon: '✦', goal: 'Clear a level with {n} captured', format: percent },
  { id: 'flawless', name: 'Flawless', icon: '❖', goal: 'Clear {n} levels in a row without losing a life', format: whole },
  { id: 'lightning', name: 'Lightning', icon: 'ϟ', goal: 'Clear a level in {n} of its par time', format: pace },
  { id: 'doubleTrap', name: 'Double Trap', icon: '⧉', goal: 'Capture {n} separate areas with one wall', format: whole },
  { id: 'architect', name: 'Architect', icon: '⌂', goal: 'Clear a 3+ orb level using {n} walls or fewer', format: whole },
  { id: 'survivor', name: 'Survivor', icon: '♥', goal: 'Reach level {n} in Hardcore', format: whole },
  { id: 'beatTheClock', name: 'Beat the Clock', icon: '⏱', goal: 'Reach level {n} in Time Attack', format: whole },
  { id: 'frugal', name: 'Frugal', icon: '▦', goal: 'Reach level {n} in Limited Walls', format: whole },
  { id: 'devotee', name: 'Devotee', icon: '☀', goal: 'Play the Daily Challenge {n} days in a row', format: whole },
]

export const TIER_NAMES: Readonly<Record<BadgeTier, string>> = { 1: 'Bronze', 2: 'Silver', 3: 'Gold' }

export const TIER_COLORS: Readonly<Record<BadgeTier, { readonly ring: string; readonly fill: string; readonly text: string }>> = {
  1: { ring: '#c97c46', fill: '#fbe9dc', text: '#8a4a1f' },
  2: { ring: '#8e9bb0', fill: '#eef1f6', text: '#465779' },
  3: { ring: '#d9a21b', fill: '#fdf3d3', text: '#7a5600' },
}

export function badgeContent(id: BadgeId): BadgeContent {
  const content = BADGE_CONTENT.find((candidate) => candidate.id === id)
  if (!content) throw new Error(`Unknown badge: ${id}`)
  return content
}

/** "Trap an orb in 1.5% of the field or less" for a badge tier. */
export function badgeGoal(id: BadgeId, tier: BadgeTier): string {
  const content = badgeContent(id)
  const threshold = badgeById(id).thresholds[tier - 1] ?? 0
  return content.goal.replace('{n}', content.format(threshold))
}
