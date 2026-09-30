import { TICKS_PER_SECOND } from './constants'
import { fieldDims } from './field'
import { advanceToNextLevel, createRun, placeWall, startGame, tick } from './game'
import type { CustomSettings, FieldOrientation, GameMode, GameOverReason, GameStatus, RunStats } from './types'

/** One accepted wall placement: tick, column, row, orientation ('v' or 'h'). Kept short for small payloads. */
export interface RunInput {
  readonly t: number
  readonly c: number
  readonly r: number
  readonly o: 'v' | 'h'
}

export interface ReplayRequest {
  readonly mode: GameMode
  readonly seed: number
  readonly field: FieldOrientation
  readonly custom?: CustomSettings
  readonly inputs: readonly RunInput[]
  /** Tick at which the player stopped (game over or leaving the page). */
  readonly endTick: number
}

export interface ReplayResult {
  readonly status: GameStatus
  readonly gameOverReason: GameOverReason | null
  readonly score: number
  readonly level: number
  readonly levelsCleared: number
  readonly stats: RunStats
  readonly tick: number
  readonly acceptedInputs: number
}

export type ReplayErrorCode = 'order' | 'range' | 'tooLong'

export class ReplayError extends Error {
  readonly code: ReplayErrorCode

  constructor(code: ReplayErrorCode, message: string) {
    super(message)
    this.name = 'ReplayError'
    this.code = code
  }
}

/** Longest run the server will replay: three hours of play. */
export const MAX_RUN_TICKS = 3 * 60 * 60 * TICKS_PER_SECOND

function validate({ field, inputs, endTick }: ReplayRequest): void {
  if (!Number.isInteger(endTick) || endTick < 0) throw new ReplayError('range', 'endTick must be a non-negative whole number')
  if (endTick > MAX_RUN_TICKS) throw new ReplayError('tooLong', 'The run is longer than the replay limit')

  const { cols, rows } = fieldDims(field)
  let previousTick = 0
  inputs.forEach((input, index) => {
    const where = `input ${index}`
    if (!Number.isInteger(input.t) || input.t < 0 || input.t > endTick) {
      throw new ReplayError('range', `${where}: tick outside the run`)
    }
    if (input.t < previousTick) throw new ReplayError('order', `${where}: inputs must be in tick order`)
    const inField =
      Number.isInteger(input.c) && Number.isInteger(input.r) && input.c >= 0 && input.r >= 0 && input.c < cols && input.r < rows
    if (!inField) throw new ReplayError('range', `${where}: cell outside the field`)
    if (input.o !== 'v' && input.o !== 'h') throw new ReplayError('range', `${where}: unknown orientation`)
    previousTick = input.t
  })
}

/**
 * Re-plays a recorded run from its seed and inputs — the same way the browser
 * played it — and returns the authoritative result. Throws ReplayError for
 * malformed recordings.
 */
export function replayRun(request: ReplayRequest): ReplayResult {
  validate(request)
  const { inputs, endTick } = request
  let state = startGame(createRun({ mode: request.mode, seed: request.seed, field: request.field, custom: request.custom }))
  let next = 0
  let acceptedInputs = 0

  while (state.status !== 'gameOver') {
    if (state.status === 'levelComplete') {
      // The player moved on (or left) here; we only continue if they played on.
      if (state.tick >= endTick) break
      state = advanceToNextLevel(state)
      continue
    }

    while (next < inputs.length && inputs[next]?.t === state.tick) {
      const input = inputs[next] as RunInput
      const placed = placeWall(state, {
        col: input.c,
        row: input.r,
        orientation: input.o === 'v' ? 'vertical' : 'horizontal',
      })
      if (placed.events.some((event) => event.type === 'wallStarted')) acceptedInputs++
      state = placed.state
      next++
    }

    if (state.tick >= endTick) break
    state = tick(state).state
  }

  return {
    status: state.status,
    gameOverReason: state.gameOverReason,
    score: state.score,
    level: state.level,
    levelsCleared: state.stats.levelsCleared,
    stats: state.stats,
    tick: state.tick,
    acceptedInputs,
  }
}
