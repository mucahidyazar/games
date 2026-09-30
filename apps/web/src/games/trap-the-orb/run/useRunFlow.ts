import { utcDateKey, type FinishRunRequest, type FinishRunResponse, type StartRunRequest } from '@games/contract'
import { dailySeed, isRankedMode, randomSeed, type GameMode } from '@games/trap-the-orb-engine'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { api, ApiError, finishRunOnExit } from '@/lib/api/client'
import type { ControllerEvent, GameController, RunRecording } from '../controller/GameController'
import type { SavedRun } from '../storage/savedRun'

export type AccountStatus = 'loading' | 'signedIn' | 'anonymous'

export interface RunFlowAccount {
  readonly status: AccountStatus
  /** Null until a signed-in player picks a nickname. */
  readonly nickname: string | null
}

/** Why a finished run was not verified by the server. */
export type LocalReason = 'guest' | 'casual' | 'offline' | 'submittedOnExit'

export type Verification =
  | { readonly status: 'local'; readonly reason: LocalReason }
  | { readonly status: 'pending' }
  | { readonly status: 'verified'; readonly response: FinishRunResponse }
  | { readonly status: 'failed'; readonly error: ApiError }

export interface RunResult {
  readonly id: number
  readonly mode: GameMode
  readonly score: number
  readonly level: number
  /** The player ended the run before running out of lives, time or walls. */
  readonly endedEarly: boolean
  readonly verification: Verification
}

export interface RunFlow {
  /** Waiting for the server to hand out a ranked run. */
  readonly isStarting: boolean
  readonly startError: ApiError | null
  /** The run in progress is replayed and ranked by the server when it ends. */
  readonly isServerRun: boolean
  /** The run that just ended, until the player moves on. */
  readonly result: RunResult | null
  start(): void
  /** After a failed start: play the same mode without ranking. */
  startOffline(): void
  continueSaved(saved: SavedRun): void
  /** Ends the run in progress now; its score so far still counts. */
  endRun(): void
  retrySubmit(): void
  /** Clears the result and any start error, e.g. when the mode changes. */
  reset(): void
}

export interface RunFlowOptions {
  readonly controller: GameController
  readonly account: RunFlowAccount
  /** A signed-in player must pick a nickname before playing ranked. */
  readonly onNeedNickname: () => void
  /** A run was verified: leaderboards and the profile are out of date. */
  readonly onRunVerified: () => void
}

type RankedMode = StartRunRequest['mode']

interface ServerRun {
  readonly runId: string
  readonly mode: RankedMode
}

interface Submission {
  readonly resultId: number
  readonly run: ServerRun
  readonly request: FinishRunRequest
}

const isServerRankedMode = (mode: GameMode): mode is RankedMode => isRankedMode(mode)

const toApiError = (error: unknown): ApiError =>
  error instanceof ApiError ? error : new ApiError('unexpected', 'Something went wrong', 0)

function toFinishRequest(recording: RunRecording): FinishRunRequest {
  return {
    endTick: recording.endTick,
    inputs: [...recording.inputs],
    clientScore: recording.score,
    clientLevel: recording.level,
  }
}

/**
 * Starts and finishes runs. Ranked modes played by a signed-in player with a
 * nickname get their seed from the server and are sent back for replay when
 * they end; everything else is played locally.
 */
export function useRunFlow({ controller, account, onNeedNickname, onRunVerified }: RunFlowOptions): RunFlow {
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<ApiError | null>(null)
  const [isServerRun, setIsServerRun] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const serverRunRef = useRef<ServerRun | null>(null)
  const localReasonRef = useRef<LocalReason>('guest')
  const submissionRef = useRef<Submission | null>(null)
  const exitSubmittedRef = useRef(false)
  const resultIdRef = useRef(0)
  /** Bumped by every start and reset, so an answer to an outdated start request is ignored. */
  const startTokenRef = useRef(0)

  const updateResult = (id: number, patch: Partial<RunResult>): void => {
    setResult((current) => (current?.id === id ? { ...current, ...patch } : current))
  }

  const submit = (submission: Submission): void => {
    submissionRef.current = submission
    updateResult(submission.resultId, { verification: { status: 'pending' } })
    api
      .finishRun(submission.run.runId, submission.request)
      .then((response) => {
        if (submissionRef.current === submission) submissionRef.current = null
        const { score, level } = response.result
        updateResult(submission.resultId, { score, level, verification: { status: 'verified', response } })
        onRunVerified()
      })
      .catch((error: unknown) => {
        updateResult(submission.resultId, { verification: { status: 'failed', error: toApiError(error) } })
      })
  }

  const finishRun = (endedEarly: boolean): void => {
    const recording = controller.getRecording()
    if (!recording) return
    const run = serverRunRef.current
    serverRunRef.current = null
    setIsServerRun(false)

    resultIdRef.current += 1
    const id = resultIdRef.current
    const base = { id, mode: recording.mode, score: recording.score, level: recording.level, endedEarly }
    if (!run || exitSubmittedRef.current) {
      const reason = exitSubmittedRef.current ? 'submittedOnExit' : localReasonRef.current
      setResult({ ...base, verification: { status: 'local', reason } })
      return
    }
    setResult({ ...base, verification: { status: 'pending' } })
    submit({ resultId: id, run, request: toFinishRequest(recording) })
  }

  const beginLocalRun = (reason: LocalReason, progress: { level?: number; score?: number } = {}): void => {
    const { mode } = controller.getMode()
    serverRunRef.current = null
    localReasonRef.current = reason
    exitSubmittedRef.current = false
    setIsServerRun(false)
    setResult(null)
    setStartError(null)
    // Everyone gets the same Daily layout, signed in or not.
    const seed = mode === 'daily' ? dailySeed(utcDateKey(new Date())) : randomSeed()
    controller.startRun({ seed, ...progress })
  }

  const start = (): void => {
    if (isStarting || account.status === 'loading') return
    const { mode } = controller.getMode()
    if (!isServerRankedMode(mode)) return beginLocalRun('casual')
    if (account.status !== 'signedIn') return beginLocalRun('guest')
    if (!account.nickname) return onNeedNickname()

    startTokenRef.current += 1
    const token = startTokenRef.current
    const isCurrent = (): boolean => token === startTokenRef.current
    setIsStarting(true)
    setStartError(null)
    setResult(null)
    api
      .startRun({ mode, field: controller.getFieldOrientation() })
      .then((run) => {
        if (!isCurrent() || controller.getMode().mode !== run.mode || controller.isRunActive()) return
        serverRunRef.current = { runId: run.runId, mode: run.mode }
        exitSubmittedRef.current = false
        setIsServerRun(true)
        controller.startRun({ seed: run.seed, field: run.field })
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return
        const apiError = toApiError(error)
        // The nickname was removed or never saved on the server: ask for it instead of failing.
        if (apiError.code === 'nickname_required') onNeedNickname()
        else setStartError(apiError)
      })
      .finally(() => {
        if (isCurrent()) setIsStarting(false)
      })
  }

  const endRun = (): void => {
    if (!controller.isRunActive()) return
    finishRun(true)
    controller.endRun()
  }

  const handleEvents = useEffectEvent((events: readonly ControllerEvent[]) => {
    if (events.some((event) => event.type === 'gameOver')) finishRun(false)
  })

  /*
   * Leaving the page mid-run submits the run so far, and the run ends right
   * there: the server now holds that result, so if the page survives (back
   * from the page cache, or a browser that fires pagehide without unloading)
   * the player sees it ended instead of playing on into a run that no longer
   * counts. A recording too large for a keep-alive request is not sent; the
   * run then simply carries on.
   */
  const handlePageHide = useEffectEvent(() => {
    const run = serverRunRef.current
    const recording = controller.getRecording()
    if (!run || !recording || !controller.isRunActive()) return
    if (!finishRunOnExit(run.runId, toFinishRequest(recording))) return
    exitSubmittedRef.current = true
    finishRun(true)
    controller.endRun()
  })

  useEffect(() => controller.onGameEvents((events) => handleEvents(events)), [controller])

  useEffect(() => {
    const onPageHide = (): void => handlePageHide()
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])

  return {
    isStarting,
    startError,
    isServerRun,
    result,
    start,
    startOffline: () => beginLocalRun('offline'),
    continueSaved(saved) {
      controller.setMode(saved.mode, saved.custom)
      beginLocalRun('casual', { level: saved.level, score: saved.score })
    },
    endRun,
    retrySubmit() {
      const submission = submissionRef.current
      if (submission) submit(submission)
    },
    reset() {
      // Forget a start request still in flight: the player moved on (for example to another mode).
      startTokenRef.current += 1
      setIsStarting(false)
      setResult(null)
      setStartError(null)
    },
  }
}
