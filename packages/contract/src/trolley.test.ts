import { describe, expect, it } from 'vitest'
import {
  FOOT_DILEMMA_IDS,
  isTrolleyDilemmaId,
  isTrolleyVoteId,
  TROLLEY_DILEMMA_IDS,
  TROLLEY_VOTE_IDS,
  trolleyTalliesResponseSchema,
  trolleyVoteRequestSchema,
} from './trolley'

const VOTER = '0b8e4c4e-7d55-4c55-9c1e-3f0f2f5a9b11'

describe('trolley dilemma ids', () => {
  it('are unique and two chapters of twelve', () => {
    expect(new Set(TROLLEY_DILEMMA_IDS).size).toBe(TROLLEY_DILEMMA_IDS.length)
    expect(TROLLEY_DILEMMA_IDS).toHaveLength(24)
  })

  it('recognises known ids only', () => {
    expect(isTrolleyDilemmaId('footbridge')).toBe(true)
    expect(isTrolleyDilemmaId('Footbridge')).toBe(false)
    expect(isTrolleyDilemmaId(42)).toBe(false)
  })

  it('add Philippa Foot’s cases to what can be voted on, without mixing them into the absurd ones', () => {
    expect(FOOT_DILEMMA_IDS).toHaveLength(21)
    expect(new Set(FOOT_DILEMMA_IDS).size).toBe(FOOT_DILEMMA_IDS.length)
    expect(new Set(TROLLEY_VOTE_IDS).size).toBe(TROLLEY_VOTE_IDS.length)
    expect(TROLLEY_VOTE_IDS).toHaveLength(TROLLEY_DILEMMA_IDS.length + FOOT_DILEMMA_IDS.length)
    expect(isTrolleyDilemmaId('foot-driver')).toBe(false)
    expect(isTrolleyVoteId('foot-driver')).toBe(true)
    expect(isTrolleyVoteId('footbridge')).toBe(true)
    expect(isTrolleyVoteId('foot-nope')).toBe(false)
  })
})

describe('trolleyVoteRequestSchema', () => {
  it('accepts a vote with a random voter id', () => {
    expect(trolleyVoteRequestSchema.safeParse({ dilemmaId: 'cats-vs-dog', choice: 'pull', voterId: VOTER }).success).toBe(true)
    expect(trolleyVoteRequestSchema.safeParse({ dilemmaId: 'foot-judge', choice: 'stay', voterId: VOTER }).success).toBe(true)
  })

  it('rejects unknown dilemmas, choices and voter ids', () => {
    expect(trolleyVoteRequestSchema.safeParse({ dilemmaId: 'nope', choice: 'pull', voterId: VOTER }).success).toBe(false)
    expect(trolleyVoteRequestSchema.safeParse({ dilemmaId: 'cats-vs-dog', choice: 'both', voterId: VOTER }).success).toBe(false)
    expect(trolleyVoteRequestSchema.safeParse({ dilemmaId: 'cats-vs-dog', choice: 'stay', voterId: 'me' }).success).toBe(false)
  })
})

describe('trolleyTalliesResponseSchema', () => {
  it('allows dilemmas without votes to be missing', () => {
    expect(trolleyTalliesResponseSchema.safeParse({ tallies: {} }).success).toBe(true)
    expect(trolleyTalliesResponseSchema.safeParse({ tallies: { footbridge: { pull: 3, stay: 9 } } }).success).toBe(true)
  })

  it('rejects negative counts and unknown dilemmas', () => {
    expect(trolleyTalliesResponseSchema.safeParse({ tallies: { footbridge: { pull: -1, stay: 0 } } }).success).toBe(false)
    expect(trolleyTalliesResponseSchema.safeParse({ tallies: { mystery: { pull: 1, stay: 0 } } }).success).toBe(false)
  })
})
