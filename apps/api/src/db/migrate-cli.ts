/**
 * `pnpm --filter api db:migrate` (or `node dist/migrate.js` in the Docker image):
 * applies pending migrations to DATABASE_URL, or to the development PGlite
 * database when DATABASE_URL is empty.
 */
import { loadConfig } from '../env'
import { createLogger } from '../logger'
import { openDatabase } from './client'

const { config } = loadConfig()
const logger = createLogger({ level: config.logLevel })
const database = await openDatabase({ url: config.databaseUrl, pgliteDir: config.pgliteDir, logger })

try {
  await database.migrate()
  logger.info('migrations applied', { driver: database.driver })
} catch (error) {
  logger.error('migration failed', { error })
  process.exitCode = 1
} finally {
  await database.close()
}
