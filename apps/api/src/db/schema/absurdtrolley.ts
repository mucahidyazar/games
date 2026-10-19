import { TROLLEY_CHOICES } from '@games/contract'
import { sql } from 'drizzle-orm'
import { check, pgSchema, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/** `absurdtrolley`: the community's anonymous votes on Absurd Trolley Problems. */
export const absurdtrolley = pgSchema('absurdtrolley')

const timestampTz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

/**
 * One row per device and dilemma. The voter id is a random UUID the browser
 * generated; it is not linked to an account, an address or anything else.
 * Voting again on the same dilemma replaces the choice.
 */
export const trolleyVote = absurdtrolley.table(
  'vote',
  {
    dilemmaId: text('dilemma_id').notNull(),
    voterId: uuid('voter_id').notNull(),
    choice: text('choice', { enum: TROLLEY_CHOICES }).notNull(),
    createdAt: timestampTz('created_at').notNull(),
    updatedAt: timestampTz('updated_at').notNull(),
  },
  (table) => [
    // Also serves the per-dilemma tallies: they group by its leading column.
    primaryKey({ columns: [table.dilemmaId, table.voterId] }),
    check('vote_choice_check', sql`${table.choice} in ('pull', 'stay')`),
  ],
)
