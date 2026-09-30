/** Every run uses the same field: 300 × 150 cells, or that field turned on its side for portrait screens. */
export const FIELD_LONG_SIDE = 300
export const FIELD_SHORT_SIDE = 150

/** Orb radius in cells (≈ 2.2% of the short side). */
export const BALL_RADIUS = 3.3
/** Orb speed per axis at the calm tier, in cells per second. */
export const BASE_BALL_SPEED = 50
/** Speed multipliers of the orb tiers: calm, quick, fast, blazing. */
export const SPEED_TIERS: readonly number[] = [1, 1.2, 1.4, 1.6]
export const MAX_SPEED_TIER = SPEED_TIERS.length - 1
/** Wall growth speed in cells per second. */
export const WALL_SPEED = 105

export const TARGET_PERCENT = 75

/** The simulation advances in fixed ticks, so a recorded run can be replayed exactly (server-side verification). */
export const TICKS_PER_SECOND = 120
export const TICK_SECONDS = 1 / TICKS_PER_SECOND

export const POINTS_PER_PERCENT = 10
export const AREA_BONUS_PER_PERCENT = 50
export const LIFE_BONUS = 100
export const TIME_BONUS_PER_SECOND = 5
/** Limited Walls: bonus per wall left unused when the level is cleared. */
export const WALL_BONUS = 50

export const PAR_BASE_SECONDS = 20
export const PAR_SECONDS_PER_ORB = 10
/** Time Attack: countdown per level. */
export const TIME_LIMIT_BASE_SECONDS = 30
export const TIME_LIMIT_SECONDS_PER_ORB = 15
/** Limited Walls: walls available per level. */
export const WALL_BUDGET_BASE = 4
export const WALL_BUDGET_PER_ORB = 2
/** Hardcore: lives for the entire run. */
export const HARDCORE_LIVES = 1
