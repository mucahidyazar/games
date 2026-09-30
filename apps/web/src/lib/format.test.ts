import { describe, expect, it } from 'vitest'
import { formatClock, formatCompactNumber, formatNumber, formatPercent, formatSpeed } from './format'

describe('formatClock', () => {
  it('formats milliseconds as mm:ss', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(138_400)).toBe('02:18')
    expect(formatClock(59_999)).toBe('00:59')
  })

  it('clamps invalid and oversized values', () => {
    expect(formatClock(-5)).toBe('00:00')
    expect(formatClock(Number.NaN)).toBe('00:00')
    expect(formatClock(200 * 60_000)).toBe('99:59')
  })
})

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatPercent', () => {
  it('floors to a whole percent so 74.9% never reads as the 75% target', () => {
    expect(formatPercent(74.9)).toBe('74%')
    expect(formatPercent(62)).toBe('62%')
    expect(formatPercent(-3)).toBe('0%')
    expect(formatPercent(120)).toBe('100%')
  })
})

describe('formatCompactNumber', () => {
  it('keeps small numbers exact and shortens large ones', () => {
    expect(formatCompactNumber(9_876)).toBe('9,876')
    expect(formatCompactNumber(12_450)).toBe('12.5K')
    expect(formatCompactNumber(1_234_567)).toBe('1.2M')
  })
})

describe('formatSpeed', () => {
  it('shows the speed multiplier with two decimals', () => {
    expect(formatSpeed(1)).toBe('1.00×')
    expect(formatSpeed(1.08)).toBe('1.08×')
    expect(formatSpeed(1.7)).toBe('1.70×')
  })
})
