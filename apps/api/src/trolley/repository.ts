import type { TrolleyChoice, TrolleyTalliesResponse, TrolleyTally, TrolleyVoteId } from '@games/contract'
import { isTrolleyVoteId } from '@games/contract'
import { eq, sql } from 'drizzle-orm'
import { trolleyVote } from '../db/schema'
import type { Database } from '../db/types'

const pullCount = sql<number>`(count(*) filter (where ${trolleyVote.choice} = 'pull'))::int`.mapWith(Number)
const stayCount = sql<number>`(count(*) filter (where ${trolleyVote.choice} = 'stay'))::int`.mapWith(Number)

/** Every dilemma's tally; dilemmas nobody has voted on are left out. */
export async function readTallies(db: Database): Promise<TrolleyTalliesResponse['tallies']> {
  const rows = await db
    .select({ dilemmaId: trolleyVote.dilemmaId, pull: pullCount, stay: stayCount })
    .from(trolleyVote)
    .groupBy(trolleyVote.dilemmaId)
  const tallies: Partial<Record<TrolleyVoteId, TrolleyTally>> = {}
  // Rows for dilemmas that were retired from the game stay in the table but are not reported.
  for (const row of rows) if (isTrolleyVoteId(row.dilemmaId)) tallies[row.dilemmaId] = { pull: row.pull, stay: row.stay }
  return tallies
}

export async function readTally(db: Database, dilemmaId: TrolleyVoteId): Promise<TrolleyTally> {
  const [row] = await db
    .select({ pull: pullCount, stay: stayCount })
    .from(trolleyVote)
    .where(eq(trolleyVote.dilemmaId, dilemmaId))
  return { pull: row?.pull ?? 0, stay: row?.stay ?? 0 }
}

export interface VoteInput {
  readonly dilemmaId: TrolleyVoteId
  readonly voterId: string
  readonly choice: TrolleyChoice
  readonly at: Date
}

/** Records a vote, replacing the same device's earlier choice on that dilemma. */
export async function castVote(db: Database, vote: VoteInput): Promise<void> {
  await db
    .insert(trolleyVote)
    .values({ dilemmaId: vote.dilemmaId, voterId: vote.voterId, choice: vote.choice, createdAt: vote.at, updatedAt: vote.at })
    .onConflictDoUpdate({
      target: [trolleyVote.dilemmaId, trolleyVote.voterId],
      set: { choice: vote.choice, updatedAt: vote.at },
    })
}
