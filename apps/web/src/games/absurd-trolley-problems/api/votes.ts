import {
  trolleyTalliesResponseSchema,
  trolleyVoteResponseSchema,
  type TrolleyTalliesResponse,
  type TrolleyVoteRequest,
  type TrolleyVoteResponse,
} from '@games/contract'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { KeyValueStore } from '@/games/trap-the-orb/storage/keyValueStore'
import { apiRequest } from '@/lib/api/client'
import { createVoteSender, type Outbox, type Voter } from './voteOutbox'

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

export interface VoteOutbox {
  /** The votes still on their way. */
  readonly outbox: Outbox
  cast(vote: TrolleyVoteRequest): void
  resend(voters: readonly Voter[]): void
}

/**
 * The device's votes, sent until the server has each one (see voteOutbox.ts),
 * with the server's fresh tally folded into the cached ones.
 */
export function useVoteOutbox(store: KeyValueStore | null): VoteOutbox {
  const client = useQueryClient()
  const [sender] = useState(() =>
    createVoteSender({
      store,
      send: trolleyApi.vote,
      onDelivered: ({ dilemmaId, tally }) => {
        client.setQueryData<TrolleyTalliesResponse>(talliesKey, (current) => ({ tallies: { ...current?.tallies, [dilemmaId]: tally } }))
      },
    }),
  )
  useEffect(() => {
    sender.start()
    const online = (): void => sender.flush()
    window.addEventListener('online', online)
    return () => {
      window.removeEventListener('online', online)
      sender.stop()
    }
  }, [sender])
  const outbox = useSyncExternalStore(sender.subscribe, sender.getSnapshot)
  return useMemo(() => ({ outbox, cast: sender.cast, resend: sender.resend }), [outbox, sender])
}
