import { BADGES } from '@games/trap-the-orb-engine'
import { describe, expect, it } from 'vitest'
import { BADGE_CONTENT, badgeContent, badgeGoal } from './badgeContent'

describe('badge content', () => {
  it('names and explains every badge', () => {
    expect(BADGE_CONTENT.map((badge) => badge.id).sort()).toEqual(BADGES.map((badge) => badge.id).sort())
    expect(() => badgeContent('nope' as never)).toThrow(/unknown badge/i)
  })

  it('fills in the goal of each tier in the right unit', () => {
    expect(badgeGoal('squeeze', 2)).toBe('Trap an orb in 1.5% of the field or less')
    expect(badgeGoal('lightning', 3)).toBe('Clear a level in 30% of its par time')
    expect(badgeGoal('climber', 1)).toBe('Reach level 5 in a ranked mode')
    expect(badgeGoal('devotee', 3)).toBe('Play the Daily Challenge 30 days in a row')
  })
})
