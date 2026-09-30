import { describe, expect, it } from 'vitest'
import { transposeBall } from './balls'
import { TICKS_PER_SECOND } from './constants'
import {
  advanceToNextLevel,
  createRun,
  pauseGame,
  placeWall,
  restartLevel,
  resumeGame,
  startGame,
  tick,
} from './game'
import { circleOverlapsSolid } from './geometry'
import { capturedPercent, createGrid } from './grid'
import { CUSTOM_PRESETS } from './modes'
import { nextRandom } from './random'
import type { Ball, GameEvent, GameMode, GameState, Orientation } from './types'

const still = (id: number, x: number, y: number): Ball => ({ id, x, y, vx: 0, vy: 0, radius: 3.3, tier: 0 })

/** A running game on a small 40 × 20 field (684 interior cells) with the given orbs. */
const playingWith = (balls: Ball[], overrides: Partial<GameState> = {}, mode: GameMode = 'classic'): GameState => ({
  ...startGame(createRun({ mode, seed: 1 })),
  grid: createGrid(40, 20),
  balls,
  ...overrides,
})

const runTicks = (state: GameState, ticks: number) => {
  let current = state
  const events: GameEvent[] = []
  for (let i = 0; i < ticks; i++) {
    const result = tick(current)
    current = result.state
    events.push(...result.events)
  }
  return { state: current, events }
}

const runFor = (state: GameState, seconds: number) => runTicks(state, Math.round(seconds * TICKS_PER_SECOND))

const eventsOfType = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type)

const build = (state: GameState, col: number, row: number, orientation: Orientation) =>
  runFor(placeWall(state, { col, row, orientation }).state, 0.6)

/** Walls off 75% of the field around a single orb parked on the left. */
const completeLevel = (mode: GameMode = 'classic', overrides: Partial<GameState> = {}) => {
  const first = build(playingWith([still(1, 8, 10)], overrides, mode), 20, 10, 'vertical') // 50%
  const second = build(first.state, 5, 5, 'horizontal') // ~63.9%
  const third = build(second.state, 5, 15, 'horizontal') // 75%
  return { before: second.state, lastEvents: third.events, state: third.state }
}

describe('createRun', () => {
  it('starts Classic on level 1 with a single calm orb and two lives', () => {
    const game = createRun({ mode: 'classic', seed: 1 })

    expect(game).toMatchObject({ status: 'ready', level: 1, lives: 2, score: 0, tick: 0, field: 'landscape' })
    expect(game.balls).toHaveLength(1)
    expect(game.balls[0]?.tier).toBe(0)
    expect(game.walls).toEqual([])
    expect(game.grid).toMatchObject({ cols: 300, rows: 150 })
    expect(game.stats.highestLevel).toBe(1)
  })

  it('builds the same layout turned on its side for portrait screens', () => {
    const landscape = createRun({ mode: 'classic', seed: 5, level: 9 })
    const portrait = createRun({ mode: 'classic', seed: 5, level: 9, field: 'portrait' })

    expect(portrait.grid).toMatchObject({ cols: 150, rows: 300 })
    expect(portrait.balls).toEqual(landscape.balls.map(transposeBall))
  })

  it('can continue a saved run at a later level with its score', () => {
    const game = createRun({ mode: 'classic', seed: 1, level: 9, score: 4200 })

    expect(game).toMatchObject({ level: 9, lives: 5, score: 4200, levelStartScore: 4200 })
    expect(game.balls.map((ball) => ball.tier)).toEqual([1, 1, 1, 1])
  })

  it('ignores negative or fractional carried scores', () => {
    expect(createRun({ mode: 'classic', seed: 1, score: -50 }).score).toBe(0)
    expect(createRun({ mode: 'classic', seed: 1, score: 99.7 }).score).toBe(99)
  })

  it('sets up the rules of each mode', () => {
    expect(createRun({ mode: 'hardcore', seed: 1 }).lives).toBe(1)
    expect(createRun({ mode: 'limitedWalls', seed: 1 }).wallsLeft).toBe(6)
    expect(createRun({ mode: 'timeAttack', seed: 1 }).config.timeLimitTicks).toBe(45 * TICKS_PER_SECOND)
    expect(createRun({ mode: 'classic', seed: 1 }).wallsLeft).toBeNull()
    expect(createRun({ mode: 'custom', seed: 1, custom: CUSTOM_PRESETS.expert }).balls).toHaveLength(8)
  })
})

describe('tick', () => {
  it('lets orbs roam before the start without counting time, then starts from the spawn point', () => {
    const ready = createRun({ mode: 'classic', seed: 3, level: 5 })

    const preview = runTicks(ready, 30).state
    const started = startGame(preview)

    expect(preview.balls).not.toEqual(ready.balls)
    expect(preview.tick).toBe(0)
    expect(started).toMatchObject({ status: 'playing', tick: 0, levelTicks: 0 })
    expect(started.balls).toEqual(ready.spawnBalls)
  })

  it('counts ticks while playing', () => {
    const playing = startGame(createRun({ mode: 'classic', seed: 3 }))

    expect(runTicks(playing, 3).state).toMatchObject({ tick: 3, levelTicks: 3 })
  })

  it('freezes everything while paused', () => {
    const paused = pauseGame(startGame(createRun({ mode: 'classic', seed: 3 })))

    const result = tick(paused)

    expect(result.state).toBe(paused)
    expect(result.events).toEqual([])
  })

  it('is deterministic for a given seed', () => {
    const a = runTicks(startGame(createRun({ mode: 'classic', seed: 9, level: 12 })), 240)
    const b = runTicks(startGame(createRun({ mode: 'classic', seed: 9, level: 12 })), 240)

    expect(a.state).toEqual(b.state)
  })
})

describe('placeWall', () => {
  it('only accepts walls while playing', () => {
    const ready = createRun({ mode: 'classic', seed: 1 })

    const result = placeWall(ready, { col: 5, row: 5, orientation: 'vertical' })

    expect(result.state).toBe(ready)
    expect(result.events).toEqual([{ type: 'wallRejected', reason: 'notPlaying' }])
  })

  it('rejects walls on solid cells', () => {
    const playing = playingWith([still(1, 8, 10)])

    expect(placeWall(playing, { col: 0, row: 5, orientation: 'vertical' }).events).toEqual([
      { type: 'wallRejected', reason: 'solid' },
    ])
  })

  it('allows only one wall under construction at a time', () => {
    const playing = playingWith([still(1, 8, 10)])
    const started = placeWall(playing, { col: 20, row: 10, orientation: 'vertical' })

    const second = placeWall(started.state, { col: 30, row: 10, orientation: 'horizontal' })

    expect(started.events).toEqual([
      { type: 'wallStarted', orientation: 'vertical', col: 20, row: 10, wallsLeft: null },
    ])
    expect(started.state.walls).toHaveLength(2)
    expect(started.state).toMatchObject({ levelWallsUsed: 1, stats: expect.objectContaining({ wallsBuilt: 1 }) })
    expect(second.events).toEqual([{ type: 'wallRejected', reason: 'busy' }])
  })

  it('spends the Limited Walls budget and refuses walls once it is empty', () => {
    const playing = playingWith([still(1, 8, 10)], { wallsLeft: 3 }, 'limitedWalls')

    const started = placeWall(playing, { col: 20, row: 10, orientation: 'vertical' })

    expect(started.state.wallsLeft).toBe(2)
    expect(started.events[0]).toMatchObject({ type: 'wallStarted', wallsLeft: 2 })
    expect(placeWall({ ...playing, wallsLeft: 0 }, { col: 20, row: 10, orientation: 'vertical' }).events).toEqual([
      { type: 'wallRejected', reason: 'noWalls' },
    ])
  })
})

describe('building walls', () => {
  it('captures regions without orbs and scores them', () => {
    const { state, events } = build(playingWith([still(1, 8, 10)]), 20, 10, 'vertical')

    const completed = eventsOfType(events, 'wallCompleted')
    expect(completed).toHaveLength(2)
    expect(completed.reduce((sum, event) => sum + event.capturedCells, 0)).toBe(18 * 18)
    expect(completed.reduce((sum, event) => sum + event.capturedRegions, 0)).toBe(1)
    expect(capturedPercent(state.grid)).toBeCloseTo(50)
    expect(state.walls).toEqual([])
    expect(state.score).toBe(completed.reduce((sum, event) => sum + event.points, 0))
    expect(state.stats.biggestCapturePct).toBeGreaterThan(45)
    expect(state.stats.tightestTrapPct).toBeCloseTo(50, 0)
  })

  it('destroys a half that an orb touches and costs a life', () => {
    const { state, events } = build(playingWith([still(1, 20.5, 14)]), 20, 4, 'vertical')

    const broken = eventsOfType(events, 'wallBroken')
    expect(broken).toHaveLength(1)
    expect(broken[0]?.wall.direction).toBe(1)
    expect(broken[0]?.livesLeft).toBe(1)
    expect(state).toMatchObject({ lives: 1, status: 'playing', levelLivesLost: 1 })
    expect(state.stats.wallsBroken).toBe(1)
  })

  it('charges a single life when an orb breaks both halves in the same instant', () => {
    const { state, events } = build(playingWith([still(1, 20.5, 10.5)]), 20, 10, 'vertical')

    expect(eventsOfType(events, 'wallBroken')).toHaveLength(2)
    expect(state.lives).toBe(1)
  })

  it('ends the game when the last life is lost', () => {
    const { state, events } = build(playingWith([still(1, 20.5, 14)], { lives: 1 }), 20, 4, 'vertical')

    expect(state).toMatchObject({ status: 'gameOver', lives: 0, walls: [], gameOverReason: 'lives' })
    expect(eventsOfType(events, 'gameOver')).toEqual([{ type: 'gameOver', level: 1, score: state.score, reason: 'lives' }])
  })

  it('never runs out of lives in Zen', () => {
    let state = playingWith([still(1, 20.5, 14)], {}, 'zen')
    // Each wall's lower half runs into the orb; the columns differ so every attempt starts on a free cell.
    for (const col of [18, 19, 21, 22]) state = build(state, col, 4, 'vertical').state

    expect(state).toMatchObject({ status: 'playing', lives: 2, levelLivesLost: 4 })
  })

  it('ends a Time Attack level when the countdown runs out', () => {
    const playing = playingWith([still(1, 8, 10)], {}, 'timeAttack')
    const timed = { ...playing, config: { ...playing.config, timeLimitTicks: 60 } }

    const { state, events } = runTicks(timed, 61)

    expect(state).toMatchObject({ status: 'gameOver', gameOverReason: 'time', levelTicks: 60 })
    expect(eventsOfType(events, 'gameOver')[0]?.reason).toBe('time')
  })

  it('ends a Limited Walls level when the last wall falls short of the target', () => {
    const { state } = build(playingWith([still(1, 8, 10)], { wallsLeft: 1 }, 'limitedWalls'), 20, 10, 'vertical')

    expect(state).toMatchObject({ status: 'gameOver', gameOverReason: 'walls', wallsLeft: 0 })
  })

  it('completes the level at 75% and pays out the level bonus', () => {
    const { before, state, lastEvents } = completeLevel()

    const [complete] = eventsOfType(lastEvents, 'levelComplete')
    const lastWallPoints = eventsOfType(lastEvents, 'wallCompleted').reduce((sum, event) => sum + event.points, 0)

    expect(before.status).toBe('playing')
    expect(state).toMatchObject({ status: 'levelComplete', walls: [] })
    expect(complete?.result).toMatchObject({ level: 1, livesLeft: 2, wallsLeft: null, areaBonus: 0, livesBonus: 200 })
    expect(complete?.result.percent).toBeCloseTo(75)
    expect(complete?.result.timeBonus).toBeGreaterThan(0)
    expect(state.lastResult).toEqual(complete?.result)
    expect(state.score).toBe(before.score + lastWallPoints + (complete?.result.totalBonus ?? 0))
    expect(state.stats).toMatchObject({ levelsCleared: 1, bestPerfectStreak: 1 })
  })

  it('pays a bonus for walls left over in Limited Walls', () => {
    const { state } = completeLevel('limitedWalls', { wallsLeft: 5 })

    expect(state.lastResult).toMatchObject({ wallsLeft: 2, wallBonus: 100 })
  })
})

describe('level flow', () => {
  it('moves on to the next level with the planned orbs and fresh lives', () => {
    const { state } = completeLevel()

    const next = advanceToNextLevel(state)

    expect(next).toMatchObject({
      status: 'playing',
      level: 2,
      lives: 3,
      score: state.score,
      levelStartScore: state.score,
      levelTicks: 0,
      tick: state.tick,
      lastResult: null,
    })
    expect(next.balls).toHaveLength(2)
    expect(next.grid).toMatchObject({ cols: 300, rows: 150 })
    expect(capturedPercent(next.grid)).toBe(0)
    expect(next.stats).toMatchObject({ highestLevel: 2, levelsCleared: 1 })
  })

  it('carries the single Hardcore life into the next level', () => {
    const { state } = completeLevel('hardcore', { lives: 1 })

    expect(advanceToNextLevel(state).lives).toBe(1)
  })

  it('ignores next-level requests until the level is complete', () => {
    const playing = playingWith([still(1, 8, 10)])

    expect(advanceToNextLevel(playing)).toBe(playing)
  })

  it('restarts the current level with the score it started with', () => {
    const playing = playingWith([still(1, 8, 10)], { score: 999, levelStartScore: 100, lives: 1, levelTicks: 500 })

    const restarted = restartLevel(playing)

    expect(restarted).toMatchObject({ status: 'playing', level: 1, score: 100, lives: 2, levelTicks: 0 })
  })

  it('pauses and resumes only from the matching states', () => {
    const ready = createRun({ mode: 'classic', seed: 1 })
    const playing = startGame(ready)

    expect(pauseGame(ready)).toBe(ready)
    expect(resumeGame(playing)).toBe(playing)
    expect(pauseGame(playing).status).toBe('paused')
    expect(resumeGame(pauseGame(playing)).status).toBe('playing')
    expect(startGame(playing)).toBe(playing)
  })
})

describe('simulation invariants', () => {
  it('never lets an orb sink into a wall during chaotic play', () => {
    const custom = { ...CUSTOM_PRESETS.expert, lives: null, walls: null, timeLimitSeconds: null }
    let state = startGame(createRun({ mode: 'custom', seed: 2024, custom }))
    let seed = 77

    for (let frame = 0; frame < 4000; frame++) {
      if (frame % 20 === 0) {
        const [rx, s1] = nextRandom(seed)
        const [ry, s2] = nextRandom(s1)
        const [ro, s3] = nextRandom(s2)
        seed = s3
        state = placeWall(state, {
          col: Math.floor(rx * state.grid.cols),
          row: Math.floor(ry * state.grid.rows),
          orientation: ro < 0.5 ? 'vertical' : 'horizontal',
        }).state
      }

      state = tick(state).state
      if (state.status === 'levelComplete') state = advanceToNextLevel(state)

      for (const ball of state.balls) {
        expect(circleOverlapsSolid(state.grid, ball.x, ball.y, ball.radius)).toBe(false)
      }
    }
  })
})
