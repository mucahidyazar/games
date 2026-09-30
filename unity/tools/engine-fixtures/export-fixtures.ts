/**
 * Exports golden fixtures from the TypeScript engine for the C# port's parity tests.
 *
 *   packages/trap-the-orb-engine/node_modules/.bin/tsx unity/tools/engine-fixtures/export-fixtures.ts
 *
 * Every double is written as its IEEE-754 bit pattern (16 hex digits), so the C#
 * tests compare exact values instead of trusting decimal round trips.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  advanceToNextLevel,
  BADGES,
  captureEnclosedAreas,
  CELL_WALL,
  createRun,
  CUSTOM_PRESETS,
  dailySeed,
  evaluateRunBadges,
  fillCells,
  getLevelConfig,
  isSolid,
  nextRandom,
  placeWall,
  previewExtent,
  replayRun,
  rulesFor,
  sanitizeCustomSettings,
  startGame,
  tick,
  type Ball,
  type CustomSettings,
  type FieldOrientation,
  type GameEvent,
  type GameMode,
  type GameState,
  type RunInput,
  type RunStats,
  type WallHalf,
} from '../../../packages/trap-the-orb-engine/src/index.ts'

const OUTPUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../TrapTheOrb/Assets/_Project/Tests/EditMode/Fixtures',
)

const bits = (value: number): string => {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  return view.getBigUint64(0).toString(16).padStart(16, '0')
}
const optionalBits = (value: number | null): string | null => (value === null ? null : bits(value))

/** FNV-1a over the cell states: a short fingerprint of a whole grid. */
function gridHash(cells: Uint8Array): number {
  let hash = 0x811c9dc5
  for (const cell of cells) {
    hash ^= cell
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const ballJson = (ball: Ball) => ({
  id: ball.id,
  x: bits(ball.x),
  y: bits(ball.y),
  vx: bits(ball.vx),
  vy: bits(ball.vy),
  radius: bits(ball.radius),
  tier: ball.tier,
})

const wallJson = (wall: WallHalf) => ({
  id: wall.id,
  orientation: wall.orientation,
  line: wall.line,
  origin: wall.origin,
  direction: wall.direction,
  length: bits(wall.length),
})

const statsJson = (stats: RunStats) => ({
  levelsCleared: stats.levelsCleared,
  highestLevel: stats.highestLevel,
  wallsBuilt: stats.wallsBuilt,
  wallsBroken: stats.wallsBroken,
  tightestTrapPct: optionalBits(stats.tightestTrapPct),
  biggestCapturePct: bits(stats.biggestCapturePct),
  bestClearPct: optionalBits(stats.bestClearPct),
  perfectStreak: stats.perfectStreak,
  bestPerfectStreak: stats.bestPerfectStreak,
  fastestClearRatio: optionalBits(stats.fastestClearRatio),
  maxRegionsInOneWall: stats.maxRegionsInOneWall,
  fewestWallsClear: stats.fewestWallsClear,
})

function snapshot(state: GameState) {
  return {
    status: state.status,
    level: state.level,
    lives: state.lives,
    score: state.score,
    levelStartScore: state.levelStartScore,
    levelTicks: state.levelTicks,
    tick: state.tick,
    wallsLeft: state.wallsLeft,
    levelLivesLost: state.levelLivesLost,
    levelWallsUsed: state.levelWallsUsed,
    rngSeed: state.rngSeed,
    nextId: state.nextId,
    gameOverReason: state.gameOverReason,
    grid: {
      cols: state.grid.cols,
      rows: state.grid.rows,
      solidInteriorCount: state.grid.solidInteriorCount,
      version: state.grid.version,
      hash: gridHash(state.grid.cells),
    },
    balls: state.balls.map(ballJson),
    walls: state.walls.map(wallJson),
    stats: statsJson(state.stats),
    lastResult: state.lastResult && {
      level: state.lastResult.level,
      percent: bits(state.lastResult.percent),
      elapsedMs: state.lastResult.elapsedMs,
      livesLeft: state.lastResult.livesLeft,
      wallsLeft: state.lastResult.wallsLeft,
      areaBonus: state.lastResult.areaBonus,
      livesBonus: state.lastResult.livesBonus,
      timeBonus: state.lastResult.timeBonus,
      wallBonus: state.lastResult.wallBonus,
      totalBonus: state.lastResult.totalBonus,
    },
  }
}

function eventJson(event: GameEvent) {
  switch (event.type) {
    case 'wallStarted':
      return { type: event.type, orientation: event.orientation, col: event.col, row: event.row, wallsLeft: event.wallsLeft }
    case 'wallRejected':
      return { type: event.type, reason: event.reason }
    case 'wallCompleted':
      return {
        type: event.type,
        wall: wallJson(event.wall),
        wallCells: event.wallCells,
        capturedCells: event.capturedCells,
        capturedRegions: event.capturedRegions,
        percentGained: bits(event.percentGained),
        points: event.points,
        runs: event.runs.length,
        runsHash: gridHash(Uint8Array.from(event.runs.flatMap((run) => [run.row & 255, run.start & 255, run.end & 255]))),
      }
    case 'wallBroken':
      return { type: event.type, wall: wallJson(event.wall), ballId: event.ballId, livesLeft: event.livesLeft }
    case 'levelComplete':
      return { type: event.type, level: event.result.level, totalBonus: event.result.totalBonus }
    case 'gameOver':
      return { type: event.type, level: event.level, score: event.score, reason: event.reason }
  }
}

// ------------------------------------------------------------------ random

function randomFixture() {
  const seeds = [0, 1, 7, 42, 3735928559, 4294967295, 123456789]
  return {
    sequences: seeds.map((seed) => {
      const draws: Array<{ value: string; next: number }> = []
      let current = seed
      for (let i = 0; i < 24; i++) {
        const [value, next] = nextRandom(current)
        draws.push({ value: bits(value), next })
        current = next
      }
      return { seed, draws }
    }),
    daily: ['2026-01-01', '2026-06-15', '2026-09-27', '2027-02-28', '2030-12-31'].map((date) => ({
      date,
      seed: dailySeed(date),
    })),
  }
}

// ------------------------------------------------------------------ levels

function levelsFixture() {
  const setups: Array<{ name: string; mode: GameMode; custom?: CustomSettings }> = [
    { name: 'classic', mode: 'classic' },
    { name: 'daily', mode: 'daily' },
    { name: 'timeAttack', mode: 'timeAttack' },
    { name: 'limitedWalls', mode: 'limitedWalls' },
    { name: 'hardcore', mode: 'hardcore' },
    { name: 'zen', mode: 'zen' },
    ...Object.entries(CUSTOM_PRESETS).map(([preset, custom]) => ({ name: `custom.${preset}`, mode: 'custom' as const, custom })),
  ]
  const levels = [...Array.from({ length: 60 }, (_, i) => i + 1), 75, 99, 100, 250, 500, 1000, 9999, 10000, 0, -3]

  return setups.map(({ name, mode, custom }) => {
    const rules = rulesFor(mode, custom)
    return {
      name,
      mode,
      custom: custom ?? null,
      rules: {
        ranked: rules.ranked,
        livesPolicy: rules.livesPolicy,
        runLives: rules.runLives,
        timed: rules.timed,
        limitedWalls: rules.limitedWalls,
      },
      levels: levels.map((level) => {
        const config = getLevelConfig(level, rules)
        return {
          input: level,
          level: config.level,
          orbCount: config.orbCount,
          orbTiers: config.orbTiers,
          orbSpeeds: config.orbSpeeds.map(bits),
          lives: config.lives,
          wallBudget: config.wallBudget,
          timeLimitTicks: config.timeLimitTicks,
          wallSpeed: bits(config.wallSpeed),
          targetPercent: config.targetPercent,
          parSeconds: config.parSeconds,
          change: config.change,
        }
      }),
    }
  })
}

// ------------------------------------------------------------------ custom settings

function customFixture() {
  const inputs: unknown[] = [
    null,
    {},
    { orbCount: 0, speed: 0.1, lives: 0, walls: 1, timeLimitSeconds: 5, targetPercent: 10 },
    { orbCount: 99, speed: 9, lives: 99, walls: 99, timeLimitSeconds: 9999, targetPercent: 100 },
    { orbCount: 4.5, speed: 1.25, lives: null, walls: null, timeLimitSeconds: null, targetPercent: 80.5 },
    { orbCount: 2.5, speed: 1.35, lives: 3.5, walls: 7.49, timeLimitSeconds: 44.5, targetPercent: 60.4999 },
    { orbCount: -1.5, speed: 1.05, lives: -2.5, walls: 12.5, timeLimitSeconds: 125.5, targetPercent: 72.5 },
    { speed: 0.65 },
    { speed: 1.95 },
  ]
  return inputs.map((input) => ({ input, output: sanitizeCustomSettings(input) }))
}

// ------------------------------------------------------------------ replays

interface Session {
  readonly name: string
  readonly mode: GameMode
  readonly seed: number
  readonly field: FieldOrientation
  readonly custom?: CustomSettings
  readonly ticks: number
  readonly style: 'careful' | 'reckless' | 'chaos' | 'smart'
}

interface Choice {
  readonly c: number
  readonly r: number
  readonly o: 'v' | 'h'
  readonly seed: number
}

const SMART_STRIDE = 5
/** Extra cells of clearance the smart player keeps between an orb and a wall it builds. */
const SMART_MARGIN = 2

/**
 * A decent player: tries walls on a coarse lattice, keeps those no orb can reach
 * before they finish, and builds the one that captures the most area.
 */
function smartChoice(state: GameState, seed: number): Choice | null {
  const { grid, balls, config } = state
  let best: { choice: Choice; captured: number } | null = null

  for (let row = 1; row < grid.rows - 1; row += SMART_STRIDE) {
    for (let col = 1; col < grid.cols - 1; col += SMART_STRIDE) {
      if (isSolid(grid, col, row)) continue
      for (const o of ['v', 'h'] as const) {
        const orientation = o === 'v' ? 'vertical' : 'horizontal'
        const extent = previewExtent(grid, col, row, orientation)
        if (!extent) continue
        const at = o === 'v' ? row : col
        const longestHalf = Math.max(at + 1 - extent.start, extent.end - (at + 1))
        const seconds = longestHalf / config.wallSpeed + 0.05
        const safe = balls.every((ball) => {
          const across = o === 'v' ? Math.abs(ball.x - (col + 0.5)) : Math.abs(ball.y - (row + 0.5))
          const along = o === 'v' ? ball.y : ball.x
          const reach = Math.abs(o === 'v' ? ball.vx : ball.vy) * seconds + ball.radius + 0.5 + SMART_MARGIN
          const outsideSpan = along + ball.radius < extent.start - 0.5 || along - ball.radius > extent.end + 0.5
          return outsideSpan || across > reach
        })
        if (!safe) continue
        const cells: number[] = []
        for (let index = extent.start; index < extent.end; index++) {
          cells.push(o === 'v' ? index * grid.cols + col : row * grid.cols + index)
        }
        const captured = captureEnclosedAreas(fillCells(grid, cells, CELL_WALL), balls).captured
        if (!best || captured > best.captured) best = { choice: { c: col, r: row, o, seed }, captured }
      }
    }
  }
  return best && best.captured > 0 ? best.choice : null
}

/** Picks a free cell, playing roughly like a person (same rules as the engine's replay tests). */
function chooseCell(state: GameState, style: Session['style'], drawSeed: number): Choice | null {
  if (style === 'smart') return state.walls.length === 0 ? smartChoice(state, drawSeed) : null
  if (style === 'chaos') {
    const [rx, s1] = nextRandom(drawSeed)
    const [ry, s2] = nextRandom(s1)
    const [ro, s3] = nextRandom(s2)
    return {
      c: Math.floor(rx * state.grid.cols),
      r: Math.floor(ry * state.grid.rows),
      o: ro < 0.5 ? 'v' : 'h',
      seed: s3,
    }
  }
  const row = Math.floor(state.grid.rows / 2)
  if (style === 'reckless') {
    const ball = state.balls[0]
    return ball ? { c: Math.floor(ball.x), r: Math.floor(ball.y), o: 'v', seed: drawSeed } : null
  }
  for (let col = 8; col < state.grid.cols - 8; col += 11) {
    const clear = state.balls.every((ball) => Math.abs(ball.x - col) > 14)
    if (clear && !isSolid(state.grid, col, row)) return { c: col, r: row, o: 'v', seed: drawSeed }
  }
  const col = Math.floor(state.grid.cols / 2)
  for (let r = 8; r < state.grid.rows - 8; r += 11) {
    const clear = state.balls.every((ball) => Math.abs(ball.y - r) > 14)
    if (clear && !isSolid(state.grid, col, r)) return { c: col, r, o: 'h', seed: drawSeed }
  }
  return null
}

function playSession(session: Session): { inputs: RunInput[]; endTick: number } {
  let state = startGame(createRun({ mode: session.mode, seed: session.seed, field: session.field, custom: session.custom }))
  const inputs: RunInput[] = []
  let drawSeed = session.seed ^ 0x5bd1e995

  while (state.tick < session.ticks && state.status !== 'gameOver') {
    if (state.status === 'levelComplete') {
      state = advanceToNextLevel(state)
      continue
    }
    const period = session.style === 'chaos' ? 20 : session.style === 'smart' ? 12 : 45
    if (state.tick % period === 0) {
      const cell = chooseCell(state, session.style, drawSeed)
      if (cell) {
        drawSeed = cell.seed
        const placed = placeWall(state, { col: cell.c, row: cell.r, orientation: cell.o === 'v' ? 'vertical' : 'horizontal' })
        // Refused inputs are recorded too: the replay must refuse them the same way.
        if (session.style === 'chaos' || placed.events.some((event) => event.type === 'wallStarted')) {
          inputs.push({ t: state.tick, c: cell.c, r: cell.r, o: cell.o })
        }
        state = placed.state
      }
    }
    state = tick(state).state
  }
  return { inputs, endTick: state.tick }
}

const CHECKPOINT_EVERY = 480

/** replayRun, instrumented: snapshots every few seconds, at every level end and at the end. */
function recordReplay(session: Session, inputs: readonly RunInput[], endTick: number) {
  let state = startGame(createRun({ mode: session.mode, seed: session.seed, field: session.field, custom: session.custom }))
  const checkpoints: Array<ReturnType<typeof snapshot> & { reason: string }> = []
  const events: Array<{ tick: number; event: ReturnType<typeof eventJson> }> = []
  let next = 0

  checkpoints.push({ reason: 'start', ...snapshot(state) })
  while (state.status !== 'gameOver') {
    if (state.status === 'levelComplete') {
      if (state.tick >= endTick) break
      state = advanceToNextLevel(state)
      checkpoints.push({ reason: 'levelStart', ...snapshot(state) })
      continue
    }
    while (next < inputs.length && inputs[next]?.t === state.tick) {
      const input = inputs[next] as RunInput
      const placed = placeWall(state, {
        col: input.c,
        row: input.r,
        orientation: input.o === 'v' ? 'vertical' : 'horizontal',
      })
      for (const event of placed.events) events.push({ tick: state.tick, event: eventJson(event) })
      state = placed.state
      next++
    }
    if (state.tick >= endTick) break
    const result = tick(state)
    for (const event of result.events) events.push({ tick: result.state.tick, event: eventJson(event) })
    state = result.state
    if (state.tick % CHECKPOINT_EVERY === 0) checkpoints.push({ reason: 'interval', ...snapshot(state) })
    if (state.status === 'levelComplete') checkpoints.push({ reason: 'levelComplete', ...snapshot(state) })
  }
  checkpoints.push({ reason: 'end', ...snapshot(state) })

  const replayed = replayRun({ mode: session.mode, seed: session.seed, field: session.field, custom: session.custom, inputs, endTick })
  return {
    checkpoints,
    events,
    result: {
      status: replayed.status,
      gameOverReason: replayed.gameOverReason,
      score: replayed.score,
      level: replayed.level,
      levelsCleared: replayed.levelsCleared,
      tick: replayed.tick,
      acceptedInputs: replayed.acceptedInputs,
      stats: statsJson(replayed.stats),
      badges: evaluateRunBadges(replayed.stats, session.mode),
    },
  }
}

function replaysFixture() {
  const chaosCustom = { ...CUSTOM_PRESETS.expert, lives: null, walls: null, timeLimitSeconds: null }
  const sessions: Session[] = [
    { name: 'classic-smart', mode: 'classic', seed: 11, field: 'landscape', ticks: 21600, style: 'smart' },
    { name: 'classic-smart-portrait', mode: 'classic', seed: 21, field: 'portrait', ticks: 21600, style: 'smart' },
    { name: 'daily-smart-portrait', mode: 'daily', seed: dailySeed('2026-09-27'), field: 'portrait', ticks: 14400, style: 'smart' },
    { name: 'timeAttack-smart-portrait', mode: 'timeAttack', seed: 5, field: 'portrait', ticks: 14400, style: 'smart' },
    { name: 'limitedWalls-smart', mode: 'limitedWalls', seed: 6, field: 'landscape', ticks: 14400, style: 'smart' },
    { name: 'hardcore-smart', mode: 'hardcore', seed: 13, field: 'portrait', ticks: 14400, style: 'smart' },
    { name: 'custom-hard-smart', mode: 'custom', seed: 9, field: 'landscape', ticks: 14400, style: 'smart', custom: CUSTOM_PRESETS.hard },
    { name: 'classic-careful', mode: 'classic', seed: 11, field: 'landscape', ticks: 9000, style: 'careful' },
    { name: 'hardcore-reckless', mode: 'hardcore', seed: 3, field: 'landscape', ticks: 5000, style: 'reckless' },
    { name: 'zen-reckless', mode: 'zen', seed: 8, field: 'portrait', ticks: 4000, style: 'reckless' },
    { name: 'custom-chaos', mode: 'custom', seed: 2024, field: 'portrait', ticks: 6000, style: 'chaos', custom: chaosCustom },
    { name: 'classic-chaos', mode: 'classic', seed: 77, field: 'landscape', ticks: 5000, style: 'chaos' },
  ]

  return sessions.map((session) => {
    const { inputs, endTick } = playSession(session)
    return {
      name: session.name,
      mode: session.mode,
      seed: session.seed,
      field: session.field,
      custom: session.custom ?? null,
      endTick,
      inputs,
      ...recordReplay(session, inputs, endTick),
    }
  })
}

// ------------------------------------------------------------------ badges

function badgesFixture() {
  return BADGES.map((badge) => ({
    id: badge.id,
    direction: badge.direction,
    thresholds: badge.thresholds.map(bits),
    modes: badge.modes,
    source: badge.source,
  }))
}

// ------------------------------------------------------------------ main

mkdirSync(OUTPUT_DIR, { recursive: true })
const write = (name: string, data: unknown): void => {
  writeFileSync(join(OUTPUT_DIR, name), `${JSON.stringify(data)}\n`)
  console.log(`wrote ${name}`)
}

write('random.json', randomFixture())
write('levels.json', levelsFixture())
write('custom-settings.json', customFixture())
write('badges.json', badgesFixture())
write('replays.json', replaysFixture())
