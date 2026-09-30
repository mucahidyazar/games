import { MAX_RUN_TICKS, TICKS_PER_SECOND } from '@games/trap-the-orb-engine'
import { describe, expect, it } from 'vitest'
import { isExpired, isPlausible, MAX_RUN_SECONDS, PLAUSIBILITY_GRACE_SECONDS, RUN_EXPIRY_MARGIN_SECONDS, secondsBetween } from './timing'

describe('run timing', () => {
  it('measures elapsed wall-clock seconds', () => {
    expect(secondsBetween(new Date('2026-09-24T10:00:00Z'), new Date('2026-09-24T10:01:30Z'))).toBe(90)
  })

  it('expires runs only after the longest possible game plus a margin', () => {
    expect(MAX_RUN_SECONDS).toBe(MAX_RUN_TICKS / TICKS_PER_SECOND)
    expect(isExpired(MAX_RUN_SECONDS + RUN_EXPIRY_MARGIN_SECONDS)).toBe(false)
    expect(isExpired(MAX_RUN_SECONDS + RUN_EXPIRY_MARGIN_SECONDS + 1)).toBe(true)
  })

  it('refuses recordings that cover more game time than wall-clock time (with a small grace)', () => {
    const oneMinute = 60 * TICKS_PER_SECOND
    expect(isPlausible(oneMinute, 60)).toBe(true)
    expect(isPlausible(oneMinute, 60 - PLAUSIBILITY_GRACE_SECONDS)).toBe(true)
    expect(isPlausible(oneMinute, 60 - PLAUSIBILITY_GRACE_SECONDS - 1)).toBe(false)
    expect(isPlausible(0, 0)).toBe(true)
  })
})
