import { describe, expect, it } from 'vitest'
import {
  defaultPeriodFor,
  formatBoardValue,
  leaderboardsHref,
  scoreBoardFor,
  tableLabel,
} from './boardContent'
import { leaderboardSearch, parseLeaderboardParams, yesterdayKey } from './leaderboardParams'
import { timeAgo } from './timeAgo'

describe('board content', () => {
  it('formats values in the unit of their board', () => {
    expect(formatBoardValue('score.classic', 48_200)).toBe('48,200')
    expect(formatBoardValue('stat.tightestTrap', 0.625)).toBe('0.63%')
    expect(formatBoardValue('stat.biggestCapture', 41.26)).toBe('41.3%')
    expect(formatBoardValue('stat.badges', 12)).toBe('12')
  })

  it('maps ranked modes to their score board', () => {
    expect(scoreBoardFor('timeAttack')).toBe('score.timeAttack')
    expect(scoreBoardFor('zen')).toBeNull()
  })

  it('opens each board on the table that matters now', () => {
    expect(defaultPeriodFor('score.daily')).toBe('day')
    expect(defaultPeriodFor('score.classic')).toBe('week')
    expect(defaultPeriodFor('stat.flawlessStreak')).toBe('all')
    expect(leaderboardsHref('score.hardcore')).toBe('/trap-the-orb/leaderboards?board=score.hardcore&period=week')
    expect(leaderboardsHref('score.hardcore', 'all')).toBe('/trap-the-orb/leaderboards?board=score.hardcore&period=all')
  })

  it('labels the table a record belongs to', () => {
    const now = new Date('2026-09-24T12:00:00Z')

    expect(tableLabel('score.classic:all', now)).toBe('All time')
    expect(tableLabel('score.classic:week:2026-W39', now)).toBe('This week')
    expect(tableLabel('score.classic:week:2026-W01', now)).toBe('Week 1, 2026')
    expect(tableLabel('score.daily:day:2026-09-24', now)).toBe('Today')
    expect(tableLabel('score.daily:day:2026-09-20', now)).toBe('Sep 20')
    expect(tableLabel('score.daily:day:someday', now)).toBe('someday')
  })
})

describe('leaderboard params', () => {
  it('reads a valid query string', () => {
    expect(parseLeaderboardParams('?board=score.hardcore&period=all')).toEqual({
      tab: 'scores',
      board: 'score.hardcore',
      period: 'all',
      date: undefined,
    })
    expect(parseLeaderboardParams('?board=score.daily&period=day&date=2026-09-23')).toMatchObject({
      period: 'day',
      date: '2026-09-23',
    })
    expect(parseLeaderboardParams('?board=stat.badges').tab).toBe('records')
    expect(parseLeaderboardParams('?tab=device').tab).toBe('device')
  })

  it('repairs anything invalid', () => {
    expect(parseLeaderboardParams('?board=nope&period=forever&date=yesterday')).toEqual({
      tab: 'scores',
      board: 'score.classic',
      period: 'week',
      date: undefined,
    })
    expect(parseLeaderboardParams('?board=score.daily&period=week').period).toBe('day')
    expect(parseLeaderboardParams('?board=score.classic&period=week&date=2026-09-23').date).toBeUndefined()
  })

  it('writes the query string back', () => {
    expect(leaderboardSearch({ tab: 'device', board: 'score.classic', period: 'week', date: undefined })).toBe(
      '?tab=device',
    )
    expect(leaderboardSearch({ tab: 'scores', board: 'score.daily', period: 'day', date: '2026-09-23' })).toBe(
      '?board=score.daily&period=day&date=2026-09-23',
    )
  })

  it('knows yesterday in UTC', () => {
    expect(yesterdayKey(new Date('2026-03-01T00:30:00Z'))).toBe('2026-02-28')
  })
})

describe('timeAgo', () => {
  const now = Date.parse('2026-09-24T12:00:00Z')

  it('describes recent times relative to now and older ones by date', () => {
    expect(timeAgo('2026-09-24T11:59:30Z', now)).toBe('just now')
    expect(timeAgo('2026-09-24T11:55:00Z', now)).toBe('5 minutes ago')
    expect(timeAgo('2026-09-24T09:00:00Z', now)).toBe('3 hours ago')
    expect(timeAgo('2026-09-23T09:00:00Z', now)).toBe('yesterday')
    expect(timeAgo('2026-09-01T09:00:00Z', now)).toBe('Sep 1, 2026')
    expect(timeAgo('not a date', now)).toBe('')
  })
})
