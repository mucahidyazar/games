import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './schema'

/** Either driver (postgres.js in production, PGlite in development and tests), or a transaction. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface DatabaseHandle {
  readonly db: Database
  readonly driver: 'postgres' | 'pglite'
  /** Applies pending migrations from ./drizzle. Idempotent. */
  migrate(): Promise<void>
  /** Throws when the database cannot answer a trivial query. */
  ping(): Promise<void>
  close(): Promise<void>
}
