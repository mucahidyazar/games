import type { LeaderboardResponse, TrolleyTally } from '@games/contract'
import { vi } from 'vitest'

export interface FakeApiOptions {
  /** Sign-in methods /api/config reports. */
  readonly auth?: { readonly google: boolean; readonly email: boolean }
  readonly leaderboard?: Partial<LeaderboardResponse>
  /** Make every /api request fail as if the server were down. */
  readonly isDown?: boolean
  /** Absurd Trolley Problems' community votes, by dilemma id. */
  readonly trolleyTallies?: Readonly<Record<string, TrolleyTally>>
  /** How many votes the "proxy" in front of the API drops (502) before they get through. */
  readonly droppedVotes?: number
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
export function installFakeApi({ auth = { google: true, email: true }, leaderboard, isDown = false, trolleyTallies = {}, droppedVotes = 0 }: FakeApiOptions = {}) {
  const tallies: Record<string, TrolleyTally> = { ...trolleyTallies }
  let votesToDrop = droppedVotes
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (isDown) throw new TypeError('Failed to fetch')
    const url = requestUrl(input)
    switch (url.pathname) {
      case '/api/trolley/tallies':
        return json({ tallies })
      case '/api/trolley/votes': {
        if (votesToDrop > 0) {
          votesToDrop -= 1
          return new Response('Bad gateway', { status: 502 })
        }
        const vote = JSON.parse(String(init?.body ?? '{}')) as { dilemmaId: string; choice: 'pull' | 'stay' }
        const tally = tallies[vote.dilemmaId] ?? { pull: 0, stay: 0 }
        tallies[vote.dilemmaId] = { ...tally, [vote.choice]: tally[vote.choice] + 1 }
        return json({ dilemmaId: vote.dilemmaId, tally: tallies[vote.dilemmaId] })
      }
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
