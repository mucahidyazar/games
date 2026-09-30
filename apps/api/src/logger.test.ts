import { describe, expect, it } from 'vitest'
import { createLogger, type LogSink } from './logger'

function capture(level: Parameters<typeof createLogger>[0]['level']) {
  const lines: { line: Record<string, unknown>; level: string }[] = []
  const sink: LogSink = (line, lineLevel) => lines.push({ line: JSON.parse(line) as Record<string, unknown>, level: lineLevel })
  return { logger: createLogger({ level, sink }), lines }
}

describe('createLogger', () => {
  it('writes one JSON object per line with time, level, message and fields', () => {
    const { logger, lines } = capture('debug')
    logger.info('run finished', { runId: 'r1', score: 10 })
    expect(lines).toHaveLength(1)
    expect(lines[0]?.line).toMatchObject({ level: 'info', msg: 'run finished', runId: 'r1', score: 10 })
    expect(typeof lines[0]?.line.time).toBe('string')
  })

  it('drops lines below the configured level', () => {
    const { logger, lines } = capture('warn')
    logger.debug('noise')
    logger.info('noise')
    logger.warn('careful')
    logger.error('broken')
    expect(lines.map((entry) => entry.level)).toEqual(['warn', 'error'])
  })

  it('stays quiet when silent', () => {
    const { logger, lines } = capture('silent')
    logger.error('broken')
    expect(lines).toHaveLength(0)
  })

  it('serialises errors and carries child fields', () => {
    const { logger, lines } = capture('info')
    logger.child({ scope: 'auth' }).error('failed', { error: new TypeError('bad input') })
    expect(lines[0]?.line).toMatchObject({ scope: 'auth', error: { name: 'TypeError', message: 'bad input' } })
  })

  it('writes to stdout and stderr by default', () => {
    const logger = createLogger({ level: 'info' })
    const writes: string[] = []
    const out = process.stdout.write.bind(process.stdout)
    const err = process.stderr.write.bind(process.stderr)
    process.stdout.write = ((chunk: string) => writes.push(`out:${chunk}`) > 0) as typeof process.stdout.write
    process.stderr.write = ((chunk: string) => writes.push(`err:${chunk}`) > 0) as typeof process.stderr.write
    try {
      logger.info('hello')
      logger.warn('careful')
    } finally {
      process.stdout.write = out
      process.stderr.write = err
    }
    expect(writes[0]).toMatch(/^out:\{.*"msg":"hello"/)
    expect(writes[1]).toMatch(/^err:\{.*"msg":"careful"/)
  })
})
