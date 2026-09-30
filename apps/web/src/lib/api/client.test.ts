import { afterEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod/mini'
import { api, apiRequest, ApiError, finishRunOnExit } from './client'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const stubFetch = (implementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) => {
  const fetchMock = vi.fn(implementation)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const numberSchema = z.object({ value: z.number() })

describe('apiRequest', () => {
  it('returns the validated body of a successful request', async () => {
    const fetchMock = stubFetch(async () => json({ value: 3 }))

    await expect(apiRequest('/api/thing', { schema: numberSchema })).resolves.toEqual({ value: 3 })
    expect(fetchMock).toHaveBeenCalledWith('/api/thing', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }))
  })

  it('sends JSON bodies and resolves to nothing without a schema', async () => {
    const fetchMock = stubFetch(async () => new Response(null, { status: 204 }))

    await expect(apiRequest('/api/thing', { method: 'PUT', body: { a: 1 } })).resolves.toBeUndefined()
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.body).toBe('{"a":1}')
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(init?.keepalive).toBe(false)
  })

  it('turns the server’s error envelope into an ApiError', async () => {
    stubFetch(async () => json({ error: { code: 'nickname_taken', message: 'That nickname is taken.' } }, 409))

    const error = await apiRequest('/api/me/profile').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'nickname_taken', message: 'That nickname is taken.', status: 409 })
  })

  it('still reports failures without an error envelope', async () => {
    stubFetch(async () => new Response('Bad gateway', { status: 502 }))

    await expect(apiRequest('/api/thing')).rejects.toMatchObject({ code: 'http_error', status: 502 })
  })

  it('reports network failures as a network error', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(apiRequest('/api/thing')).rejects.toMatchObject({ code: 'network', status: 0 })
  })

  it('lets aborted requests reject as aborts', async () => {
    stubFetch(async () => {
      throw new DOMException('Aborted', 'AbortError')
    })

    await expect(apiRequest('/api/thing')).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects responses that do not match the contract', async () => {
    stubFetch(async () => json({ value: 'three' }))

    await expect(apiRequest('/api/thing', { schema: numberSchema })).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('keeps small requests alive when asked, but never large ones', async () => {
    const fetchMock = stubFetch(async () => new Response(null, { status: 204 }))

    await apiRequest('/api/a', { method: 'POST', body: { small: true }, keepalive: true })
    await apiRequest('/api/b', { method: 'POST', body: { big: 'x'.repeat(70_000) }, keepalive: true })

    expect(fetchMock.mock.calls[0]?.[1]?.keepalive).toBe(true)
    expect(fetchMock.mock.calls[1]?.[1]?.keepalive).toBe(false)
  })
})

describe('api', () => {
  it('asks for a leaderboard table with its query', async () => {
    const fetchMock = stubFetch(async () =>
      json({ board: 'score.daily', period: 'day', key: 'score.daily:day:2026-09-23', entries: [], me: null }),
    )

    await api.leaderboard({ board: 'score.daily', period: 'day', date: '2026-09-23' })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/leaderboards?board=score.daily&period=day&date=2026-09-23')
  })

  it('finishes a run with a keep-alive request', async () => {
    const response = {
      result: {
        status: 'gameOver',
        gameOverReason: 'lives',
        score: 10,
        level: 1,
        levelsCleared: 0,
        stats: {
          levelsCleared: 0,
          highestLevel: 1,
          wallsBuilt: 1,
          wallsBroken: 2,
          tightestTrapPct: null,
          biggestCapturePct: 0,
          bestClearPct: null,
          perfectStreak: 0,
          bestPerfectStreak: 0,
          fastestClearRatio: null,
          maxRegionsInOneWall: 0,
          fewestWallsClear: null,
        },
      },
      ranked: true,
      newBadges: [],
      records: [],
    }
    const fetchMock = stubFetch(async () => json(response))

    await expect(
      api.finishRun('run/1', { endTick: 10, inputs: [], clientScore: 10, clientLevel: 1 }),
    ).resolves.toEqual(response)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/runs/run%2F1/finish')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', keepalive: true })
  })
})

describe('finishRunOnExit', () => {
  it('sends the recording with keepalive so it outlives the page', () => {
    const fetchMock = stubFetch(async () => new Response(null, { status: 200 }))

    expect(finishRunOnExit('run-9', { endTick: 5, inputs: [], clientScore: 0, clientLevel: 1 })).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/runs/run-9/finish', expect.objectContaining({ keepalive: true }))
  })

  it('gives up on recordings too large for a keep-alive request', () => {
    const fetchMock = stubFetch(async () => new Response(null, { status: 200 }))
    const inputs = Array.from({ length: 3000 }, (_, t) => ({ t, c: 100, r: 100, o: 'v' as const }))

    expect(finishRunOnExit('run-9', { endTick: 5000, inputs, clientScore: 0, clientLevel: 1 })).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
