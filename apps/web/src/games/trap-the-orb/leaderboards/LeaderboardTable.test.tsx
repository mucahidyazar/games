import type { LeaderboardResponse } from '@games/contract'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLeaderboard } from '@/features/account/queries'
import { LeaderboardTable } from './LeaderboardTable'

vi.mock('@/features/account/queries', () => ({ useLeaderboard: vi.fn() }))

type Query = ReturnType<typeof useLeaderboard>

const mockQuery = (patch: Partial<Query>) => {
  const query = { isPending: false, isError: false, data: undefined, refetch: vi.fn(), ...patch } as unknown as Query
  vi.mocked(useLeaderboard).mockReturnValue(query)
  return query
}

const table = (patch: Partial<LeaderboardResponse> = {}): LeaderboardResponse => ({
  board: 'score.classic',
  period: 'week',
  key: 'score.classic:week:2026-W39',
  entries: [
    { rank: 1, nickname: 'GridMaster', value: 48_200, level: 14, achievedAt: '2026-09-23T10:00:00.000Z' },
    { rank: 2, nickname: 'Luna', value: 31_050, level: 11, achievedAt: '2026-09-22T18:30:00.000Z' },
  ],
  me: null,
  ...patch,
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('LeaderboardTable', () => {
  it('shows a placeholder while loading', () => {
    mockQuery({ isPending: true })
    render(<LeaderboardTable board="score.classic" period="week" />)

    expect(screen.getByRole('list', { name: 'Loading leaderboard' })).toBeInTheDocument()
  })

  it('offers a retry when the table cannot be loaded', async () => {
    const query = mockQuery({ isError: true })
    render(<LeaderboardTable board="score.classic" period="week" />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))

    expect(query.refetch).toHaveBeenCalledOnce()
  })

  it('invites players to claim an empty table', () => {
    mockQuery({ data: table({ entries: [] }) })
    render(<LeaderboardTable board="score.classic" period="week" />)

    expect(screen.getByText(/claim the top spot/i)).toBeInTheDocument()
  })

  it('lists the table and highlights the player', () => {
    mockQuery({ data: table({ me: { rank: 2, value: 31_050 } }) })
    render(<LeaderboardTable board="score.classic" period="week" />)

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]!).getByText('GridMaster')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('48,200')).toBeInTheDocument()
    expect(rows[2]).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('columnheader', { name: 'Level' })).toBeInTheDocument()
  })

  it('adds the player’s own row below the top when they are further down', () => {
    mockQuery({ data: table({ me: { rank: 57, value: 1_200 } }) })
    render(<LeaderboardTable board="score.classic" period="week" />)

    const own = screen.getAllByRole('row').at(-1)
    expect(own).toHaveAttribute('aria-current', 'true')
    expect(own).toHaveTextContent('57You1,200')
  })

  it('shows record values in their unit, without levels', () => {
    mockQuery({
      data: table({
        board: 'stat.tightestTrap',
        period: 'all',
        entries: [{ rank: 1, nickname: 'Tiny', value: 0.41, level: null, achievedAt: '2026-09-23T10:00:00.000Z' }],
      }),
    })
    render(<LeaderboardTable board="stat.tightestTrap" period="all" />)

    expect(screen.getByText('0.41%')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Space' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Level' })).not.toBeInTheDocument()
  })
})
