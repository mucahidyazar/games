/**
 * Core data model of the Trap The Orb engine.
 *
 * Coordinates are expressed in grid cells: the cell (col, row) spans
 * x ∈ [col, col + 1) and y ∈ [row, row + 1). Every value object is treated as
 * immutable — engine functions always return new objects instead of mutating.
 */

export const CELL_FREE = 0
export const CELL_WALL = 1
export const CELL_CAPTURED = 2

export type CellState = typeof CELL_FREE | typeof CELL_WALL | typeof CELL_CAPTURED

export type Orientation = 'vertical' | 'horizontal'

/** Landscape is 300 × 150 cells; portrait is the same field turned on its side. */
export type FieldOrientation = 'landscape' | 'portrait'

export type GameStatus = 'ready' | 'playing' | 'paused' | 'levelComplete' | 'gameOver'

export type GameOverReason = 'lives' | 'time' | 'walls'

// ------------------------------------------------------------------ modes

export type GameMode = 'classic' | 'daily' | 'timeAttack' | 'limitedWalls' | 'hardcore' | 'zen' | 'custom'

/** Lives reset every level, last for the whole run, or never run out. */
export type LivesPolicy = 'perLevel' | 'perRun' | 'infinite'

/** Player-made rules for the unranked Custom mode. */
export interface CustomSettings {
  readonly orbCount: number
  /** Orb speed multiplier (1 = calm). */
  readonly speed: number
  /** Lives per round; null means unlimited. */
  readonly lives: number | null
  /** Walls per round; null means unlimited. */
  readonly walls: number | null
  /** Countdown per round; null means no time limit. */
  readonly timeLimitSeconds: number | null
  readonly targetPercent: number
}

export interface ModeRules {
  readonly mode: GameMode
  /** Ranked modes have fixed rules and appear on leaderboards. */
  readonly ranked: boolean
  readonly livesPolicy: LivesPolicy
  /** Lives for the entire run when `livesPolicy` is 'perRun'. */
  readonly runLives: number
  /** Each level has a countdown. */
  readonly timed: boolean
  /** Each level has a wall budget. */
  readonly limitedWalls: boolean
  readonly custom: CustomSettings | null
}

// ------------------------------------------------------------------ field

export interface GridDims {
  readonly cols: number
  readonly rows: number
}

export interface Grid extends GridDims {
  /** Row-major cell states. Never mutated once a grid has been returned. */
  readonly cells: Uint8Array
  /** Cells inside the permanent border ring. */
  readonly interiorCount: number
  /** Interior cells that are walls or captured territory. */
  readonly solidInteriorCount: number
  /** Incremented on every change so renderers can cache static layers. */
  readonly version: number
}

export interface Rect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface Ball {
  readonly id: number
  readonly x: number
  readonly y: number
  /** Velocity in cells per second. */
  readonly vx: number
  readonly vy: number
  readonly radius: number
  /** Speed tier (0 calm … 3 blazing); the renderer colours orbs by it. */
  readonly tier: number
}

/** One of the two halves of a wall that grow away from the click point. */
export interface WallHalf {
  readonly id: number
  readonly orientation: Orientation
  /** Column of a vertical wall, row of a horizontal wall. */
  readonly line: number
  /** Position along the growth axis where the wall started. */
  readonly origin: number
  readonly direction: -1 | 1
  /** How far the tip has travelled from the origin, in cells. */
  readonly length: number
}

// ------------------------------------------------------------------ levels

/** What changed compared with the previous level — shown to the player. */
export type LevelChange = 'first' | 'newOrb' | 'speedUp' | 'breather' | 'repeat'

export interface LevelConfig {
  readonly level: number
  readonly orbCount: number
  /** Speed tier of each orb. */
  readonly orbTiers: readonly number[]
  /** Speed of each orb per axis, in cells per second. */
  readonly orbSpeeds: readonly number[]
  /** Lives granted at the start of the level (ignored for per-run and infinite lives). */
  readonly lives: number
  readonly wallBudget: number | null
  readonly timeLimitTicks: number | null
  /** Wall growth speed, in cells per second. */
  readonly wallSpeed: number
  readonly targetPercent: number
  readonly parSeconds: number
  readonly change: LevelChange
}

export interface LevelResult {
  readonly level: number
  readonly percent: number
  readonly elapsedMs: number
  readonly livesLeft: number
  readonly wallsLeft: number | null
  readonly areaBonus: number
  readonly livesBonus: number
  readonly timeBonus: number
  readonly wallBonus: number
  readonly totalBonus: number
}

/** A horizontal run of cells on one row, `end` exclusive. */
export interface CellRun {
  readonly row: number
  readonly start: number
  readonly end: number
}

// ------------------------------------------------------------------ stats

/** Notable moments of a run, used for badges and record leaderboards. */
export interface RunStats {
  readonly levelsCleared: number
  /** Highest level reached (started). */
  readonly highestLevel: number
  readonly wallsBuilt: number
  readonly wallsBroken: number
  /** Smallest region an orb was confined to, as a share of the field (%). */
  readonly tightestTrapPct: number | null
  /** Largest share of the field claimed by a single wall (%). */
  readonly biggestCapturePct: number
  /** Highest captured share when clearing a level (%). */
  readonly bestClearPct: number | null
  /** Levels cleared in a row without losing a life (current streak). */
  readonly perfectStreak: number
  readonly bestPerfectStreak: number
  /** Quickest clear as a share of the level's par time (0.5 = twice as fast as par). */
  readonly fastestClearRatio: number | null
  /** Most separate regions captured by a single wall. */
  readonly maxRegionsInOneWall: number
  /** Fewest walls used to clear a level with at least three orbs. */
  readonly fewestWallsClear: number | null
}

// ------------------------------------------------------------------ state

export interface GameState {
  readonly status: GameStatus
  readonly rules: ModeRules
  readonly field: FieldOrientation
  readonly level: number
  readonly config: LevelConfig
  readonly lives: number
  readonly score: number
  /** Score when the current level began — restored by "restart level". */
  readonly levelStartScore: number
  /** Ticks simulated in the current level. */
  readonly levelTicks: number
  /** Ticks simulated since the run started; recorded inputs refer to it. */
  readonly tick: number
  readonly grid: Grid
  readonly balls: readonly Ball[]
  /** Orb positions when the level was built — where play starts from. */
  readonly spawnBalls: readonly Ball[]
  /** Wall halves currently under construction (0–2). */
  readonly walls: readonly WallHalf[]
  /** Walls left in this level, or null when unlimited. */
  readonly wallsLeft: number | null
  readonly levelLivesLost: number
  readonly levelWallsUsed: number
  readonly rngSeed: number
  readonly nextId: number
  readonly stats: RunStats
  readonly lastResult: LevelResult | null
  readonly gameOverReason: GameOverReason | null
}

export type WallRejectReason = 'notPlaying' | 'busy' | 'solid' | 'noWalls'

export type GameEvent =
  | {
      readonly type: 'wallStarted'
      readonly orientation: Orientation
      readonly col: number
      readonly row: number
      readonly wallsLeft: number | null
    }
  | { readonly type: 'wallRejected'; readonly reason: WallRejectReason }
  | {
      readonly type: 'wallCompleted'
      readonly wall: WallHalf
      readonly wallCells: number
      readonly capturedCells: number
      /** Separate regions captured by this wall. */
      readonly capturedRegions: number
      readonly percentGained: number
      readonly points: number
      readonly runs: readonly CellRun[]
    }
  | {
      readonly type: 'wallBroken'
      readonly wall: WallHalf
      readonly ballId: number
      readonly livesLeft: number
    }
  | { readonly type: 'levelComplete'; readonly result: LevelResult }
  | {
      readonly type: 'gameOver'
      readonly level: number
      readonly score: number
      readonly reason: GameOverReason
    }

export interface StepResult {
  readonly state: GameState
  readonly events: readonly GameEvent[]
}
