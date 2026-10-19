import { gameById, type GameId } from '@/sites/games'

/** This game's entry in the catalogue. */
export const GAME_ID: GameId = 'absurd-trolley-problems'
export const GAME = gameById(GAME_ID)
