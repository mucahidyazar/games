/**
 * Where applied migrations are journaled. A project-specific table keeps this
 * API's history apart from any other Drizzle project in the same database.
 * Shared by drizzle.config.ts and the runtime migrator.
 */
export const MIGRATIONS_SCHEMA = 'drizzle'
export const MIGRATIONS_TABLE = '__games_api_migrations'
