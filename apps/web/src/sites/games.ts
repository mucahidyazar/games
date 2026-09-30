/**
 * The catalogue of games. Pure data: the portal home lists it, the routes
 * are derived from it and the build plugin reads it for the sitemap.
 * Adding a game means adding an entry here and a folder under src/games/.
 */

export type GameId = 'trap-the-orb'

export type CategoryId = 'arcade' | 'puzzle' | 'strategy' | 'action' | 'casual' | 'word'

export interface GameCategory {
  readonly id: CategoryId
  readonly name: string
  readonly blurb: string
}

export const CATEGORIES: readonly GameCategory[] = [
  { id: 'arcade', name: 'Arcade', blurb: 'Quick rounds, rising speed, high scores.' },
  { id: 'puzzle', name: 'Puzzle', blurb: 'Think first, then make the move.' },
  { id: 'strategy', name: 'Strategy', blurb: 'Plan ahead and outsmart the board.' },
  { id: 'action', name: 'Action', blurb: 'Fast reflexes, no time to breathe.' },
  { id: 'casual', name: 'Casual', blurb: 'Easy to pick up, hard to put down.' },
  { id: 'word', name: 'Word', blurb: 'Letters, languages and clever guesses.' },
]

export interface GameEntry {
  readonly id: GameId
  readonly name: string
  readonly tagline: string
  readonly description: string
  readonly category: CategoryId
  readonly tags: readonly string[]
  /** Facts shown on the game card. */
  readonly highlights: readonly string[]
  /** 1200 × 630 cover, under public/. */
  readonly cover: string
  readonly coverAlt: string
  /** Square icon, under public/. */
  readonly icon: string
  /** The game's own site, when it has one. */
  readonly siteUrl: string | null
  /** ISO date of the first release. */
  readonly releasedAt: string
}

export const GAMES: readonly GameEntry[] = [
  {
    id: 'trap-the-orb',
    name: 'Trap The Orb',
    tagline: 'Trap the orbs. Claim the space.',
    description:
      'Build walls to box in the bouncing orbs and claim 75% of the field to clear each level. New orbs join and speed up as you climb.',
    category: 'arcade',
    tags: ['Arcade', 'Skill', 'Leaderboards'],
    highlights: ['5 ranked modes', 'Daily Challenge', '12 badges to earn'],
    cover: '/og-image.png',
    coverAlt: 'A Trap The Orb board with mint captured areas, a teal wall being built and three orbs, one trapped in a small pocket.',
    icon: '/icon-192.png',
    siteUrl: 'https://traptheorb.com',
    releasedAt: '2026-09-24',
  },
]

export function isGameId(value: unknown): value is GameId {
  return typeof value === 'string' && GAMES.some((game) => game.id === value)
}

export function gameById(id: GameId): GameEntry {
  const game = GAMES.find((candidate) => candidate.id === id)
  if (!game) throw new Error(`Unknown game: ${id}`)
  return game
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && CATEGORIES.some((category) => category.id === value)
}

export function gamesInCategory(category: CategoryId): readonly GameEntry[] {
  return GAMES.filter((game) => game.category === category)
}
