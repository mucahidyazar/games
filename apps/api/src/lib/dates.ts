const DAY_MS = 86_400_000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Midnight UTC of a YYYY-MM-DD day, or null for malformed or impossible dates (2026-02-31). */
export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

/** Shifts a YYYY-MM-DD day by whole days. */
export function addDays(isoDate: string, days: number): string {
  const start = parseIsoDate(isoDate)
  if (!start) throw new RangeError(`Not a calendar date: ${isoDate}`)
  return new Date(start.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}
