import { isTrolleyVoteId, trolleyVoteRequestSchema, type TrolleyChoice, type TrolleyVoteId, type TrolleyVoteRequest, type TrolleyVoteResponse } from '@games/contract'
import { readJson, writeJson, type KeyValueStore } from '@/games/trap-the-orb/storage/keyValueStore'
import { ApiError } from '@/lib/api/client'

/**
 * Votes on their way to the server. A vote stays on the device until the
 * server has it, so a dropped connection, a busy or restarting server, rate
 * limiting or a closed tab only delays it. Voting again on a dilemma replaces
 * the device's earlier vote there, so a vote that arrives twice counts once.
 */

export const OUTBOX_KEY = 'absurdtrolley.v1.outbox'

export interface PendingVote extends TrolleyVoteRequest {
  /** Queued again from a saved answer rather than just cast. */
  readonly resent?: boolean
}

export interface Outbox {
  readonly votes: readonly PendingVote[]
  /** Voters whose saved answers have been queued again, once: before the outbox, a failed vote was lost. */
  readonly resent: readonly string[]
}

/** Whoever has played on this device, as far as voting goes. */
export interface Voter {
  readonly voterId: string
  readonly answers: Readonly<Partial<Record<TrolleyVoteId, TrolleyChoice>>>
}

export const EMPTY_OUTBOX: Outbox = { votes: [], resent: [] }

const sameBallot = (a: TrolleyVoteRequest, b: TrolleyVoteRequest): boolean => a.voterId === b.voterId && a.dilemmaId === b.dilemmaId

/** A vote just cast goes first, replacing whatever the voter still had waiting on that dilemma. */
export function queueVote(outbox: Outbox, vote: PendingVote): Outbox {
  return { ...outbox, votes: [vote, ...outbox.votes.filter((other) => !sameBallot(other, vote))] }
}

/** Takes a delivered (or refused) vote off the queue, unless the voter has changed their mind since. */
export function settleVote(outbox: Outbox, vote: TrolleyVoteRequest): Outbox {
  return { ...outbox, votes: outbox.votes.filter((other) => !(sameBallot(other, vote) && other.choice === vote.choice)) }
}

/** Queues the saved answers of voters not resent yet, behind the votes already waiting. */
export function resendAnswers(outbox: Outbox, voters: readonly Voter[]): Outbox {
  let next = outbox
  for (const { voterId, answers } of voters) {
    if (next.resent.includes(voterId)) continue
    const saved = Object.entries(answers).flatMap(([dilemmaId, choice]): PendingVote[] =>
      isTrolleyVoteId(dilemmaId) && choice ? [{ dilemmaId, choice, voterId, resent: true }] : [],
    )
    const waiting = next.votes
    next = { votes: [...waiting, ...saved.filter((vote) => !waiting.some((other) => sameBallot(other, vote)))], resent: [...next.resent, voterId] }
  }
  return next
}

/** A vote the voter just cast and the server does not have yet; its tally is shown with it. */
export function isAwaitingDelivery(outbox: Outbox, voterId: string, dilemmaId: TrolleyVoteId): boolean {
  return outbox.votes.some((vote) => !vote.resent && vote.voterId === voterId && vote.dilemmaId === dilemmaId)
}

/** The saved outbox; votes that are not well-formed are dropped. */
export function loadOutbox(store: KeyValueStore | null): Outbox {
  const raw = readJson(store, OUTBOX_KEY)
  if (typeof raw !== 'object' || raw === null) return EMPTY_OUTBOX
  const record = raw as Record<string, unknown>
  const votes = (Array.isArray(record.votes) ? record.votes : []).flatMap((entry: unknown): PendingVote[] => {
    const parsed = trolleyVoteRequestSchema.safeParse(entry)
    if (!parsed.success) return []
    const resent = (entry as Record<string, unknown>).resent === true
    return [resent ? { ...parsed.data, resent } : parsed.data]
  })
  const resent = (Array.isArray(record.resent) ? record.resent : []).filter((id: unknown): id is string => typeof id === 'string')
  return { votes, resent }
}

export function saveOutbox(store: KeyValueStore | null, outbox: Outbox): boolean {
  return writeJson(store, OUTBOX_KEY, outbox)
}

/**
 * Whether sending again could work. Only the API itself turning the vote down
 * (a bad request) is final; anything else can pass later: no connection, a
 * timeout, rate limiting, a server error, or a proxy or firewall in the way.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true
  const refused = error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429
  return !(refused && error.code !== 'http_error')
}

const FIRST_RETRY_MS = 2000
const LONGEST_RETRY_MS = 5 * 60_000
/** Between two votes in a row: a backlog drains at under 60 a minute, the API's limit per address. */
export const PACE_MS = 1100

/** Doubles from 2 s up to 5 min, and never sooner than the server asked. */
export function retryDelay(failures: number, error: unknown): number {
  const backoff = Math.min(LONGEST_RETRY_MS, FIRST_RETRY_MS * 2 ** Math.max(0, failures - 1))
  const asked = error instanceof ApiError && error.retryAfter !== null ? error.retryAfter * 1000 : 0
  return Math.max(backoff, asked)
}

export interface VoteSenderOptions {
  readonly store: KeyValueStore | null
  readonly send: (vote: TrolleyVoteRequest) => Promise<TrolleyVoteResponse>
  /** The server's fresh tally for the dilemma just voted on. */
  readonly onDelivered: (response: TrolleyVoteResponse) => void
  readonly setTimer?: (callback: () => void, ms: number) => unknown
  readonly clearTimer?: (timer: unknown) => void
}

export interface VoteSender {
  /** Queues a vote and sends it straight away. */
  cast(vote: TrolleyVoteRequest): void
  /** Queues every saved answer once per voter, so that votes lost before the outbox still arrive. */
  resend(voters: readonly Voter[]): void
  /** Tries the queue now rather than after the wait for a retry (the connection is back). */
  flush(): void
  /** Sends while started; votes cast meanwhile only queue. */
  start(): void
  stop(): void
  subscribe(listener: () => void): () => void
  getSnapshot(): Outbox
}

/** Sends the outbox one vote at a time, oldest wait first after the newest vote. */
export function createVoteSender({
  store,
  send,
  onDelivered,
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
}: VoteSenderOptions): VoteSender {
  let outbox = loadOutbox(store)
  let running = false
  let sending = false
  let failures = 0
  let timer: unknown = null
  const listeners = new Set<() => void>()

  const update = (next: Outbox): void => {
    outbox = next
    saveOutbox(store, next)
    for (const listener of listeners) listener()
  }

  const cancelWait = (): void => {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  const wait = (ms: number): void => {
    cancelWait()
    if (!running) return
    timer = setTimer(() => {
      timer = null
      pump()
    }, ms)
  }

  const pump = (): void => {
    const vote = outbox.votes[0]
    if (!running || sending || timer !== null || !vote) return
    sending = true
    const request: TrolleyVoteRequest = { dilemmaId: vote.dilemmaId, choice: vote.choice, voterId: vote.voterId }
    send(request).then(
      (response) => {
        sending = false
        failures = 0
        update(settleVote(outbox, request))
        onDelivered(response)
        if (outbox.votes.length > 0) wait(PACE_MS)
      },
      (error: unknown) => {
        sending = false
        if (isRetryable(error)) {
          failures += 1
          wait(retryDelay(failures, error))
          return
        }
        update(settleVote(outbox, request))
        pump()
      },
    )
  }

  const flush = (): void => {
    cancelWait()
    pump()
  }

  return {
    cast(vote) {
      update(queueVote(outbox, vote))
      flush()
    },
    resend(voters) {
      const next = resendAnswers(outbox, voters)
      if (next === outbox) return
      update(next)
      pump()
    },
    flush,
    start() {
      running = true
      pump()
    },
    stop() {
      running = false
      cancelWait()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => outbox,
  }
}
