import { defineConfig } from 'drizzle-kit'
import { MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from './src/db/migration-settings'

/**
 * `pnpm db:generate` diffs the schema against ./drizzle and writes a new SQL
 * migration. It never connects to a database. Apply migrations with
 * `pnpm db:migrate` (or let the server apply them on start).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  schemaFilter: ['core', 'traptheorb'],
  migrations: { schema: MIGRATIONS_SCHEMA, table: MIGRATIONS_TABLE },
  strict: true,
  verbose: true,
})
