import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import type { Logger } from '../logger'
import { MIGRATIONS_DIR } from '../paths'
import { MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from './migration-settings'
import * as schema from './schema'
import type { DatabaseHandle } from './types'

const POOL_SIZE = 10
const IDLE_TIMEOUT_SECONDS = 20
const CONNECT_TIMEOUT_SECONDS = 10
const CLOSE_TIMEOUT_SECONDS = 5

export interface OpenDatabaseOptions {
  /** Postgres connection string; null opens the embedded PGlite database instead. */
  readonly url: string | null
  /** PGlite data directory or 'memory'. */
  readonly pgliteDir: string
  readonly logger: Logger
}

function openPostgres(url: string, logger: Logger): DatabaseHandle {
  const client = postgres(url, {
    max: POOL_SIZE,
    idle_timeout: IDLE_TIMEOUT_SECONDS,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    // Server notices (e.g. "schema already exists, skipping") go to the debug log, not stdout.
    onnotice: (notice) => logger.debug('postgres notice', { message: notice.message }),
  })
  const db = drizzle({ client, schema })

  return {
    db,
    driver: 'postgres',
    migrate: () =>
      migrate(db, { migrationsFolder: MIGRATIONS_DIR, migrationsSchema: MIGRATIONS_SCHEMA, migrationsTable: MIGRATIONS_TABLE }),
    ping: async () => {
      await db.execute(sql`select 1`)
    },
    close: () => client.end({ timeout: CLOSE_TIMEOUT_SECONDS }),
  }
}

/** Connects to Postgres, or — when no URL is configured — to the embedded PGlite database. */
export async function openDatabase({ url, pgliteDir, logger }: OpenDatabaseOptions): Promise<DatabaseHandle> {
  if (url) return openPostgres(url, logger)
  const { openPglite } = await import('./pglite')
  return openPglite(pgliteDir)
}
