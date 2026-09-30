import type { Page } from '@playwright/test'

/**
 * A stand-in for the API, so end-to-end tests run against `vite preview` alone.
 * The real server (apps/api) replays runs; here every submitted run is accepted
 * as-is and the request bodies are kept for the test to inspect.
 */

export interface FakeApiOptions {
  readonly signedIn?: boolean
  readonly nickname?: string | null
}

export interface FakeApi {
  readonly startedRuns: unknown[]
  readonly finishedRuns: Array<{ readonly runId: string; readonly body: Record<string, unknown> }>
}

const USER = {
  id: 'user-1',
  name: 'Luna Lovegood',
  email: 'luna@example.com',
  emailVerified: true,
  image: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

const SESSION = {
  session: {
    id: 'session-1',
    userId: USER.id,
    token: 'token',
    expiresAt: '2030-01-01T00:00:00.000Z',
    createdAt: '2026-09-24T10:00:00.000Z',
    updatedAt: '2026-09-24T10:00:00.000Z',
    ipAddress: null,
    userAgent: null,
  },
  user: USER,
}

const STATS = {
  levelsCleared: 0,
  highestLevel: 1,
  wallsBuilt: 1,
  wallsBroken: 0,
  tightestTrapPct: 2.4,
  biggestCapturePct: 12,
  bestClearPct: null,
  perfectStreak: 0,
  bestPerfectStreak: 0,
  fastestClearRatio: null,
  maxRegionsInOneWall: 1,
  fewestWallsClear: null,
}

const LEADERBOARD_ENTRIES = [
  { rank: 1, nickname: 'GridMaster', value: 48_200, level: 14, achievedAt: '2026-09-23T10:00:00.000Z' },
  { rank: 2, nickname: 'PixelPioneer', value: 31_050, level: 11, achievedAt: '2026-09-22T18:30:00.000Z' },
  { rank: 3, nickname: 'NeoOrb', value: 12_400, level: 7, achievedAt: '2026-09-21T08:15:00.000Z' },
]

export async function mockApi(page: Page, { signedIn = false, nickname = 'Luna' }: FakeApiOptions = {}): Promise<FakeApi> {
  const api: FakeApi = { startedRuns: [], finishedRuns: [] }

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const { pathname, searchParams } = new URL(request.url())
    const method = request.method()
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (pathname === '/api/config') return json({ auth: { google: true, email: true } })
    if (pathname === '/api/auth/get-session') return json(signedIn ? SESSION : null)
    if (pathname === '/api/me') {
      if (!signedIn) return json({ error: { code: 'unauthorized', message: 'Sign in first.' } }, 401)
      return json({
        user: { id: USER.id, email: USER.email, name: USER.name, image: null },
        profile: nickname ? { nickname } : null,
        badges: [],
        records: [],
        dailyStreak: 0,
        dailyPlayedToday: false,
      })
    }
    if (pathname === '/api/leaderboards') {
      const board = searchParams.get('board') ?? 'score.classic'
      const period = searchParams.get('period') ?? 'week'
      return json({ board, period, key: `${board}:${period}`, entries: LEADERBOARD_ENTRIES, me: null })
    }
    if (pathname === '/api/runs' && method === 'POST') {
      const body = request.postDataJSON() as { mode: string; field: string }
      api.startedRuns.push(body)
      return json({ runId: 'run-1', seed: 424_242, mode: body.mode, field: body.field, dailyDate: null, ranked: true })
    }
    const finish = /^\/api\/runs\/([^/]+)\/finish$/.exec(pathname)
    if (finish && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>
      api.finishedRuns.push({ runId: finish[1] ?? '', body })
      const score = typeof body.clientScore === 'number' ? body.clientScore : 0
      return json({
        result: { status: 'playing', gameOverReason: null, score, level: 1, levelsCleared: 0, stats: STATS },
        ranked: true,
        newBadges: [{ id: 'squeeze', tier: 1 }],
        records: [
          { board: 'score.classic', period: 'week', key: 'score.classic:week:2026-W39', value: score, rank: 3, improved: true },
        ],
      })
    }
    return json({ error: { code: 'not_found', message: 'Not found' } }, 404)
  })

  return api
}
