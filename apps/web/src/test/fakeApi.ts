import type { LeaderboardResponse } from '@games/contract'
import { vi } from 'vitest'

export interface FakeApiOptions {
  /** Sign-in methods /api/config reports. */
  readonly auth?: { readonly google: boolean; readonly email: boolean }
  readonly leaderboard?: Partial<LeaderboardResponse>
  /** Make every /api request fail as if the server were down. */
  readonly isDown?: boolean
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function requestUrl(input: RequestInfo | URL): URL {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return new URL(href, 'http://localhost')
}

/**
 * Stubs `fetch` with a tiny in-memory stand-in for the API, signed out. Returns
 * the mock so tests can inspect the requests.
 */
export function installFakeApi({ auth = { google: true, email: true }, leaderboard, isDown = false }: FakeApiOptions = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    if (isDown) throw new TypeError('Failed to fetch')
    const url = requestUrl(input)
    switch (url.pathname) {
      case '/api/config':
        return json({ auth })
      case '/api/auth/get-session':
        return json(null)
      case '/api/leaderboards':
        return json({
          board: url.searchParams.get('board') ?? 'score.classic',
          period: url.searchParams.get('period') ?? 'week',
          key: 'score.classic:week:2026-W39',
          entries: [
            { rank: 1, nickname: 'GridMaster', value: 48_200, level: 14, achievedAt: '2026-09-23T10:00:00.000Z' },
            { rank: 2, nickname: 'LunaByte', value: 31_050, level: 11, achievedAt: '2026-09-22T18:30:00.000Z' },
          ],
          me: null,
          ...leaderboard,
        })
      default:
        return json({ error: { code: 'not_found', message: 'Not found' } }, 404)
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
