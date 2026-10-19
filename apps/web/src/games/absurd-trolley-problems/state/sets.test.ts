import { describe, expect, it } from 'vitest'
import { newProgress } from './progress'
import { locate, moveTo, positionIn, SET_CHAPTERS, setDilemmas, setOf } from './sets'

describe('the two sets', () => {
  it('are the absurd game’s two chapters and Foot’s cases as one', () => {
    expect(SET_CHAPTERS.absurd).toHaveLength(2)
    expect(SET_CHAPTERS.foot).toHaveLength(1)
    expect(setDilemmas('absurd')).toHaveLength(24)
    expect(setDilemmas('foot')).toHaveLength(21)
    expect(setOf('foot-cave')).toBe('foot')
    expect(setOf('footbridge')).toBe('absurd')
  })

  it('keep where a player is in each apart', () => {
    const progress = { ...newProgress(), chapter: 1, index: 4, foot: 7 }
    expect(positionIn(progress, 'absurd')).toEqual({ chapter: 1, index: 4 })
    expect(positionIn(progress, 'foot')).toEqual({ chapter: 0, index: 7 })
    expect(moveTo(progress, 'foot', { chapter: 0, index: 2 })).toMatchObject({ chapter: 1, index: 4, foot: 2 })
    expect(moveTo(progress, 'absurd', { chapter: 0, index: 9 })).toMatchObject({ chapter: 0, index: 9, foot: 7 })
  })

  it('find any dilemma by its id', () => {
    expect(locate('footbridge')).toEqual({ set: 'absurd', position: { chapter: 1, index: 0 } })
    expect(locate('foot-pilot')).toEqual({ set: 'foot', position: { chapter: 0, index: 2 } })
    expect(locate('nope')).toBeNull()
  })
})
