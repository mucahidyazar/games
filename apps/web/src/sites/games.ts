/**
 * The catalogue of games. Pure data: the portal home lists it, the routes
 * are derived from it and the build plugin reads it for the sitemap.
 * Adding a game means adding an entry here and a folder under src/games/.
 */

export type GameId = 'trap-the-orb' | 'absurd-trolley-problems'

export type CategoryId = 'arcade' | 'puzzle' | 'strategy' | 'action' | 'casual' | 'word'

export interface GameCategory {
  readonly id: CategoryId
  readonly name: string
  readonly blurb: string
  /** Turkish copy for the portal when the site speaks Turkish. */
  readonly tr: { readonly name: string; readonly blurb: string }
}

export const CATEGORIES: readonly GameCategory[] = [
  { id: 'arcade', name: 'Arcade', blurb: 'Quick rounds, rising speed, high scores.', tr: { name: 'Arcade', blurb: 'Kısa turlar, artan hız, yüksek skorlar.' } },
  { id: 'puzzle', name: 'Puzzle', blurb: 'Think first, then make the move.', tr: { name: 'Bulmaca', blurb: 'Önce düşün, sonra hamleni yap.' } },
  { id: 'strategy', name: 'Strategy', blurb: 'Plan ahead and outsmart the board.', tr: { name: 'Strateji', blurb: 'İleriyi planla, tahtayı alt et.' } },
  { id: 'action', name: 'Action', blurb: 'Fast reflexes, no time to breathe.', tr: { name: 'Aksiyon', blurb: 'Hızlı refleksler, nefes alacak vakit yok.' } },
  { id: 'casual', name: 'Casual', blurb: 'Easy to pick up, hard to put down.', tr: { name: 'Gündelik', blurb: 'Başlaması kolay, bırakması zor.' } },
  { id: 'word', name: 'Word', blurb: 'Letters, languages and clever guesses.', tr: { name: 'Kelime', blurb: 'Harfler, diller ve zekice tahminler.' } },
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
  /** Ranked tables at `/<game>/leaderboards`. */
  readonly hasLeaderboards: boolean
  /** Phone apps are on the way (the "Mobile app" footer link). */
  readonly hasMobileApp: boolean
  /** The game draws its own site header (its logo and tabs) instead of the shared one. */
  readonly hasCustomHeader: boolean
  /** Turkish copy for the portal when the site speaks Turkish. */
  readonly tr: { readonly tagline: string; readonly tags: readonly string[]; readonly highlights: readonly string[] }
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
    hasLeaderboards: true,
    hasMobileApp: true,
    hasCustomHeader: false,
    tr: {
      tagline: 'Topları hapset. Alanı kap.',
      tags: ['Arcade', 'Beceri', 'Sıralamalar'],
      highlights: ['5 dereceli mod', 'Günlük meydan okuma', 'Kazanılacak 12 rozet'],
    },
  },
  {
    id: 'absurd-trolley-problems',
    name: 'Absurd Trolley Problems',
    tagline: 'Pull the lever. Or don’t.',
    description:
      'A runaway tram, a lever and twenty-four increasingly absurd moral dilemmas in a 3D pixel-art night. Decide, then see how the rest of the world voted.',
    category: 'casual',
    tags: ['Casual', '3D', 'Community votes'],
    highlights: ['24 absurd dilemmas', 'Live community votes', 'Turkish & English'],
    cover: '/games/absurd-trolley-problems/cover.png',
    coverAlt: 'A pixel-art night scene: a blue tram approaches a switch, five influencers film it from one track and an orange cat waits on the other.',
    icon: '/games/absurd-trolley-problems/icon.png',
    siteUrl: null,
    releasedAt: '2026-10-18',
    hasLeaderboards: false,
    hasMobileApp: false,
    hasCustomHeader: true,
    tr: {
      tagline: 'Kolu çek. Ya da çekme.',
      tags: ['Gündelik', '3D', 'Topluluk oyu'],
      highlights: ['24 absürt ikilem', 'Canlı topluluk oyları', 'Türkçe ve İngilizce'],
    },
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
