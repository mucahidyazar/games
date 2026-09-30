import { moveBall, resolveBallPairs, spawnBalls, transposeBall } from './balls'
import { captureEnclosedAreas } from './capture'
import { BALL_RADIUS, TICK_SECONDS } from './constants'
import { fieldDims } from './field'
import { circleIntersectsRect } from './geometry'
import { capturedPercent, createGrid, fillCells, isSolid } from './grid'
import { getLevelConfig } from './levels'
import { rulesFor } from './modes'
import { capturePoints, computeLevelResult } from './scoring'
import {
  EMPTY_STATS,
  statsAfterCapture,
  statsAfterLevelClear,
  statsAfterLevelStart,
  statsAfterWallsBroken,
  statsAfterWallStarted,
} from './stats'
import {
  CELL_WALL,
  type Ball,
  type CustomSettings,
  type FieldOrientation,
  type GameEvent,
  type GameMode,
  type GameOverReason,
  type GameState,
  type GameStatus,
  type ModeRules,
  type Orientation,
  type RunStats,
  type StepResult,
  type WallHalf,
  type WallRejectReason,
} from './types'
import { advanceWall, createWallPair, wallCells, wallRect } from './walls'

export interface CreateRunOptions {
  readonly mode: GameMode
  readonly seed: number
  readonly field?: FieldOrientation
  readonly custom?: CustomSettings
  /** Start at a later level — only used to continue an unranked run. */
  readonly level?: number
  readonly score?: number
}

export interface WallPlacement {
  readonly col: number
  readonly row: number
  readonly orientation: Orientation
}

interface LevelSetup {
  readonly rules: ModeRules
  readonly field: FieldOrientation
  readonly level: number
  readonly score: number
  /** Lives carried over from the previous level (per-run lives only). */
  readonly carriedLives: number | null
  readonly seed: number
  readonly nextId: number
  readonly tick: number
  readonly stats: RunStats
  readonly status: GameStatus
}

function buildLevel(setup: LevelSetup): GameState {
  const config = getLevelConfig(setup.level, setup.rules)
  const dims = fieldDims(setup.field)
  const grid = createGrid(dims.cols, dims.rows)
  // Orbs always spawn on the landscape field; portrait turns that exact layout on its side.
  const spawnGrid = setup.field === 'portrait' ? createGrid(dims.rows, dims.cols) : grid
  const spawned = spawnBalls({
    grid: spawnGrid,
    speeds: config.orbSpeeds,
    tiers: config.orbTiers,
    radius: BALL_RADIUS,
    seed: setup.seed,
    firstId: setup.nextId,
  })
  const balls = setup.field === 'portrait' ? spawned.balls.map(transposeBall) : spawned.balls
  const lives =
    setup.rules.livesPolicy === 'perRun' && setup.carriedLives !== null ? setup.carriedLives : config.lives

  return {
    status: setup.status,
    rules: setup.rules,
    field: setup.field,
    level: config.level,
    config,
    lives,
    score: setup.score,
    levelStartScore: setup.score,
    levelTicks: 0,
    tick: setup.tick,
    grid,
    balls,
    spawnBalls: balls,
    walls: [],
    wallsLeft: config.wallBudget,
    levelLivesLost: 0,
    levelWallsUsed: 0,
    rngSeed: spawned.seed,
    nextId: setup.nextId + config.orbCount,
    stats: statsAfterLevelStart(setup.stats, config.level),
    lastResult: null,
    gameOverReason: null,
  }
}

/** A new run waiting in the "ready" state; orbs roam until the player starts. */
export function createRun({ mode, seed, field = 'landscape', custom, level = 1, score = 0 }: CreateRunOptions): GameState {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0
  return buildLevel({
    rules: rulesFor(mode, custom),
    field,
    level,
    score: safeScore,
    carriedLives: null,
    seed: seed >>> 0,
    nextId: 1,
    tick: 0,
    stats: EMPTY_STATS,
    status: 'ready',
  })
}

/** Starts play from the spawn positions — the preview motion of the ready screen never counts. */
export function startGame(state: GameState): GameState {
  if (state.status !== 'ready') return state
  return { ...state, status: 'playing', balls: state.spawnBalls, tick: 0, levelTicks: 0 }
}

export function pauseGame(state: GameState): GameState {
  return state.status === 'playing' ? { ...state, status: 'paused' } : state
}

export function resumeGame(state: GameState): GameState {
  return state.status === 'paused' ? { ...state, status: 'playing' } : state
}

/** Builds the following level once the current one is cleared. */
export function advanceToNextLevel(state: GameState): GameState {
  if (state.status !== 'levelComplete') return state
  return buildLevel({
    rules: state.rules,
    field: state.field,
    level: state.level + 1,
    score: state.score,
    carriedLives: state.lives,
    seed: state.rngSeed,
    nextId: state.nextId,
    tick: state.tick,
    stats: state.stats,
    status: 'playing',
  })
}

/** Replays the current level from scratch with the score it started with (unranked play only). */
export function restartLevel(state: GameState): GameState {
  return buildLevel({
    rules: state.rules,
    field: state.field,
    level: state.level,
    score: state.levelStartScore,
    carriedLives: null,
    seed: state.rngSeed,
    nextId: state.nextId,
    tick: state.tick,
    stats: state.stats,
    status: 'playing',
  })
}

const rejected = (state: GameState, reason: WallRejectReason): StepResult => ({
  state,
  events: [{ type: 'wallRejected', reason }],
})

/** Starts building a wall through the given cell. Only one wall may grow at a time. */
export function placeWall(state: GameState, { col, row, orientation }: WallPlacement): StepResult {
  if (state.status !== 'playing') return rejected(state, 'notPlaying')
  if (state.walls.length > 0) return rejected(state, 'busy')
  if (state.wallsLeft === 0) return rejected(state, 'noWalls')

  const cellCol = Math.floor(col)
  const cellRow = Math.floor(row)
  if (isSolid(state.grid, cellCol, cellRow)) return rejected(state, 'solid')

  const wallsLeft = state.wallsLeft === null ? null : state.wallsLeft - 1
  return {
    state: {
      ...state,
      walls: createWallPair(orientation, cellCol, cellRow, state.nextId),
      nextId: state.nextId + 2,
      wallsLeft,
      levelWallsUsed: state.levelWallsUsed + 1,
      stats: statsAfterWallStarted(state.stats),
    },
    events: [{ type: 'wallStarted', orientation, col: cellCol, row: cellRow, wallsLeft }],
  }
}

/**
 * Advances the simulation by exactly one fixed tick. The browser runs as many
 * ticks as real time allows; the server replays the same ticks to verify runs.
 */
export function tick(state: GameState): StepResult {
  if (state.status === 'ready') return { state: moveAllBalls(state, TICK_SECONDS), events: [] }
  if (state.status !== 'playing') return { state, events: [] }

  const events: GameEvent[] = []
  const simulated = simulate(state, events)
  return { state: settle(simulated, events), events }
}

function moveAllBalls(state: GameState, dt: number): GameState {
  const moved = state.balls.map((ball) => moveBall(ball, state.grid, dt))
  return { ...state, balls: resolveBallPairs(moved) }
}

const findHit = (balls: readonly Ball[], wall: WallHalf): Ball | undefined => {
  if (wall.length <= 0) return undefined
  const rect = wallRect(wall)
  return balls.find((ball) => circleIntersectsRect(ball.x, ball.y, ball.radius, rect))
}

function simulate(state: GameState, events: GameEvent[]): GameState {
  const moved = moveAllBalls(state, TICK_SECONDS)
  let { grid, score, stats } = moved
  const growing: WallHalf[] = []
  const broken: Array<{ readonly wall: WallHalf; readonly ballId: number }> = []

  for (const wall of moved.walls) {
    const advanced = advanceWall(wall, grid, moved.config.wallSpeed * TICK_SECONDS)

    const hit = findHit(moved.balls, advanced.wall)
    if (hit) {
      broken.push({ wall: advanced.wall, ballId: hit.id })
      continue
    }
    if (!advanced.completed) {
      growing.push(advanced.wall)
      continue
    }

    const solidBefore = grid.solidInteriorCount
    const walled = fillCells(grid, wallCells(advanced.wall, grid.cols), CELL_WALL)
    const capture = captureEnclosedAreas(walled, moved.balls)
    grid = capture.grid

    const percentGained = ((grid.solidInteriorCount - solidBefore) / grid.interiorCount) * 100
    const points = capturePoints(percentGained, moved.level)
    const smallestRegion = capture.orbRegionSizes.length > 0 ? Math.min(...capture.orbRegionSizes) : null
    score += points
    stats = statsAfterCapture(stats, {
      percentGained,
      capturedRegions: capture.capturedRegions,
      tightestRegionPct: smallestRegion === null ? null : (smallestRegion / grid.interiorCount) * 100,
    })
    events.push({
      type: 'wallCompleted',
      wall: advanced.wall,
      wallCells: walled.solidInteriorCount - solidBefore,
      capturedCells: capture.captured,
      capturedRegions: capture.capturedRegions,
      percentGained,
      points,
      runs: capture.runs,
    })
  }

  let { lives, levelLivesLost } = moved
  // Both halves breaking in the same instant (an orb right at the click) is one mistake: one life.
  if (broken.length > 0) {
    levelLivesLost += 1
    if (moved.rules.livesPolicy !== 'infinite') lives = Math.max(0, lives - 1)
    stats = statsAfterWallsBroken(stats, broken.length)
    for (const { wall, ballId } of broken) events.push({ type: 'wallBroken', wall, ballId, livesLeft: lives })
  }

  return {
    ...moved,
    grid,
    score,
    stats,
    lives,
    levelLivesLost,
    walls: growing,
    levelTicks: moved.levelTicks + 1,
    tick: moved.tick + 1,
  }
}

function gameOverReason(state: GameState): GameOverReason | null {
  if (state.rules.livesPolicy !== 'infinite' && state.lives <= 0) return 'lives'
  if (state.config.timeLimitTicks !== null && state.levelTicks >= state.config.timeLimitTicks) return 'time'
  if (state.wallsLeft === 0 && state.walls.length === 0) return 'walls'
  return null
}

/** Ends the level or the run when a condition is met. Clearing the level always wins. */
function settle(state: GameState, events: GameEvent[]): GameState {
  const percent = capturedPercent(state.grid)
  if (percent >= state.config.targetPercent) {
    const result = computeLevelResult({
      config: state.config,
      rules: state.rules,
      percent,
      levelTicks: state.levelTicks,
      livesLeft: state.lives,
      wallsLeft: state.wallsLeft,
    })
    events.push({ type: 'levelComplete', result })
    return {
      ...state,
      status: 'levelComplete',
      walls: [],
      score: state.score + result.totalBonus,
      lastResult: result,
      stats: statsAfterLevelClear(state.stats, {
        percent,
        elapsedMs: result.elapsedMs,
        parSeconds: state.config.parSeconds,
        livesLost: state.levelLivesLost,
        wallsUsed: state.levelWallsUsed,
        orbCount: state.config.orbCount,
      }),
    }
  }

  const reason = gameOverReason(state)
  if (!reason) return state
  events.push({ type: 'gameOver', level: state.level, score: state.score, reason })
  return { ...state, status: 'gameOver', walls: [], gameOverReason: reason }
}
