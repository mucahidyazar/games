import type { TrolleyVoteRequest, TrolleyVoteResponse } from '@games/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyValueStore } from '@/games/trap-the-orb/storage/keyValueStore'
import { ApiError } from '@/lib/api/client'
import {
  createVoteSender,
  EMPTY_OUTBOX,
  isAwaitingDelivery,
  isRetryable,
  loadOutbox,
  OUTBOX_KEY,
  PACE_MS,
  queueVote,
  resendAnswers,
  retryDelay,
  saveOutbox,
  settleVote,
} from './voteOutbox'

const SAM = '7f1c2a54-9a1e-4c55-8d0e-2f7c6b3a1e90'
const ALEX = '0b9e2d31-4c7a-4f1b-9e2a-5d6c7b8a9f01'
const vote = (dilemmaId: TrolleyVoteRequest['dilemmaId'], choice: TrolleyVoteRequest['choice'] = 'pull', voterId = SAM): TrolleyVoteRequest => ({ dilemmaId, choice, voterId })

function memoryStore(): KeyValueStore & { readonly data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) }
}

describe('the outbox', () => {
  it('puts a vote just cast first, in place of what the voter still had waiting on that dilemma', () => {
    let outbox = queueVote(EMPTY_OUTBOX, vote('foot-oil'))
    outbox = queueVote(outbox, vote('foot-children'))
    outbox = queueVote(outbox, vote('foot-oil', 'stay'))
    expect(outbox.votes).toEqual([vote('foot-oil', 'stay'), vote('foot-children')])
    // Someone else's vote on the same dilemma is theirs.
    expect(queueVote(outbox, vote('foot-oil', 'pull', ALEX)).votes).toHaveLength(3)
  })

  it('takes a delivered vote off, unless the voter has changed their mind since', () => {
    const outbox = queueVote(EMPTY_OUTBOX, vote('foot-oil', 'stay'))
    expect(settleVote(outbox, vote('foot-oil', 'stay')).votes).toEqual([])
    expect(settleVote(outbox, vote('foot-oil', 'pull')).votes).toEqual([vote('foot-oil', 'stay')])
  })

  it('queues the saved answers of each voter once, behind the votes already waiting', () => {
    const waiting = queueVote(EMPTY_OUTBOX, vote('foot-oil', 'stay'))
    const voters = [{ voterId: SAM, answers: { 'foot-oil': 'pull', 'foot-children': 'stay' } as const }, { voterId: ALEX, answers: {} }]
    const outbox = resendAnswers(waiting, voters)
    // The vote waiting on the oil is newer than the saved answer.
    expect(outbox.votes).toEqual([vote('foot-oil', 'stay'), { ...vote('foot-children', 'stay'), resent: true }])
    expect(outbox.resent).toEqual([SAM, ALEX])
    expect(resendAnswers(outbox, voters)).toBe(outbox)
  })

  it('shows only a vote just cast as on its way', () => {
    const outbox = resendAnswers(queueVote(EMPTY_OUTBOX, vote('foot-oil')), [{ voterId: SAM, answers: { 'foot-gas': 'stay' } }])
    expect(isAwaitingDelivery(outbox, SAM, 'foot-oil')).toBe(true)
    expect(isAwaitingDelivery(outbox, SAM, 'foot-gas')).toBe(false)
    expect(isAwaitingDelivery(outbox, ALEX, 'foot-oil')).toBe(false)
  })

  it('is saved on the device and read back, without anything malformed', () => {
    const store = memoryStore()
    const outbox = resendAnswers(queueVote(EMPTY_OUTBOX, vote('foot-oil')), [{ voterId: SAM, answers: { 'foot-gas': 'stay' } }])
    saveOutbox(store, outbox)
    expect(loadOutbox(store)).toEqual(outbox)

    store.setItem(OUTBOX_KEY, JSON.stringify({ votes: [vote('foot-oil'), { ...vote('foot-oil'), voterId: 'nobody' }, { ...vote('foot-oil'), dilemmaId: 'retired' }, null], resent: [SAM, 7] }))
    expect(loadOutbox(store)).toEqual({ votes: [vote('foot-oil')], resent: [SAM] })
    store.setItem(OUTBOX_KEY, '{oops')
    expect(loadOutbox(store)).toEqual(EMPTY_OUTBOX)
  })
})

describe('retrying', () => {
  it('gives up only when the API itself turns a vote down', () => {
    expect(isRetryable(new ApiError('network', 'offline', 0))).toBe(true)
    expect(isRetryable(new ApiError('rate_limited', 'slow down', 429, 30))).toBe(true)
    expect(isRetryable(new ApiError('internal_error', 'boom', 500))).toBe(true)
    // A proxy or firewall answering instead of the API.
    expect(isRetryable(new ApiError('http_error', 'Request failed (502)', 502))).toBe(true)
    expect(isRetryable(new ApiError('http_error', 'Request failed (403)', 403))).toBe(true)
    expect(isRetryable(new TypeError('Failed to fetch'))).toBe(true)
    expect(isRetryable(new ApiError('bad_request', 'dilemmaId: invalid', 400))).toBe(false)
  })

  it('waits twice as long each time, up to five minutes, and as long as the server asks', () => {
    const offline = new ApiError('network', 'offline', 0)
    expect([1, 2, 3, 4].map((failures) => retryDelay(failures, offline))).toEqual([2000, 4000, 8000, 16_000])
    expect(retryDelay(20, offline)).toBe(300_000)
    expect(retryDelay(1, new ApiError('rate_limited', 'slow down', 429, 45))).toBe(45_000)
  })
})

describe('createVoteSender', () => {
  let store: ReturnType<typeof memoryStore>
  let send: ReturnType<typeof vi.fn<(request: TrolleyVoteRequest) => Promise<TrolleyVoteResponse>>>
  let onDelivered: ReturnType<typeof vi.fn<(response: TrolleyVoteResponse) => void>>
  const delivered = (request: TrolleyVoteRequest): Promise<TrolleyVoteResponse> => Promise.resolve({ dilemmaId: request.dilemmaId, tally: { pull: 1, stay: 0 } })
  const offline = (): Promise<TrolleyVoteResponse> => Promise.reject(new ApiError('network', 'Could not reach the server', 0))
  const started = () => {
    const sender = createVoteSender({ store, send, onDelivered })
    sender.start()
    return sender
  }

  beforeEach(() => {
    vi.useFakeTimers()
    store = memoryStore()
    send = vi.fn<(request: TrolleyVoteRequest) => Promise<TrolleyVoteResponse>>(delivered)
    onDelivered = vi.fn<(response: TrolleyVoteResponse) => void>()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends a vote straight away and lets it go once the server has it', async () => {
    const sender = started()
    sender.cast(vote('foot-children'))
    expect(send).toHaveBeenCalledWith(vote('foot-children'))
    await vi.advanceTimersByTimeAsync(0)
    expect(onDelivered).toHaveBeenCalledWith({ dilemmaId: 'foot-children', tally: { pull: 1, stay: 0 } })
    expect(sender.getSnapshot().votes).toEqual([])
    expect(loadOutbox(store).votes).toEqual([])
  })

  it('keeps a vote the server did not get, and sends it again until it does', async () => {
    send.mockImplementationOnce(offline).mockImplementationOnce(offline)
    const sender = started()
    sender.cast(vote('foot-education'))
    await vi.advanceTimersByTimeAsync(0)
    // Still on the device, should the tab close now.
    expect(loadOutbox(store).votes).toEqual([vote('foot-education')])
    await vi.advanceTimersByTimeAsync(1999)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(4000)
    expect(send).toHaveBeenCalledTimes(3)
    expect(sender.getSnapshot().votes).toEqual([])
    expect(onDelivered).toHaveBeenCalledTimes(1)
  })

  it('waits as long as a rate-limited server asks', async () => {
    send.mockImplementationOnce(() => Promise.reject(new ApiError('rate_limited', 'Too many requests.', 429, 30)))
    const sender = started()
    sender.cast(vote('foot-oil'))
    await vi.advanceTimersByTimeAsync(29_000)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(send).toHaveBeenCalledTimes(2)
    expect(sender.getSnapshot().votes).toEqual([])
  })

  it('drops a vote the API turns down and goes on with the next', async () => {
    send.mockImplementationOnce(() => Promise.reject(new ApiError('bad_request', 'dilemmaId: invalid', 400)))
    const sender = createVoteSender({ store, send, onDelivered })
    sender.cast(vote('foot-gas'))
    sender.cast(vote('foot-oil'))
    sender.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(send.mock.calls.map(([request]) => request.dilemmaId)).toEqual(['foot-oil', 'foot-gas'])
    expect(sender.getSnapshot().votes).toEqual([])
  })

  it('picks up after a reload what the last visit could not send', async () => {
    send.mockImplementation(offline)
    started().cast(vote('foot-children', 'stay'))
    await vi.advanceTimersByTimeAsync(0)

    send.mockImplementation(delivered)
    const reloaded = createVoteSender({ store, send, onDelivered })
    expect(reloaded.getSnapshot().votes).toEqual([vote('foot-children', 'stay')])
    reloaded.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenLastCalledWith(vote('foot-children', 'stay'))
    expect(loadOutbox(store).votes).toEqual([])
  })

  it('sends a backlog one vote at a time, under the API’s limit', async () => {
    const sender = started()
    sender.resend([{ voterId: SAM, answers: { 'foot-driver': 'pull', 'foot-judge': 'stay', 'foot-pilot': 'pull' } }])
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(PACE_MS)
    expect(send).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(PACE_MS)
    expect(send).toHaveBeenCalledTimes(3)
    expect(sender.getSnapshot()).toEqual({ votes: [], resent: [SAM] })
    // Once per voter: the next visit sends nothing again.
    sender.resend([{ voterId: SAM, answers: { 'foot-driver': 'pull' } }])
    await vi.advanceTimersByTimeAsync(PACE_MS)
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('tries again at once when the connection comes back', async () => {
    send.mockImplementationOnce(offline)
    const sender = started()
    sender.cast(vote('foot-lifeboat'))
    await vi.advanceTimersByTimeAsync(0)
    sender.flush()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('keeps a newer choice cast while the older one was on its way', async () => {
    let finish: (response: TrolleyVoteResponse) => void = () => undefined
    send.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    const sender = started()
    sender.cast(vote('foot-cave', 'pull'))
    sender.cast(vote('foot-cave', 'stay'))
    finish({ dilemmaId: 'foot-cave', tally: { pull: 1, stay: 0 } })
    await vi.advanceTimersByTimeAsync(0)
    expect(sender.getSnapshot().votes).toEqual([vote('foot-cave', 'stay')])
    await vi.advanceTimersByTimeAsync(PACE_MS)
    expect(send).toHaveBeenLastCalledWith(vote('foot-cave', 'stay'))
    expect(sender.getSnapshot().votes).toEqual([])
  })

  it('only queues until started, and stops waiting when stopped', async () => {
    send.mockImplementation(offline)
    const sender = createVoteSender({ store, send, onDelivered })
    sender.cast(vote('foot-rescue'))
    expect(send).not.toHaveBeenCalled()
    sender.start()
    await vi.advanceTimersByTimeAsync(0)
    sender.stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(send).toHaveBeenCalledTimes(1)
    expect(sender.getSnapshot().votes).toEqual([vote('foot-rescue')])
  })

  it('tells subscribers when the queue changes', () => {
    const sender = createVoteSender({ store, send, onDelivered })
    const listener = vi.fn()
    const unsubscribe = sender.subscribe(listener)
    sender.cast(vote('foot-madman'))
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    sender.cast(vote('foot-tyrant'))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
