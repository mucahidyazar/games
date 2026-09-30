import { afterEach, describe, expect, it } from 'vitest'
import { type RunningServer, startServer } from '../src/bootstrap'
import { createLogger } from '../src/logger'
import { testConfig } from './helpers/context'

let running: RunningServer | null = null

afterEach(async () => {
  await running?.close()
  running = null
})

describe('startServer', () => {
  it('serves real HTTP on a free port, migrates PGlite on start and shuts down cleanly', async () => {
    const lines: string[] = []
    const logger = createLogger({ level: 'debug', sink: (line) => lines.push(line) })
    running = await startServer({ ...testConfig(), port: 0 }, logger)
    expect(running.port).toBeGreaterThan(0)
    expect(running.services.database.driver).toBe('pglite')

    const response = await fetch(`http://127.0.0.1:${running.port}/api/health`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, db: true })

    const port = running.port
    await running.close()
    running = null
    await expect(fetch(`http://127.0.0.1:${port}/api/health`)).rejects.toThrow()
  })

  it('rate-limits anonymous requests by the socket address when no proxy is trusted', async () => {
    const config = { ...testConfig({ TRUST_PROXY: '0' }), port: 0 }
    running = await startServer(config, createLogger({ level: 'silent' }), {
      rateLimits: { leaderboards: { limit: 1, windowMs: 60_000 } },
    })
    const url = `http://127.0.0.1:${running.port}/api/leaderboards?board=score.classic&period=all`
    expect((await fetch(url)).status).toBe(200)
    // A forged X-Forwarded-For does not buy a fresh allowance.
    expect((await fetch(url, { headers: { 'x-forwarded-for': '203.0.113.9' } })).status).toBe(429)
  })

  it('can skip migrations (DB_MIGRATE=off)', async () => {
    running = await startServer({ ...testConfig({ DB_MIGRATE: 'off' }), port: 0 }, createLogger({ level: 'silent' }))
    const response = await fetch(`http://127.0.0.1:${running.port}/api/leaderboards?board=score.classic&period=all`)
    // No tables exist, so the query fails — as a clean JSON 500, never a stack trace.
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: { code: 'internal_error', message: 'Something went wrong.' } })
  })
})
