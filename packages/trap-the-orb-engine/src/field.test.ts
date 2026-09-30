import { describe, expect, it } from 'vitest'
import { fieldDims, orientationForAspect } from './field'

describe('fieldDims', () => {
  it('uses a 2:1 field in landscape and the same field turned on its side in portrait', () => {
    expect(fieldDims('landscape')).toEqual({ cols: 300, rows: 150 })
    expect(fieldDims('portrait')).toEqual({ cols: 150, rows: 300 })
  })
})

describe('orientationForAspect', () => {
  it('picks the orientation that fits the screen', () => {
    expect(orientationForAspect(2)).toBe('landscape')
    expect(orientationForAspect(1)).toBe('landscape')
    expect(orientationForAspect(0.6)).toBe('portrait')
  })

  it('falls back to landscape for invalid sizes', () => {
    expect(orientationForAspect(Number.NaN)).toBe('landscape')
    expect(orientationForAspect(-1)).toBe('landscape')
  })
})
