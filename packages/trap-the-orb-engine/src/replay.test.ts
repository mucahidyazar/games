import { describe, expect, it } from 'vitest'
import { advanceToNextLevel, createRun, placeWall, startGame, tick } from './game'
import { isSolid } from './grid'
import { CUSTOM_PRESETS } from './modes'
import { MAX_RUN_TICKS, ReplayError, replayRun, type RunInput } from './replay'
import type { CustomSettings, FieldOrientation, GameMode, GameState } from './types'

interface Session {
  readonly mode: GameMode
  readonly seed: number
  readonly field?: FieldOrientation
  readonly custom?: CustomSettings
  readonly ticks: number
  /** 'careful' builds far from the orbs; 'reckless' builds right on top of one. */
  readonly style?: 'careful' | 'reckless'
}

/** Picks a free cell for a vertical wall, or null when none looks sensible. */
function chooseCell(state: GameState, style: 'careful' | 'reckless'): { c: number; r: number } | null {
  const row = Math.floor(state.grid.rows / 2)
  if (style === 'reckless') {
    const ball = state.balls[0]
    return ball ? { c: Math.floor(ball.x), r: Math.floor(ball.y) } : null
  }
  for (let col = 8; col < state.grid.cols - 8; col += 11) {
    const clear = state.balls.every((ball) => Math.abs(ball.x - col) > 14)
    if (clear && !isSolid(state.grid, col, row)) return { c: col, r: row }
  }
  return null
}

/** Plays like a person would (the way the browser does), recording every accepted wall. */
function playSession({ mode, seed, field = 'landscape', custom, ticks, style = 'careful' }: Session) {
  let state = startGame(createRun({ mode, seed, field, custom }))
  const inputs: RunInput[] = []

  while (state.tick < ticks && state.status !== 'gameOver') {
    if (state.status === 'levelComplete') {
      state = advanceToNextLevel(state)
      continue
    }
    if (state.tick % 45 === 0 && state.walls.length === 0) {
      const cell = chooseCell(state, style)
      if (cell) {
        const placed = placeWall(state, { col: cell.c, row: cell.r, orientation: 'vertical' })
        if (placed.events.some((event) => event.type === 'wallStarted')) {
          inputs.push({ t: state.tick, c: cell.c, r: cell.r, o: 'v' })
        }
        state = placed.state
      }
    }
    state = tick(state).state
  }
  return { state, inputs }
}

const expectSameResult = (session: Session) => {
  const { state, inputs } = playSession(session)

  const replayed = replayRun({ ...session, field: session.field ?? 'landscape', inputs, endTick: state.tick })

  expect(replayed).toMatchObject({
    status: state.status,
    score: state.score,
    level: state.level,
    tick: state.tick,
    levelsCleared: state.stats.levelsCleared,
    gameOverReason: state.gameOverReason,
    acceptedInputs: inputs.length,
  })
  expect(replayed.stats).toEqual(state.stats)
  return { state, inputs, replayed }
}

describe('replayRun', () => {
  it('reproduces a recorded Classic session exactly', () => {
    const { state, inputs } = expectSameResult({ mode: 'classic', seed: 11, ticks: 9000 })

    expect(inputs.length).toBeGreaterThan(5)
    expect(state.score).toBeGreaterThan(0)
  })

  it('reproduces every mode, including portrait fields', () => {
    expectSameResult({ mode: 'timeAttack', seed: 5, ticks: 6000, field: 'portrait' })
    expectSameResult({ mode: 'limitedWalls', seed: 6, ticks: 6000 })
    expectSameResult({ mode: 'daily', seed: 7, ticks: 3000 })
    expectSameResult({ mode: 'zen', seed: 8, ticks: 3000 })
    expectSameResult({ mode: 'custom', seed: 9, ticks: 3000, custom: CUSTOM_PRESETS.hard })
  })

  it('stops at game over even when the end tick is later', () => {
    const { state, inputs } = playSession({ mode: 'hardcore', seed: 3, ticks: 5000, style: 'reckless' })

    const replayed = replayRun({ mode: 'hardcore', seed: 3, field: 'landscape', inputs, endTick: state.tick + 4000 })

    expect(state.status).toBe('gameOver')
    expect(replayed).toMatchObject({ status: 'gameOver', gameOverReason: 'lives', tick: state.tick, score: state.score })
  })

  it('stops at the end tick for runs the player left early', () => {
    // Zen never ends on its own, so only the end tick can stop the replay.
    const { inputs } = playSession({ mode: 'zen', seed: 4, ticks: 3000 })

    const replayed = replayRun({
      mode: 'zen',
      seed: 4,
      field: 'landscape',
      inputs: inputs.filter((input) => input.t <= 1200),
      endTick: 1200,
    })

    expect(replayed.tick).toBe(1200)
    expect(replayed.status).not.toBe('gameOver')
  })

  it('counts inputs the engine refuses without failing the run', () => {
    const { state, inputs } = playSession({ mode: 'classic', seed: 11, ticks: 2000 })
    const first = inputs[0]
    if (!first) throw new Error('expected at least one input')

    const replayed = replayRun({
      mode: 'classic',
      seed: 11,
      field: 'landscape',
      inputs: [first, first, ...inputs.slice(1)],
      endTick: state.tick,
    })

    expect(replayed.acceptedInputs).toBe(inputs.length)
    expect(replayed.score).toBe(state.score)
  })

  it('rejects malformed recordings', () => {
    const base = { mode: 'classic' as const, seed: 1, field: 'landscape' as const }
    const input = (t: number, c = 50, r = 50): RunInput => ({ t, c, r, o: 'v' })

    const codeOf = (fn: () => unknown): string | undefined => {
      try {
        fn()
      } catch (error: unknown) {
        return error instanceof ReplayError ? error.code : 'unexpected'
      }
      return undefined
    }

    expect(codeOf(() => replayRun({ ...base, inputs: [input(90), input(30)], endTick: 200 }))).toBe('order')
    expect(codeOf(() => replayRun({ ...base, inputs: [input(300)], endTick: 200 }))).toBe('range')
    expect(codeOf(() => replayRun({ ...base, inputs: [input(10, 400, 10)], endTick: 200 }))).toBe('range')
    expect(codeOf(() => replayRun({ ...base, inputs: [input(10, 1.5, 10)], endTick: 200 }))).toBe('range')
    expect(codeOf(() => replayRun({ ...base, inputs: [], endTick: -1 }))).toBe('range')
    expect(codeOf(() => replayRun({ ...base, inputs: [], endTick: MAX_RUN_TICKS + 1 }))).toBe('tooLong')
  })
})
