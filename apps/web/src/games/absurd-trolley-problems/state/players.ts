import { readJson, writeJson, type KeyValueStore } from '@/games/trap-the-orb/storage/keyValueStore'
import { parseProgress, PROGRESS_KEY, randomId, type Progress } from './progress'

/**
 * The people playing on this device: a couple, a family, flatmates. Each has
 * their own game (progress in the absurd dilemmas and in Philippa Foot's
 * cases, choices and anonymous voting id) so they can be compared
 * afterwards. Everything stays in this browser.
 */

export const PLAYERS_KEY = 'absurdtrolley.v2.players'
export const MAX_PLAYERS = 8
export const MAX_NAME = 20
/** Avatar colours, from the key frame's palette. */
export const PLAYER_COLORS = ['#7fe3b8', '#ffd34d', '#ff8fa3', '#7fb2ff', '#c8a2ff', '#ffb067'] as const

/** One player's game; music is the device's setting, not theirs. */
export type PlayerProgress = Omit<Progress, 'music'>

export interface Player {
  readonly id: string
  readonly name: string
  readonly color: string
  readonly progress: PlayerProgress
  /** When they last played (ms since the epoch): orders the list and picks who to compare with. */
  readonly lastPlayed: number
}

export interface Players {
  readonly list: readonly Player[]
  /** Whose game is on; null before anyone has started one. */
  readonly activeId: string | null
  readonly music: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Trimmed, single-spaced and no longer than a name tag. */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim()
}

export function nameTaken(players: Players, name: string): boolean {
  const wanted = cleanName(name).toLocaleLowerCase()
  return players.list.some((player) => player.name.toLocaleLowerCase() === wanted)
}

/** The colour the next new player gets, the first one nobody has yet. */
export function nextColor(players: Players): string {
  const used = new Set(players.list.map((player) => player.color))
  return PLAYER_COLORS.find((color) => !used.has(color)) ?? (PLAYER_COLORS[players.list.length % PLAYER_COLORS.length] as string)
}

export function activePlayer(players: Players): Player | null {
  return players.list.find((player) => player.id === players.activeId) ?? null
}

/** Most recently played first. */
export function byRecent(players: Players): Player[] {
  return [...players.list].sort((a, b) => b.lastPlayed - a.lastPlayed)
}

const progressOnly = ({ chapter, index, answers, foot, voterId }: Progress): PlayerProgress => ({ chapter, index, answers, foot, voterId })

function parsePlayer(raw: unknown, position: number, fallbackName: string): Player | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const name = typeof record.name === 'string' ? cleanName(record.name) : ''
  const color = (PLAYER_COLORS as readonly unknown[]).includes(record.color) ? (record.color as string) : (PLAYER_COLORS[position % PLAYER_COLORS.length] as string)
  const lastPlayed = typeof record.lastPlayed === 'number' && Number.isFinite(record.lastPlayed) && record.lastPlayed >= 0 ? record.lastPlayed : 0
  return {
    id: typeof record.id === 'string' && UUID.test(record.id) ? record.id : randomId(),
    name: name || `${fallbackName} ${position + 1}`,
    color,
    progress: progressOnly(parseProgress(record.progress)),
    lastPlayed,
  }
}

/**
 * The device's players, repaired entry by entry. A game saved before there
 * were players becomes the first player's, so nobody loses their place.
 */
export function loadPlayers(store: KeyValueStore | null, defaultName: string, now = Date.now()): Players {
  const raw = readJson(store, PLAYERS_KEY)
  if (typeof raw === 'object' && raw !== null && Array.isArray((raw as Record<string, unknown>).list)) {
    const record = raw as Record<string, unknown>
    const list: Player[] = []
    for (const entry of (record.list as unknown[]).slice(0, MAX_PLAYERS)) {
      const player = parsePlayer(entry, list.length, defaultName)
      if (player && !list.some((other) => other.id === player.id)) list.push(player)
    }
    const players = { list, activeId: null, music: typeof record.music === 'boolean' ? record.music : true }
    const activeId = list.some((player) => player.id === record.activeId) ? (record.activeId as string) : (byRecent(players)[0]?.id ?? null)
    return { ...players, activeId }
  }

  const legacy = readJson(store, PROGRESS_KEY)
  if (typeof legacy === 'object' && legacy !== null) {
    const progress = parseProgress(legacy)
    const first: Player = { id: randomId(), name: `${defaultName} 1`, color: PLAYER_COLORS[0], progress: progressOnly(progress), lastPlayed: now }
    return { list: [first], activeId: first.id, music: progress.music }
  }
  return { list: [], activeId: null, music: true }
}

/** Saves the players (and retires the single-game save they replaced). */
export function savePlayers(store: KeyValueStore | null, players: Players): boolean {
  const saved = writeJson(store, PLAYERS_KEY, players)
  if (saved) {
    try {
      store?.removeItem(PROGRESS_KEY)
    } catch {
      // The old save just lingers; the players' save wins from now on.
    }
  }
  return saved
}

/** A new player, starting from the very first dilemma, whose game is now on. */
export function addPlayer(players: Players, name: string, color: string, now = Date.now()): Players {
  if (players.list.length >= MAX_PLAYERS) return players
  const player: Player = {
    id: randomId(),
    name: cleanName(name) || `${players.list.length + 1}`,
    color,
    progress: { chapter: 0, index: 0, answers: {}, foot: 0, voterId: randomId() },
    lastPlayed: now,
  }
  return { ...players, list: [...players.list, player], activeId: player.id }
}

export function choosePlayer(players: Players, id: string, now = Date.now()): Players {
  if (!players.list.some((player) => player.id === id)) return players
  return { ...players, activeId: id, list: players.list.map((player) => (player.id === id ? { ...player, lastPlayed: now } : player)) }
}

/** Removes a player and their game; the most recent other player's game goes on. */
export function removePlayer(players: Players, id: string): Players {
  const list = players.list.filter((player) => player.id !== id)
  if (list.length === players.list.length) return players
  const activeId = players.activeId === id ? (byRecent({ ...players, list })[0]?.id ?? null) : players.activeId
  return { ...players, list, activeId }
}

/**
 * Applies a change to the game that is on, written as a change to its
 * progress. The music setting belongs to the device and changes either way.
 */
export function updateActive(players: Players, update: (progress: Progress) => Progress): Players {
  const active = activePlayer(players)
  const before: Progress = { ...(active?.progress ?? { chapter: 0, index: 0, answers: {}, foot: 0, voterId: '' }), music: players.music }
  const after = update(before)
  if (!active) return after.music === players.music ? players : { ...players, music: after.music }
  return {
    ...players,
    music: after.music,
    list: players.list.map((player) => (player.id === active.id ? { ...player, progress: progressOnly(after) } : player)),
  }
}
