import type { BoardId, BoardPeriod } from '@games/contract'
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api/client'
import { authClient } from './authClient'

export const queryKeys = {
  config: ['config'] as const,
  me: ['me'] as const,
  leaderboards: ['leaderboard'] as const,
  leaderboard: (board: BoardId, period: BoardPeriod, date: string | undefined) =>
    ['leaderboard', board, period, date ?? null] as const,
}

/** Retries network hiccups, but never client errors such as 401 or 404. */
const shouldRetry = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500)

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
    },
  })
}

/** Which sign-in methods the server has configured (null while unknown or offline). */
export function useAuthConfig() {
  return useQuery({ queryKey: queryKeys.config, queryFn: api.config, staleTime: Infinity })
}

/**
 * The signed-in player: session from Better Auth plus our profile, badges and
 * records. `status` is 'anonymous' when nobody is signed in.
 */
export function useAccount() {
  const session = authClient.useSession()
  const isSignedIn = Boolean(session.data?.user)
  const me = useQuery({ queryKey: queryKeys.me, queryFn: api.me, enabled: isSignedIn })

  return {
    status: session.isPending ? ('loading' as const) : isSignedIn ? ('signedIn' as const) : ('anonymous' as const),
    user: session.data?.user ?? null,
    me: me.data ?? null,
    nickname: me.data?.profile?.nickname ?? null,
    isLoadingProfile: isSignedIn && me.isPending,
    refetchSession: session.refetch,
  }
}

export function useLeaderboard(board: BoardId, period: BoardPeriod, date?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.leaderboard(board, period, date),
    queryFn: ({ signal }) => api.leaderboard({ board, period, date }, signal),
    enabled,
  })
}

export function useUpdateNickname() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.me })
      void client.invalidateQueries({ queryKey: queryKeys.leaderboards })
    },
  })
}

export function useSignOut() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await authClient.signOut()
    },
    onSuccess: () => {
      client.removeQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useDeleteAccount() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: async () => {
      client.removeQueries({ queryKey: queryKeys.me })
      await client.invalidateQueries({ queryKey: queryKeys.leaderboards })
      await authClient.getSession()
    },
  })
}

/** Refreshes profile-dependent data after a verified run. */
export function useRefreshAfterRun(): () => void {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.me })
    void client.invalidateQueries({ queryKey: queryKeys.leaderboards })
  }
}
