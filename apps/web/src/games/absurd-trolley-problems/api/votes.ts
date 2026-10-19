import {
  trolleyTalliesResponseSchema,
  trolleyVoteResponseSchema,
  type TrolleyTalliesResponse,
  type TrolleyVoteRequest,
  type TrolleyVoteResponse,
} from '@games/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api/client'

export const talliesKey = ['trolley', 'tallies'] as const

export const trolleyApi = {
  tallies: (signal?: AbortSignal): Promise<TrolleyTalliesResponse> =>
    apiRequest('/api/trolley/tallies', { schema: trolleyTalliesResponseSchema, signal }),
  vote: (request: TrolleyVoteRequest): Promise<TrolleyVoteResponse> =>
    // keepalive: a vote cast just before the tab closes still counts.
    apiRequest('/api/trolley/votes', { method: 'POST', body: request, schema: trolleyVoteResponseSchema, keepalive: true }),
}

/** How the community voted on every dilemma; refreshed now and then while playing. */
export function useTallies() {
  return useQuery({
    queryKey: talliesKey,
    queryFn: ({ signal }) => trolleyApi.tallies(signal),
    staleTime: 60_000,
  })
}

/** Sends a vote and folds the server's fresh tally into the cached ones. */
export function useCastVote() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: trolleyApi.vote,
    onSuccess: ({ dilemmaId, tally }) => {
      client.setQueryData<TrolleyTalliesResponse>(talliesKey, (current) => ({ tallies: { ...current?.tallies, [dilemmaId]: tally } }))
    },
  })
}
