import type { FinishRunResponse } from '@games/contract'
import { dailySeed } from '@games/trap-the-orb-engine'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, finishRunOnExit } from '@/lib/api/client'
import type { SoundPlayer } from '../audio/sfx'
import { GameController } from '../controller/GameController'
import { useRunFlow, type RunFlowAccount } from './useRunFlow'

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>()
  return {
    ...actual,
    api: { ...actual.api, startRun: vi.fn(), finishRun: vi.fn() },
    finishRunOnExit: vi.fn(() => true),
  }
})

const fakeSound = (): SoundPlayer => ({ play: vi.fn(), unlock: vi.fn(), setEnabled: vi.fn() })

const GUEST: RunFlowAccount = { status: 'anonymous', nickname: null }
const PLAYER: RunFlowAccount = { status: 'signedIn', nickname: 'Luna' }

const verifiedResponse = (score: number): FinishRunResponse => ({
  result: {
    status: 'gameOver',
    gameOverReason: 'lives',
    score,
    level: 1,
    levelsCleared: 0,
    stats: {
      levelsCleared: 0,
      highestLevel: 1,
      wallsBuilt: 2,
      wallsBroken: 4,
      tightestTrapPct: null,
      biggestCapturePct: 0,
      bestClearPct: null,
      perfectStreak: 0,
      bestPerfectStreak: 0,
      fastestClearRatio: null,
      maxRegionsInOneWall: 0,
      fewestWallsClear: null,
    },
  },
  ranked: true,
  newBadges: [],
  records: [],
})

function setup(account: RunFlowAccount = GUEST) {
  const controller = new GameController({ sound: fakeSound(), seed: 4 })
  controller.resize(1000, 500)
  const onNeedNickname = vi.fn()
  const onRunVerified = vi.fn()
  const hook = renderHook((props: { account: RunFlowAccount }) =>
    useRunFlow({ controller, account: props.account, onNeedNickname, onRunVerified }),
  { initialProps: { account } })
  return { controller, onNeedNickname, onRunVerified, ...hook }
}

/** Breaks walls on the first orb until the Classic run is over (two lives at level 1). */
function loseRun(controller: GameController): void {
  let time = 1000
  for (let attempt = 0; attempt < 4 && controller.getHud().status === 'playing'; attempt++) {
    const ball = controller.getState()?.balls[0]
    if (!ball) throw new Error('expected an orb')
    act(() => {
      controller.buildAt({ col: Math.floor(ball.x), row: Math.floor(ball.y) }, 'vertical')
      for (let frame = 0; frame < 8; frame++) {
        controller.advance(time)
        time += 1000 / 60
      }
    })
  }
  expect(controller.getHud().status).toBe('gameOver')
}

beforeEach(() => {
  vi.mocked(api.startRun).mockResolvedValue({
    runId: 'run-1',
    seed: 1234,
    mode: 'classic',
    field: 'landscape',
    dailyDate: null,
    ranked: true,
  })
  vi.mocked(api.finishRun).mockResolvedValue(verifiedResponse(170))
  vi.mocked(finishRunOnExit).mockReturnValue(true)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useRunFlow locally', () => {
  it('plays practice modes locally and never calls the server', () => {
    const { controller, result } = setup(PLAYER)
    controller.setMode('zen')

    act(() => result.current.start())

    expect(controller.getHud()).toMatchObject({ status: 'playing', inRun: true, mode: 'zen' })
    expect(api.startRun).not.toHaveBeenCalled()
    expect(result.current.isServerRun).toBe(false)
  })

  it('plays guests locally and reports the result as a guest run', () => {
    const { controller, result } = setup(GUEST)

    act(() => result.current.start())
    loseRun(controller)

    expect(api.startRun).not.toHaveBeenCalled()
    expect(result.current.result).toMatchObject({
      mode: 'classic',
      level: 1,
      endedEarly: false,
      verification: { status: 'local', reason: 'guest' },
    })
  })

  it('gives guests the shared Daily layout', () => {
    const { controller, result } = setup(GUEST)
    controller.setMode('daily')
    const start = vi.spyOn(controller, 'startRun')

    act(() => result.current.start())

    const today = new Date().toISOString().slice(0, 10)
    expect(start).toHaveBeenCalledWith({ seed: dailySeed(today) })
  })

  it('waits while the account is still loading', () => {
    const { controller, result } = setup({ status: 'loading', nickname: null })

    act(() => result.current.start())

    expect(controller.getHud().inRun).toBe(false)
  })

  it('asks for a nickname before a ranked run', () => {
    const { controller, result, onNeedNickname } = setup({ status: 'signedIn', nickname: null })

    act(() => result.current.start())

    expect(onNeedNickname).toHaveBeenCalledOnce()
    expect(controller.getHud().inRun).toBe(false)
  })

  it('continues a saved practice run at its level', () => {
    const { controller, result } = setup(GUEST)

    act(() => result.current.continueSaved({ mode: 'zen', custom: null, level: 5, score: 800, savedAt: 1 }))

    expect(controller.getHud()).toMatchObject({ mode: 'zen', level: 5, score: 800, status: 'playing' })
  })
})

describe('useRunFlow ranked', () => {
  it('starts with the server’s seed and field, then submits the run for replay', async () => {
    const { controller, result, onRunVerified } = setup(PLAYER)
    const start = vi.spyOn(controller, 'startRun')

    act(() => result.current.start())
    expect(result.current.isStarting).toBe(true)
    await waitFor(() => expect(result.current.isServerRun).toBe(true))

    expect(api.startRun).toHaveBeenCalledWith({ mode: 'classic', field: 'landscape' })
    expect(start).toHaveBeenCalledWith({ seed: 1234, field: 'landscape' })
    expect(result.current.isStarting).toBe(false)

    loseRun(controller)
    expect(result.current.result?.verification).toEqual({ status: 'pending' })
    await waitFor(() => expect(result.current.result?.verification.status).toBe('verified'))

    const request = vi.mocked(api.finishRun).mock.calls[0]?.[1]
    expect(vi.mocked(api.finishRun).mock.calls[0]?.[0]).toBe('run-1')
    expect(request?.inputs.length).toBeGreaterThan(0)
    expect(request?.endTick).toBe(controller.getState()?.tick)
    expect(result.current.result?.score).toBe(170)
    expect(onRunVerified).toHaveBeenCalledOnce()
  })

  it('shows why a ranked start failed and can play unranked instead', async () => {
    vi.mocked(api.startRun).mockRejectedValueOnce(new ApiError('network', 'Could not reach the server', 0))
    const { controller, result } = setup(PLAYER)

    act(() => result.current.start())
    await waitFor(() => expect(result.current.startError?.code).toBe('network'))

    act(() => result.current.startOffline())
    expect(result.current.startError).toBeNull()
    loseRun(controller)
    expect(result.current.result?.verification).toEqual({ status: 'local', reason: 'offline' })
  })

  it('asks for a nickname when the server wants one', async () => {
    vi.mocked(api.startRun).mockRejectedValueOnce(new ApiError('nickname_required', 'Pick a nickname first.', 409))
    const { result, onNeedNickname } = setup(PLAYER)

    act(() => result.current.start())

    await waitFor(() => expect(onNeedNickname).toHaveBeenCalledOnce())
    expect(result.current.startError).toBeNull()
  })

  it('wraps unexpected start failures', async () => {
    vi.mocked(api.startRun).mockRejectedValueOnce(new Error('boom'))
    const { result } = setup(PLAYER)

    act(() => result.current.start())

    await waitFor(() => expect(result.current.startError?.code).toBe('unexpected'))
  })

  it('forgets a start request once the flow is reset, so Play works again at once', async () => {
    let resolveStart: (value: Awaited<ReturnType<typeof api.startRun>>) => void = () => undefined
    vi.mocked(api.startRun).mockReturnValueOnce(new Promise((resolve) => (resolveStart = resolve)))
    const { controller, result } = setup(PLAYER)

    act(() => result.current.start())
    expect(result.current.isStarting).toBe(true)
    act(() => result.current.reset())
    expect(result.current.isStarting).toBe(false)

    act(() => result.current.start())
    await waitFor(() => expect(result.current.isServerRun).toBe(true))
    const seedsBefore = controller.getRecording()?.seed
    await act(async () => {
      resolveStart({ runId: 'stale', seed: 1, mode: 'classic', field: 'landscape', dailyDate: null, ranked: true })
    })

    expect(controller.getRecording()?.seed).toBe(seedsBefore)
    expect(result.current.isStarting).toBe(false)
  })

  it('ignores a server run that arrives after the player switched modes', async () => {
    const { controller, result } = setup(PLAYER)

    act(() => result.current.start())
    controller.setMode('zen')
    await waitFor(() => expect(result.current.isStarting).toBe(false))

    expect(controller.getHud().inRun).toBe(false)
    expect(result.current.isServerRun).toBe(false)
  })

  it('keeps a failed submission for a retry', async () => {
    vi.mocked(api.finishRun).mockRejectedValueOnce(new ApiError('network', 'Could not reach the server', 0))
    const { controller, result } = setup(PLAYER)
    act(() => result.current.start())
    await waitFor(() => expect(result.current.isServerRun).toBe(true))

    loseRun(controller)
    await waitFor(() => expect(result.current.result?.verification.status).toBe('failed'))

    act(() => result.current.retrySubmit())
    await waitFor(() => expect(result.current.result?.verification.status).toBe('verified'))
    expect(api.finishRun).toHaveBeenCalledTimes(2)
  })

  it('ends a ranked run early and still submits it', async () => {
    const { controller, result } = setup(PLAYER)
    act(() => result.current.start())
    await waitFor(() => expect(result.current.isServerRun).toBe(true))

    act(() => result.current.endRun())

    expect(controller.getHud()).toMatchObject({ status: 'gameOver', gameOverReason: null })
    expect(controller.isRunActive()).toBe(false)
    expect(result.current.result).toMatchObject({ endedEarly: true })
    await waitFor(() => expect(result.current.result?.verification.status).toBe('verified'))
  })

  it('submits the run when the page is hidden and ends it there', async () => {
    const { controller, result } = setup(PLAYER)
    act(() => result.current.start())
    await waitFor(() => expect(result.current.isServerRun).toBe(true))

    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })

    expect(finishRunOnExit).toHaveBeenCalledWith('run-1', expect.objectContaining({ clientLevel: 1 }))
    expect(controller.isRunActive()).toBe(false)
    expect(result.current.result).toMatchObject({
      endedEarly: true,
      verification: { status: 'local', reason: 'submittedOnExit' },
    })
    expect(api.finishRun).not.toHaveBeenCalled()
  })

  it('keeps playing when the recording is too large to send on the way out', async () => {
    vi.mocked(finishRunOnExit).mockReturnValue(false)
    const { controller, result } = setup(PLAYER)
    act(() => result.current.start())
    await waitFor(() => expect(result.current.isServerRun).toBe(true))

    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })

    expect(controller.isRunActive()).toBe(true)
    loseRun(controller)
    await waitFor(() => expect(result.current.result?.verification.status).toBe('verified'))
  })

  it('does nothing on page hide without a ranked run', () => {
    setup(GUEST)

    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })

    expect(finishRunOnExit).not.toHaveBeenCalled()
  })

  it('clears the result and the start error on reset', async () => {
    vi.mocked(api.startRun).mockRejectedValueOnce(new ApiError('network', 'Could not reach the server', 0))
    const { result } = setup(PLAYER)
    act(() => result.current.start())
    await waitFor(() => expect(result.current.startError).not.toBeNull())

    act(() => result.current.reset())

    expect(result.current.startError).toBeNull()
    expect(result.current.result).toBeNull()
  })
})
