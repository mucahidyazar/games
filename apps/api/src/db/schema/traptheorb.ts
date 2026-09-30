import type { RunStats } from '@games/trap-the-orb-engine'
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './core'

/** `traptheorb`: runs, leaderboard records and badges of Trap The Orb. */
export const traptheorb = pgSchema('traptheorb')

const timestampTz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const RUN_STATUSES = ['active', 'finished', 'abandoned'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

/** One ranked attempt: the server picks the seed, then replays the recording to score it. */
export const run = traptheorb.table(
  'run',
  {
    // identity and ownership
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // setup
    mode: text('mode').notNull(),
    field: text('field').notNull(),
    /** uint32 */
    seed: bigint('seed', { mode: 'number' }).notNull(),
    /** UTC day of a Daily Challenge run. */
    dailyDate: date('daily_date', { mode: 'string' }),
    // lifecycle
    status: text('status', { enum: RUN_STATUSES }).notNull().default('active'),
    ranked: boolean('ranked').notNull(),
    startedAt: timestampTz('started_at').notNull(),
    finishedAt: timestampTz('finished_at'),
    // recording
    endTick: integer('end_tick'),
    inputCount: integer('input_count'),
    // server result (authoritative)
    score: integer('score'),
    level: integer('level'),
    levelsCleared: integer('levels_cleared'),
    stats: jsonb('stats').$type<RunStats>(),
    // client claims (never trusted, kept for diagnostics)
    clientScore: integer('client_score'),
    clientLevel: integer('client_level'),
    mismatch: boolean('mismatch').notNull().default(false),
  },
  (table) => [
    index('run_user_status_idx').on(table.userId, table.status),
    // A player has at most one run in progress; starting another abandons it.
    uniqueIndex('run_one_active_per_user_uidx').on(table.userId).where(sql`status = 'active'`),
    index('run_user_ranked_daily_idx')
      .on(table.userId, table.dailyDate)
      .where(sql`mode = 'daily' and status = 'finished' and ranked`),
    check('run_status_check', sql`${table.status} in ('active', 'finished', 'abandoned')`),
    check('run_field_check', sql`${table.field} in ('landscape', 'portrait')`),
  ],
)

/** A player's best value on one leaderboard table (board + period + day/week). */
export const record = traptheorb.table(
  'record',
  {
    boardKey: text('board_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    value: doublePrecision('value').notNull(),
    level: integer('level'),
    runId: uuid('run_id').references(() => run.id, { onDelete: 'set null' }),
    achievedAt: timestampTz('achieved_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.boardKey, table.userId] }),
    index('record_board_value_idx').on(table.boardKey, table.value),
    index('record_user_idx').on(table.userId),
  ],
)

/** Highest tier of each badge a player has earned. Tiers only ever go up. */
export const badge = traptheorb.table(
  'badge',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    badgeId: text('badge_id').notNull(),
    tier: smallint('tier').notNull(),
    runId: uuid('run_id').references(() => run.id, { onDelete: 'set null' }),
    earnedAt: timestampTz('earned_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.badgeId] }),
    check('badge_tier_check', sql`${table.tier} between 1 and 3`),
  ],
)
