import {
  advanceToNextLevel,
  createRun,
  isSolid,
  placeWall,
  startGame,
  tick,
  type FieldOrientation,
  type GameMode,
  type GameState,
  type RunInput,
} from '@games/trap-the-orb-engine'

/**
 * Plays like a person would — the way the browser does — and records every
 * accepted wall. Copied from the engine's replay.test.ts so the API is tested
 * with real recordings.
 */

export interface Session {
  readonly mode: GameMode
  readonly seed: number
  readonly field?: FieldOrientation
  readonly ticks: number
  /** 'careful' builds far from the orbs; 'reckless' builds right on top of one. */
  readonly style?: 'careful' | 'reckless'
}

export interface PlayedSession {
  readonly state: GameState
  readonly inputs: readonly RunInput[]
}

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

export function playSession({ mode, seed, field = 'landscape', ticks, style = 'careful' }: Session): PlayedSession {
  let state = startGame(createRun({ mode, seed, field }))
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
