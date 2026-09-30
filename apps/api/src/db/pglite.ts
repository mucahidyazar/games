import { mkdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { MIGRATIONS_DIR } from '../paths'
import { MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from './migration-settings'
import * as schema from './schema'
import type { DatabaseHandle } from './types'

/**
 * Embedded Postgres (WASM) for development and tests: no server to install.
 * Loaded lazily, so the production bundle never needs it.
 */
export async function openPglite(dataDir: string): Promise<DatabaseHandle> {
  if (dataDir !== 'memory') mkdirSync(dataDir, { recursive: true })
  const client = dataDir === 'memory' ? new PGlite() : new PGlite(dataDir)
  await client.waitReady
  const db = drizzle({ client, schema })

  return {
    db,
    driver: 'pglite',
    migrate: () =>
      migrate(db, { migrationsFolder: MIGRATIONS_DIR, migrationsSchema: MIGRATIONS_SCHEMA, migrationsTable: MIGRATIONS_TABLE }),
    ping: async () => {
      await db.execute(sql`select 1`)
    },
    close: () => client.close(),
  }
}
