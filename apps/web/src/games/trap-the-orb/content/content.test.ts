import { describe, expect, it } from 'vitest'
import { TIPS, tipForLevel } from './tips'

describe('tips', () => {
  it('cycles through the tips by level', () => {
    expect(tipForLevel(1)).toBe(TIPS[0])
    expect(tipForLevel(2)).toBe(TIPS[1])
    expect(tipForLevel(TIPS.length + 1)).toBe(TIPS[0])
    expect(tipForLevel(0)).toBe(TIPS[0])
    expect(tipForLevel(Number.NaN)).toBe(TIPS[0])
  })
})
