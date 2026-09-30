const MAX_CLOCK_SECONDS = 99 * 60 + 59

const numberFormatter = new Intl.NumberFormat('en-US')

/** Milliseconds as a zero-padded `mm:ss` clock, capped at 99:59. */
export function formatClock(ms: number): string {
  const totalSeconds = Number.isFinite(ms) ? Math.min(MAX_CLOCK_SECONDS, Math.max(0, Math.floor(ms / 1000))) : 0
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** Whole percent, floored so a nearly-reached target never looks reached. */
export function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${Math.min(100, Math.max(0, Math.floor(safe)))}%`
}

const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
/** Below this, numbers stay exact; above it they become 12.5K / 1.2M. */
const COMPACT_FROM = 10_000

/** Short number for tight spaces, e.g. the score on phones. */
export function formatCompactNumber(value: number): string {
  return value < COMPACT_FROM ? numberFormatter.format(value) : compactFormatter.format(value)
}

/** Speed multiplier such as `1.08×`. */
export function formatSpeed(factor: number): string {
  return `${factor.toFixed(2)}×`
}
