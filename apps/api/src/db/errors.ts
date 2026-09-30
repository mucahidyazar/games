const UNIQUE_VIOLATION = '23505'
const MAX_CAUSE_DEPTH = 5

/**
 * True when a query failed on a unique constraint. Drizzle wraps driver errors
 * (DrizzleQueryError), so the Postgres error code may sit a few causes deep.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && typeof current === 'object' && current !== null; depth++) {
    if ('code' in current && current.code === UNIQUE_VIOLATION) return true
    current = 'cause' in current ? current.cause : undefined
  }
  return false
}
