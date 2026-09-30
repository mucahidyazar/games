import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { badge, run } from '../src/db/schema'
import type { DatabaseHandle } from '../src/db/types'
import { awardBadges, badgeTotal, saveRecords } from '../src/runs/progress'
import type { RecordCandidate } from '../src/runs/records'
import { openTestDatabase } from './helpers/database'
import { insertPlayer } from './helpers/seed'

let database: DatabaseHandle
let runId: string
const NOW = new Date('2026-09-24T10:00:00Z')
const LATER = new Date('2026-09-24T11:00:00Z')

beforeAll(async () => {
  database = await openTestDatabase()
  await database.migrate()
  await insertPlayer(database.db, 'p1', 'Player One')
  await insertPlayer(database.db, 'p2', 'Player Two')
  const [row] = await database.db
    .insert(run)
    .values({ userId: 'p1', mode: 'classic', field: 'landscape', seed: 1, ranked: true, startedAt: NOW })
    .returning({ id: run.id })
  runId = row?.id ?? ''
})

afterAll(async () => {
  await database.close()
})

const tierOf = async (userId: string, badgeId: string) => {
  const [row] = await database.db.select({ tier: badge.tier }).from(badge).where(and(eq(badge.userId, userId), eq(badge.badgeId, badgeId)))
  return row?.tier
}

describe('awardBadges', () => {
  it('awards new badges and reports them', async () => {
    const earned = await awardBadges(database.db, 'p1', runId, [{ id: 'climber', tier: 1 }, { id: 'squeeze', tier: 2 }], NOW)
    expect(earned).toEqual([{ id: 'climber', tier: 1 }, { id: 'squeeze', tier: 2 }])
  })

  it('upgrades a tier and reports the upgrade', async () => {
    const earned = await awardBadges(database.db, 'p1', runId, [{ id: 'climber', tier: 3 }], LATER)
    expect(earned).toEqual([{ id: 'climber', tier: 3 }])
    expect(await tierOf('p1', 'climber')).toBe(3)
  })

  it('never downgrades, and repeats are not news', async () => {
    const earned = await awardBadges(database.db, 'p1', runId, [{ id: 'climber', tier: 1 }, { id: 'squeeze', tier: 2 }], LATER)
    expect(earned).toEqual([])
    expect(await tierOf('p1', 'climber')).toBe(3)
    expect(await awardBadges(database.db, 'p1', runId, [], LATER)).toEqual([])
  })

  it('sums tiers per player', async () => {
    expect(await badgeTotal(database.db, 'p1')).toBe(5)
    expect(await badgeTotal(database.db, 'p2')).toBe(0)
  })
})

describe('saveRecords', () => {
  const candidate = (value: number, direction: 'asc' | 'desc' = 'desc'): RecordCandidate => ({
    board: direction === 'desc' ? 'score.classic' : 'stat.tightestTrap',
    period: 'all',
    key: direction === 'desc' ? 'score.classic:all' : 'stat.tightestTrap:all',
    direction,
    value,
    level: direction === 'desc' ? 2 : null,
  })

  it('keeps only a better score and reports the standing either way', async () => {
    const [first] = await saveRecords(database.db, 'p1', runId, [candidate(500)], NOW)
    expect(first).toEqual({ board: 'score.classic', period: 'all', key: 'score.classic:all', value: 500, rank: 1, improved: true })

    const [worse] = await saveRecords(database.db, 'p1', runId, [candidate(300)], LATER)
    expect(worse).toMatchObject({ value: 500, rank: 1, improved: false })

    const [better] = await saveRecords(database.db, 'p1', runId, [candidate(800)], LATER)
    expect(better).toMatchObject({ value: 800, rank: 1, improved: true })
  })

  it('ranks against other players, ties going to the earlier record', async () => {
    const [second] = await saveRecords(database.db, 'p2', runId, [candidate(800)], new Date('2026-09-24T12:00:00Z'))
    expect(second).toMatchObject({ value: 800, rank: 2, improved: true })
  })

  it('treats lower as better on ascending boards', async () => {
    await saveRecords(database.db, 'p2', runId, [candidate(1.5, 'asc')], NOW)
    const [first] = await saveRecords(database.db, 'p1', runId, [candidate(2, 'asc')], NOW)
    expect(first).toMatchObject({ value: 2, rank: 2, improved: true })
    const [improved] = await saveRecords(database.db, 'p1', runId, [candidate(0.5, 'asc')], LATER)
    expect(improved).toMatchObject({ value: 0.5, rank: 1, improved: true })
    const [worse] = await saveRecords(database.db, 'p1', runId, [candidate(3, 'asc')], LATER)
    expect(worse).toMatchObject({ value: 0.5, rank: 1, improved: false })
  })
})
