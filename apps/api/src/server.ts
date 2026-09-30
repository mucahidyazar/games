/**
 * Process entry point: `pnpm --filter api dev` (tsx) or `node dist/server.js`.
 */
import { startServer } from './bootstrap'
import { ConfigError, loadConfig } from './env'
import { createLogger } from './logger'

function loadOrExit(): ReturnType<typeof loadConfig> {
  try {
    return loadConfig()
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  }
}

const { config, warnings, envFile } = loadOrExit()
const logger = createLogger({ level: config.logLevel })
logger.info(envFile ? 'environment file loaded' : 'no environment file found', { path: envFile })
for (const warning of warnings) logger.warn(warning)

const running = await startServer(config, logger)
logger.info('api listening', {
  port: running.port,
  env: config.nodeEnv,
  database: running.services.database.driver,
  staticDir: config.staticDir,
  google: config.google !== null,
  email: config.emailMode,
})

let stopping = false
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return
  stopping = true
  logger.info('shutting down', { signal })
  try {
    await running.close()
    process.exit(0)
  } catch (error) {
    logger.error('shutdown failed', { error })
    process.exit(1)
  }
}

process.once('SIGTERM', (signal) => void shutdown(signal))
process.once('SIGINT', (signal) => void shutdown(signal))
