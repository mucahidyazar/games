import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '@/games/trap-the-orb/storage/memoryStore'
import {
  activePlayer,
  addPlayer,
  byRecent,
  choosePlayer,
  cleanName,
  loadPlayers,
  MAX_PLAYERS,
  nameTaken,
  nextColor,
  PLAYER_COLORS,
  PLAYERS_KEY,
  removePlayer,
  savePlayers,
  updateActive,
  type Players,
} from './players'
import { PROGRESS_KEY } from './progress'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOBODY: Players = { list: [], activeId: null, music: true }

const twoPlayers = (): Players => {
  const one = addPlayer(NOBODY, 'Ayşe', PLAYER_COLORS[0], 1000)
  return addPlayer(one, 'Mehmet', PLAYER_COLORS[1], 2000)
}

describe('player names', () => {
  it('are trimmed, single-spaced and kept short', () => {
    expect(cleanName('  Ayşe   Nur ')).toBe('Ayşe Nur')
    expect(cleanName('x'.repeat(40))).toHaveLength(20)
    expect(cleanName('   ')).toBe('')
  })

  it('are unique regardless of case', () => {
    const players = twoPlayers()
    expect(nameTaken(players, ' ayşe ')).toBe(true)
    expect(nameTaken(players, 'Zeynep')).toBe(false)
  })

  it('come with the first colour nobody has', () => {
    expect(nextColor(NOBODY)).toBe(PLAYER_COLORS[0])
    expect(nextColor(twoPlayers())).toBe(PLAYER_COLORS[2])
  })
})

describe('adding, choosing and removing players', () => {
  it('gives a new player a fresh game of their own, and puts it on', () => {
    const players = twoPlayers()
    expect(players.list.map((player) => player.name)).toEqual(['Ayşe', 'Mehmet'])
    const mehmet = activePlayer(players)
    expect(mehmet?.name).toBe('Mehmet')
    expect(mehmet?.progress).toMatchObject({ chapter: 0, index: 0, answers: {}, foot: 0 })
    expect(mehmet?.id).toMatch(UUID)
    // Each player votes under their own anonymous id.
    expect(mehmet?.progress.voterId).toMatch(UUID)
    expect(mehmet?.progress.voterId).not.toBe(players.list[0]?.progress.voterId)
  })

  it('stops at eight players', () => {
    let players = NOBODY
    for (let i = 0; i < MAX_PLAYERS + 2; i++) players = addPlayer(players, `P${i}`, PLAYER_COLORS[0])
    expect(players.list).toHaveLength(MAX_PLAYERS)
  })

  it('switches whose game is on and remembers when they played', () => {
    const players = twoPlayers()
    const ayse = players.list[0]?.id as string
    const chosen = choosePlayer(players, ayse, 5000)
    expect(activePlayer(chosen)?.name).toBe('Ayşe')
    expect(byRecent(chosen).map((player) => player.name)).toEqual(['Ayşe', 'Mehmet'])
    expect(choosePlayer(players, 'nobody', 5000)).toBe(players)
  })

  it('removes a player, handing the game to the most recent one left', () => {
    const players = twoPlayers()
    const mehmet = players.activeId as string
    const left = removePlayer(players, mehmet)
    expect(left.list.map((player) => player.name)).toEqual(['Ayşe'])
    expect(activePlayer(left)?.name).toBe('Ayşe')
    expect(removePlayer(left, left.activeId as string)).toEqual({ list: [], activeId: null, music: true })
    expect(removePlayer(players, 'nobody')).toBe(players)
  })
})

describe('updateActive', () => {
  it('changes only the game that is on', () => {
    const players = twoPlayers()
    const after = updateActive(players, (progress) => ({ ...progress, index: 3, answers: { footbridge: 'pull' } }))
    expect(activePlayer(after)?.progress).toMatchObject({ index: 3, answers: { footbridge: 'pull' } })
    expect(after.list[0]?.progress).toEqual(players.list[0]?.progress)
  })

  it('keeps music as the device’s setting, even before anyone plays', () => {
    const muted = updateActive(NOBODY, (progress) => ({ ...progress, music: false }))
    expect(muted).toEqual({ list: [], activeId: null, music: false })
    expect(updateActive(NOBODY, (progress) => progress)).toBe(NOBODY)
    expect(updateActive(twoPlayers(), (progress) => ({ ...progress, music: false })).music).toBe(false)
  })
})

describe('storage', () => {
  it('round-trips the players', () => {
    const store = createMemoryStore()
    const players = twoPlayers()
    expect(savePlayers(store, players)).toBe(true)
    expect(loadPlayers(store, 'Player')).toEqual(players)
    expect(savePlayers(null, players)).toBe(false)
  })

  it('turns a game saved before players existed into the first player', () => {
    const store = createMemoryStore()
    const voterId = '0b8e4c4e-7d55-4c55-9c1e-3f0f2f5a9b11'
    store.setItem(PROGRESS_KEY, JSON.stringify({ chapter: 1, index: 4, answers: { footbridge: 'pull' }, voterId, music: false }))

    const players = loadPlayers(store, 'Oyuncu', 9000)

    expect(players.music).toBe(false)
    expect(players.list).toHaveLength(1)
    expect(activePlayer(players)).toMatchObject({ name: 'Oyuncu 1', color: PLAYER_COLORS[0], lastPlayed: 9000, progress: { chapter: 1, index: 4, answers: { footbridge: 'pull' }, voterId } })
    // Saving retires the old single-game save.
    savePlayers(store, players)
    expect(store.getItem(PROGRESS_KEY)).toBeNull()
    expect(store.getItem(PLAYERS_KEY)).not.toBeNull()
  })

  it('repairs what it can, player by player', () => {
    const store = createMemoryStore()
    store.setItem(
      PLAYERS_KEY,
      JSON.stringify({
        list: [
          { id: 'not-a-uuid', name: '   ', color: '#000000', progress: { chapter: 9, answers: { footbridge: 'pull', nope: 'pull' } }, lastPlayed: -4 },
          'garbage',
          { id: '11111111-2222-4333-8444-555555555555', name: 'Zeynep', color: PLAYER_COLORS[3], progress: {}, lastPlayed: 50 },
        ],
        activeId: 'someone-else',
        music: 'loud',
      }),
    )

    const players = loadPlayers(store, 'Player')

    expect(players.list).toHaveLength(2)
    const [first, second] = players.list
    expect(first).toMatchObject({ name: 'Player 1', color: PLAYER_COLORS[0], lastPlayed: 0, progress: { chapter: 0, index: 0, answers: { footbridge: 'pull' } } })
    expect(first?.id).toMatch(UUID)
    expect(second).toMatchObject({ id: '11111111-2222-4333-8444-555555555555', name: 'Zeynep', color: PLAYER_COLORS[3] })
    // An unknown active player falls back to whoever played last.
    expect(players.activeId).toBe(second?.id)
    expect(players.music).toBe(true)
  })

  it('starts with nobody, given nothing or garbage', () => {
    expect(loadPlayers(null, 'Player')).toEqual(NOBODY)
    const store = createMemoryStore()
    store.setItem(PLAYERS_KEY, 'not json')
    expect(loadPlayers(store, 'Player')).toEqual(NOBODY)
  })
})
