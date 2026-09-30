/**
 * Minimal structured logger: one JSON object per line, info and below on
 * stdout, warnings and errors on stderr. Callers pass messages and small field
 * objects — never secrets, tokens or email addresses.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'
export type LogFields = Readonly<Record<string, unknown>>
type WritableLevel = Exclude<LogLevel, 'silent'>

export interface Logger {
  debug(message: string, fields?: LogFields): void
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
  /** A logger that adds `fields` to every line. */
  child(fields: LogFields): Logger
}

export type LogSink = (line: string, level: WritableLevel) => void

export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent']

const SEVERITY: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

const defaultSink: LogSink = (line, level) => {
  const stream = level === 'warn' || level === 'error' ? process.stderr : process.stdout
  stream.write(`${line}\n`)
}

/** Errors become plain objects; everything else is passed through JSON as is. */
function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  return value
}

export function createLogger(options: { level: LogLevel; sink?: LogSink; base?: LogFields }): Logger {
  const sink = options.sink ?? defaultSink
  const base = options.base ?? {}
  const threshold = SEVERITY[options.level]

  const write = (level: WritableLevel, message: string, fields: LogFields = {}): void => {
    if (SEVERITY[level] < threshold) return
    const entries = Object.entries({ ...base, ...fields }).map(([key, value]) => [key, serialize(value)])
    const line = JSON.stringify({ time: new Date().toISOString(), level, msg: message, ...Object.fromEntries(entries) })
    sink(line, level)
  }

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
    child: (fields) => createLogger({ level: options.level, sink, base: { ...base, ...fields } }),
  }
}

/** Swallows everything; handy in tests. */
export const silentLogger: Logger = createLogger({ level: 'silent' })
