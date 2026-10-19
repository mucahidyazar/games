import * as z from 'zod/mini'

/**
 * Absurd Trolley Problems: the dilemmas the community can vote on. The ids
 * are stable keys in the vote table, so rename a dilemma's text freely but
 * never reuse or change an id.
 */
export const TROLLEY_DILEMMA_IDS = [
  // Chapter 1
  'influencers-vs-last-cat',
  'classic-five-vs-one',
  'monday-vs-friday',
  'cats-vs-dog',
  'speaker-vs-passengers',
  'last-ai-vs-human',
  'yourself-vs-five',
  'cookies-vs-five',
  'grandpa-vs-five',
  'billionaire-vs-regular',
  'teapot-vs-coworker',
  'multi-track-drift',
  // Chapter 2
  'footbridge',
  'duck-vs-horses',
  'phone-vs-stranger',
  'seen-friends-vs-stranger',
  'alien-vs-five',
  'best-friend-vs-five',
  'original-vs-clones',
  'couch-vs-nobody',
  'coffee-vs-five',
  'crosswalk',
  'elders-vs-young',
  'everyone-you-saved',
] as const

/**
 * Philippa Foot's cases from "The Problem of Abortion and the Doctrine of the
 * Double Effect" (1967), voted on the same way, in the order they are played.
 * The same rule holds: never reuse or change an id.
 */
export const FOOT_DILEMMA_IDS = [
  'foot-driver',
  'foot-judge',
  'foot-pilot',
  'foot-drug',
  'foot-crash',
  'foot-serum',
  'foot-beggar',
  'foot-gas',
  'foot-rescue',
  'foot-tyrant',
  'foot-madman',
  'foot-children',
  'foot-oil',
  'foot-education',
  'foot-cave',
  'foot-cave-inside',
  'foot-lifeboat',
  'foot-hysterectomy',
  'foot-craniotomy',
  'foot-mother-or-child',
  'foot-worst-dilemma',
] as const

/** Everything the community can vote on: the absurd dilemmas and Foot's cases. */
export const TROLLEY_VOTE_IDS = [...TROLLEY_DILEMMA_IDS, ...FOOT_DILEMMA_IDS] as const

export const TROLLEY_CHOICES = ['pull', 'stay'] as const

export const trolleyDilemmaIdSchema = z.enum(TROLLEY_DILEMMA_IDS)
export const footDilemmaIdSchema = z.enum(FOOT_DILEMMA_IDS)
export const trolleyVoteIdSchema = z.enum(TROLLEY_VOTE_IDS)
export const trolleyChoiceSchema = z.enum(TROLLEY_CHOICES)

/** How the community voted on one dilemma. */
export const trolleyTallySchema = z.object({
  pull: z.int().check(z.gte(0)),
  stay: z.int().check(z.gte(0)),
})

/** GET /api/trolley/tallies — every dilemma that has votes; missing ids have none yet. */
export const trolleyTalliesResponseSchema = z.object({
  tallies: z.partialRecord(trolleyVoteIdSchema, trolleyTallySchema),
})

/**
 * POST /api/trolley/votes — one anonymous vote per device and dilemma. The
 * voter id is a random UUID the browser keeps; voting again replaces the
 * earlier choice.
 */
export const trolleyVoteRequestSchema = z.object({
  dilemmaId: trolleyVoteIdSchema,
  choice: trolleyChoiceSchema,
  voterId: z.uuid(),
})

export const trolleyVoteResponseSchema = z.object({
  dilemmaId: trolleyVoteIdSchema,
  tally: trolleyTallySchema,
})

export type TrolleyDilemmaId = z.infer<typeof trolleyDilemmaIdSchema>
export type FootDilemmaId = z.infer<typeof footDilemmaIdSchema>
export type TrolleyVoteId = z.infer<typeof trolleyVoteIdSchema>
export type TrolleyChoice = z.infer<typeof trolleyChoiceSchema>
export type TrolleyTally = z.infer<typeof trolleyTallySchema>
export type TrolleyTalliesResponse = z.infer<typeof trolleyTalliesResponseSchema>
export type TrolleyVoteRequest = z.infer<typeof trolleyVoteRequestSchema>
export type TrolleyVoteResponse = z.infer<typeof trolleyVoteResponseSchema>

export function isTrolleyDilemmaId(value: unknown): value is TrolleyDilemmaId {
  return typeof value === 'string' && (TROLLEY_DILEMMA_IDS as readonly string[]).includes(value)
}

/** Any id the community can vote on, absurd or Foot's. */
export function isTrolleyVoteId(value: unknown): value is TrolleyVoteId {
  return typeof value === 'string' && (TROLLEY_VOTE_IDS as readonly string[]).includes(value)
}
