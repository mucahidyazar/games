import {
  CUSTOM_PRESETS,
  getLevelConfig,
  HARDCORE_LIVES,
  rulesFor,
  TICKS_PER_SECOND,
  type CustomPreset,
  type CustomSettings,
  type GameMode,
  type LevelChange,
} from '@games/trap-the-orb-engine'
import { BALL_COLORS } from '../render/palette'

export interface ModeInfo {
  readonly id: GameMode
  readonly name: string
  /** Label on the mode bar, where space is tight. */
  readonly short: string
  readonly icon: string
  readonly tagline: string
  readonly description: string
}

/** Ranked modes first: fixed rules, leaderboards and badges. Then the practice ones. */
export const MODES: readonly ModeInfo[] = [
  {
    id: 'classic',
    name: 'Classic',
    short: 'Classic',
    icon: '◆',
    tagline: 'The original challenge',
    description: 'Orbs join and speed up level by level. Lives reset every level.',
  },
  {
    id: 'daily',
    name: 'Daily Challenge',
    short: 'Daily',
    icon: '☀',
    tagline: 'Same levels for everyone today',
    description: 'Classic rules on today’s shared layout. Only your first attempt each day is ranked.',
  },
  {
    id: 'timeAttack',
    name: 'Time Attack',
    short: 'Time Attack',
    icon: '⏱',
    tagline: 'Beat the countdown',
    description: 'Every level has a timer. When it hits zero, the run is over.',
  },
  {
    id: 'limitedWalls',
    name: 'Limited Walls',
    short: 'Limited Walls',
    icon: '▦',
    tagline: 'Make every wall count',
    description: 'A small wall budget per level. Unused walls are worth bonus points.',
  },
  {
    id: 'hardcore',
    name: 'Hardcore',
    short: 'Hardcore',
    icon: '♥',
    tagline: 'One life. That’s it.',
    description: `${HARDCORE_LIVES} life for the whole run. One broken wall and it’s over.`,
  },
  {
    id: 'zen',
    name: 'Zen',
    short: 'Zen',
    icon: '∞',
    tagline: 'Unlimited lives, no pressure',
    description: 'Practise at your own pace. Broken walls cost nothing. Not ranked.',
  },
  {
    id: 'custom',
    name: 'Custom',
    short: 'Custom',
    icon: '⚙',
    tagline: 'Set up your game',
    description: 'Pick the orbs, speed, lives, walls and timer. Great for learning. Not ranked.',
  },
]

export function modeInfo(mode: GameMode): ModeInfo {
  const info = MODES.find((candidate) => candidate.id === mode)
  if (!info) throw new Error(`Unknown mode: ${mode}`)
  return info
}

/** Short rule reminders shown next to a mode, derived from the actual engine rules. */
export function ruleChips(mode: GameMode, custom: CustomSettings | null): readonly string[] {
  const rules = rulesFor(mode, custom ?? undefined)
  const firstLevel = getLevelConfig(1, rules)
  const chips: string[] = []

  if (rules.custom) chips.push(`${rules.custom.orbCount} orbs`, `${rules.custom.speed.toFixed(1)}× speed`)
  if (rules.livesPolicy === 'infinite') chips.push('∞ lives')
  else if (rules.livesPolicy === 'perRun') chips.push(`${rules.runLives} life per run`)
  else chips.push(rules.custom ? `${firstLevel.lives} lives` : 'Lives reset each level')

  if (firstLevel.timeLimitTicks !== null) {
    chips.push(rules.custom ? `${firstLevel.timeLimitTicks / TICKS_PER_SECOND}s timer` : 'Timer per level')
  }
  if (firstLevel.wallBudget !== null) chips.push(rules.custom ? `${firstLevel.wallBudget} walls` : 'Wall budget')
  chips.push(`Clear at ${firstLevel.targetPercent}%`)
  if (!rules.ranked) chips.push('Not ranked')
  return chips
}

export const PRESET_LABELS: Readonly<Record<CustomPreset, string>> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  expert: 'Expert',
}

/** The preset matching the settings exactly, if any. */
export function matchingPreset(settings: CustomSettings): CustomPreset | null {
  const entry = (Object.entries(CUSTOM_PRESETS) as Array<[CustomPreset, CustomSettings]>).find(([, preset]) =>
    (Object.keys(preset) as Array<keyof CustomSettings>).every((key) => preset[key] === settings[key]),
  )
  return entry?.[0] ?? null
}

export interface SpeedTierInfo {
  readonly name: string
  /** Matches the orb colours on the canvas. */
  readonly color: string
}

const SPEED_TIER_NAMES = ['Calm', 'Quick', 'Fast', 'Blazing'] as const

/** Speed tiers in the order of the engine's SPEED_TIERS, coloured like the orbs on the canvas. */
export const SPEED_TIER_INFO: readonly SpeedTierInfo[] = SPEED_TIER_NAMES.map((name, tier) => ({
  name,
  color: BALL_COLORS[tier]?.base ?? '#2b8cff',
}))

/** One line about what the next level changes, e.g. "Two orbs get faster." */
export function describeLevelChange(
  previousTiers: readonly number[],
  next: { readonly orbTiers: readonly number[]; readonly change: LevelChange },
): string {
  switch (next.change) {
    case 'first':
      return 'One calm orb to warm up.'
    case 'newOrb':
      return 'A new orb joins the field.'
    case 'breather':
      return 'A new orb joins — the others ease off for a moment.'
    case 'repeat':
      return 'Same rules, fresh layout.'
    case 'speedUp': {
      const faster = next.orbTiers.filter((tier, index) => tier > (previousTiers[index] ?? tier)).length
      return faster === 1 ? 'One orb gets faster.' : `${faster || 'The'} orbs get faster.`
    }
  }
}
