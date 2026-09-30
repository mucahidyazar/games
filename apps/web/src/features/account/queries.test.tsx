import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/client'
import { installFakeApi } from '@/test/fakeApi'
import { createQueryClient, queryKeys, useAuthConfig, useLeaderboard } from './queries'

afterEach(() => {
  vi.unstubAllGlobals()
})

const wrapperFor = (client = createQueryClient()) =>
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

describe('createQueryClient', () => {
  it('retries hiccups but not client errors', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry
    if (typeof retry !== 'function') throw new Error('expected a retry function')

    expect(retry(0, new ApiError('network', 'offline', 0))).toBe(true)
    expect(retry(2, new ApiError('network', 'offline', 0))).toBe(false)
    expect(retry(0, new ApiError('unauthorized', 'no', 401))).toBe(false)
    expect(retry(0, new ApiError('server_error', 'oops', 503))).toBe(true)
  })

  it('keys leaderboard tables by board, period and day', () => {
    expect(queryKeys.leaderboard('score.daily', 'day', undefined)).toEqual(['leaderboard', 'score.daily', 'day', null])
  })
})

describe('queries', () => {
  it('loads the sign-in options and a leaderboard table', async () => {
    installFakeApi({ auth: { google: false, email: true } })
    const wrapper = wrapperFor()

    const config = renderHook(() => useAuthConfig(), { wrapper })
    const board = renderHook(() => useLeaderboard('score.hardcore', 'all'), { wrapper })

    await waitFor(() => expect(config.result.current.data).toEqual({ auth: { google: false, email: true } }))
    await waitFor(() => expect(board.result.current.data?.entries).toHaveLength(2))
  })

  it('does not load a disabled leaderboard', () => {
    const fetchMock = installFakeApi()

    renderHook(() => useLeaderboard('score.classic', 'week', undefined, false), { wrapper: wrapperFor() })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
