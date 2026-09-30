import { paths } from '@/app/site'
import { gameById, type GameId } from '@/sites/games'

/** This game's entry in the catalogue and its paths on the current site. */
export const GAME_ID: GameId = 'trap-the-orb'
export const GAME = gameById(GAME_ID)

export const gamePaths = {
  /** The game's page (its start menu). */
  home: (): string => paths.game(GAME_ID),
  play: (mode: string): string => paths.play(GAME_ID, mode),
  leaderboards: (search = ''): string => paths.leaderboards(GAME_ID, search),
} as const
