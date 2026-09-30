import { FIELD_LONG_SIDE, MAX_RUN_TICKS } from '@games/trap-the-orb-engine'
import * as z from 'zod/mini'

/** Upper bound on recorded walls per run (a wall every half second for 40 minutes). */
export const MAX_RUN_INPUTS = 5000

const cellIndex = z.int().check(z.gte(0), z.lte(FIELD_LONG_SIDE - 1))

export const gameModeSchema = z.enum(['classic', 'daily', 'timeAttack', 'limitedWalls', 'hardcore', 'zen', 'custom'])
export const rankedModeSchema = z.enum(['classic', 'daily', 'timeAttack', 'limitedWalls', 'hardcore'])
export const fieldSchema = z.enum(['landscape', 'portrait'])
export const boardIdSchema = z.enum([
  'score.classic',
  'score.daily',
  'score.timeAttack',
  'score.limitedWalls',
  'score.hardcore',
  'stat.tightestTrap',
  'stat.biggestCapture',
  'stat.flawlessStreak',
  'stat.badges',
])
export const periodSchema = z.enum(['day', 'week', 'all'])
export const badgeIdSchema = z.enum([
  'climber',
  'squeeze',
  'landGrab',
  'overachiever',
  'flawless',
  'lightning',
  'doubleTrap',
  'architect',
  'survivor',
  'beatTheClock',
  'frugal',
  'devotee',
])
export const badgeTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])
const isoDate = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/))

// ------------------------------------------------------------------ runs

export const runInputSchema = z.object({
  t: z.int().check(z.gte(0), z.lte(MAX_RUN_TICKS)),
  c: cellIndex,
  r: cellIndex,
  o: z.enum(['v', 'h']),
})

/** POST /api/runs — start a ranked run; the server picks the seed. */
export const startRunRequestSchema = z.object({ mode: rankedModeSchema, field: fieldSchema })

export const startRunResponseSchema = z.object({
  runId: z.string(),
  seed: z.int(),
  mode: rankedModeSchema,
  field: fieldSchema,
  /** UTC day of a Daily Challenge run, otherwise null. */
  dailyDate: z.nullable(isoDate),
  /** False for a repeat Daily Challenge attempt: it is replayed and scored, but never ranked. */
  ranked: z.boolean(),
})

/** POST /api/runs/:id/finish — the recording the server replays. */
export const finishRunRequestSchema = z.object({
  endTick: z.int().check(z.gte(0), z.lte(MAX_RUN_TICKS)),
  inputs: z.array(runInputSchema).check(z.maxLength(MAX_RUN_INPUTS)),
  /** What the browser computed — logged when it disagrees with the replay, never trusted. */
  clientScore: z.int().check(z.gte(0)),
  clientLevel: z.int().check(z.gte(1)),
})

export const runStatsSchema = z.object({
  levelsCleared: z.int(),
  highestLevel: z.int(),
  wallsBuilt: z.int(),
  wallsBroken: z.int(),
  tightestTrapPct: z.nullable(z.number()),
  biggestCapturePct: z.number(),
  bestClearPct: z.nullable(z.number()),
  perfectStreak: z.int(),
  bestPerfectStreak: z.int(),
  fastestClearRatio: z.nullable(z.number()),
  maxRegionsInOneWall: z.int(),
  fewestWallsClear: z.nullable(z.int()),
})

export const earnedBadgeSchema = z.object({ id: badgeIdSchema, tier: badgeTierSchema })

export const recordUpdateSchema = z.object({
  board: boardIdSchema,
  period: periodSchema,
  /** Storage key of the table, e.g. score.classic:week:2026-W39. */
  key: z.string(),
  value: z.number(),
  rank: z.int(),
  /** True when this run beat the player's previous best on that table. */
  improved: z.boolean(),
})

export const finishRunResponseSchema = z.object({
  result: z.object({
    status: z.enum(['playing', 'levelComplete', 'gameOver']),
    gameOverReason: z.nullable(z.enum(['lives', 'time', 'walls'])),
    score: z.int(),
    level: z.int(),
    levelsCleared: z.int(),
    stats: runStatsSchema,
  }),
  /** False for Daily Challenge replays after the first attempt of the day. */
  ranked: z.boolean(),
  newBadges: z.array(earnedBadgeSchema),
  records: z.array(recordUpdateSchema),
})

// ------------------------------------------------------------------ leaderboards

/** GET /api/leaderboards?board=…&period=…&date=YYYY-MM-DD */
export const leaderboardQuerySchema = z.object({
  board: boardIdSchema,
  period: periodSchema,
  date: z.optional(isoDate),
})

export const leaderboardEntrySchema = z.object({
  rank: z.int(),
  nickname: z.string(),
  value: z.number(),
  /** Level reached, for score tables. */
  level: z.nullable(z.int()),
  achievedAt: z.string(),
})

export const leaderboardResponseSchema = z.object({
  board: boardIdSchema,
  period: periodSchema,
  key: z.string(),
  entries: z.array(leaderboardEntrySchema),
  /** The signed-in player's own row, even when outside the top entries. */
  me: z.nullable(z.object({ rank: z.int(), value: z.number() })),
})

// ------------------------------------------------------------------ profile

/** Public display name: 3–16 letters, digits, spaces, dots, dashes or underscores. */
export const nicknameSchema = z
  .string()
  .check(z.trim(), z.minLength(3), z.maxLength(16), z.regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u))

/** PUT /api/me/profile */
export const updateProfileRequestSchema = z.object({ nickname: nicknameSchema })

/** GET /api/me */
export const meResponseSchema = z.object({
  user: z.object({ id: z.string(), email: z.string(), name: z.string(), image: z.nullable(z.string()) }),
  /** Null until the player picks a nickname. */
  profile: z.nullable(z.object({ nickname: z.string() })),
  badges: z.array(z.object({ id: badgeIdSchema, tier: badgeTierSchema, earnedAt: z.string() })),
  records: z.array(z.object({ board: boardIdSchema, key: z.string(), value: z.number(), achievedAt: z.string() })),
  dailyStreak: z.int(),
  /** Today's (UTC) ranked Daily Challenge attempt is used up; further attempts are practice. */
  dailyPlayedToday: z.boolean(),
})

/** Every error response: { error: { code, message } }. */
export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

export type RunInputDto = z.infer<typeof runInputSchema>
export type StartRunRequest = z.infer<typeof startRunRequestSchema>
export type StartRunResponse = z.infer<typeof startRunResponseSchema>
export type FinishRunRequest = z.infer<typeof finishRunRequestSchema>
export type FinishRunResponse = z.infer<typeof finishRunResponseSchema>
export type RecordUpdate = z.infer<typeof recordUpdateSchema>
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>
export type MeResponse = z.infer<typeof meResponseSchema>
export type ApiError = z.infer<typeof apiErrorSchema>

// ------------------------------------------------------------------ added for the API server

/** Every `error.code` the API returns, so clients can switch on them. */
export const API_ERROR_CODES = [
  'bad_request',
  'invalid_json',
  'invalid_request',
  'invalid_query',
  'unauthorized',
  'forbidden_origin',
  'not_found',
  'run_not_found',
  'nickname_required',
  'nickname_taken',
  'nickname_not_allowed',
  'run_not_active',
  'run_expired',
  'run_implausible',
  'invalid_run',
  'payload_too_large',
  'unsupported_media_type',
  'rate_limited',
  'db_unavailable',
  'internal_error',
] as const
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES)

/** GET /api/config — which sign-in methods this server offers. */
export const configResponseSchema = z.object({
  auth: z.object({ google: z.boolean(), email: z.boolean() }),
})

/** PUT /api/me/profile — the saved (trimmed) nickname. */
export const updateProfileResponseSchema = z.object({ nickname: z.string() })

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>
export type ConfigResponse = z.infer<typeof configResponseSchema>
export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>
