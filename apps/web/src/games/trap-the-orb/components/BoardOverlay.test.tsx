import type { FinishRunResponse } from '@games/contract'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/client'
import type { SoundPlayer } from '../audio/sfx'
import { GameController, INITIAL_HUD, type HudSnapshot } from '../controller/GameController'
import type { RunFlow, RunResult, Verification } from '../run/useRunFlow'
import { PlayerDataProvider } from '../state/PlayerDataProvider'
import { createPlayerStore } from '../state/playerStore'
import type { SavedRun } from '../storage/savedRun'
import { createMemoryStore } from '../storage/memoryStore'
import { BoardOverlay, type OverlayAccount } from './BoardOverlay'

const fakeSound = (): SoundPlayer => ({ play: vi.fn(), unlock: vi.fn(), setEnabled: vi.fn() })

const fakeFlow = (overrides: Partial<RunFlow> = {}): RunFlow => ({
  isStarting: false,
  startError: null,
  isServerRun: false,
  result: null,
  start: vi.fn(),
  startOffline: vi.fn(),
  continueSaved: vi.fn(),
  endRun: vi.fn(),
  retrySubmit: vi.fn(),
  reset: vi.fn(),
  ...overrides,
})

const GUEST: OverlayAccount = { status: 'anonymous', nickname: null, hasPlayedDailyToday: false }
const RANKED_PLAYER: OverlayAccount = { status: 'signedIn', nickname: 'Luna', hasPlayedDailyToday: false }

type SetupOptions = {
  readonly flow?: Partial<RunFlow>
  readonly account?: OverlayAccount
  readonly savedRun?: SavedRun | null
}

function setup(hud: Partial<HudSnapshot>, { flow: flowOverrides, account = GUEST, savedRun = null }: SetupOptions = {}) {
  const controller = new GameController({ sound: fakeSound(), seed: 5 })
  controller.resize(1000, 500)
  const store = createPlayerStore(createMemoryStore(), fakeSound())
  const flow = fakeFlow(flowOverrides)
  const handlers = {
    onBackToReady: vi.fn(),
    onLeaveRun: vi.fn(),
    onOpenDialog: vi.fn(),
    onAfterAction: vi.fn(),
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PlayerDataProvider store={store}>{children}</PlayerDataProvider>
  )

  render(
    <BoardOverlay
      hud={{ ...INITIAL_HUD, ...hud }}
      controller={controller}
      flow={flow}
      account={account}
      savedRun={savedRun}
      {...handlers}
    />,
    { wrapper },
  )
  return { controller, store, flow, ...handlers, user: userEvent.setup() }
}

const result = (verification: Verification, overrides: Partial<RunResult> = {}): RunResult => ({
  id: 1,
  mode: 'classic',
  score: 4200,
  level: 5,
  endedEarly: false,
  verification,
  ...overrides,
})

const verified = (overrides: Partial<FinishRunResponse> = {}): Verification => ({
  status: 'verified',
  response: {
    result: {
      status: 'gameOver',
      gameOverReason: 'lives',
      score: 4200,
      level: 5,
      levelsCleared: 4,
      stats: {
        levelsCleared: 4,
        highestLevel: 5,
        wallsBuilt: 20,
        wallsBroken: 3,
        tightestTrapPct: 2.5,
        biggestCapturePct: 30,
        bestClearPct: 88,
        perfectStreak: 0,
        bestPerfectStreak: 2,
        fastestClearRatio: 0.7,
        maxRegionsInOneWall: 2,
        fewestWallsClear: 5,
      },
    },
    ranked: true,
    newBadges: [],
    records: [],
    ...overrides,
  },
})

describe('BoardOverlay', () => {
  it('renders nothing while a level is in play', () => {
    setup({ status: 'playing', inRun: true })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('ReadyPanel', () => {
  it('lists every mode next to the chosen one and starts it', async () => {
    const { flow, onAfterAction, onOpenDialog, user } = setup({ status: 'ready', mode: 'classic' })

    const modes = screen.getByRole('navigation', { name: 'Game modes' })
    expect(within(modes).getAllByRole('link')).toHaveLength(7)
    expect(within(modes).getByRole('link', { name: /Classic/ })).toHaveAttribute('aria-current', 'true')
    expect(within(modes).getByRole('link', { name: /Hardcore/ })).toHaveAttribute('href', '/trap-the-orb/play/hardcore')
    expect(screen.getByRole('heading', { name: 'The original challenge' })).toBeInTheDocument()
    expect(screen.getByText('Ranked', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Rules' })).toHaveTextContent('Clear at 75%')

    await user.click(screen.getByRole('button', { name: /play classic/i }))
    expect(flow.start).toHaveBeenCalledOnce()
    expect(onAfterAction).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'How to play' }))
    expect(onOpenDialog).toHaveBeenCalledWith('how-to-play')
  })

  it('picks a mode without starting it and without adding history', async () => {
    const { flow, user } = setup({ status: 'ready', mode: 'classic' })
    const length = window.history.length

    await user.click(screen.getByRole('link', { name: /Time Attack/ }))

    expect(window.location.pathname).toBe('/trap-the-orb/play/timeAttack')
    expect(window.history.length).toBe(length)
    expect(flow.start).not.toHaveBeenCalled()
    window.history.replaceState(null, '', '/')
  })

  it('folds the mode list behind a Change button on narrow boards', async () => {
    const { user } = setup({ status: 'ready', mode: 'zen', rankedMode: false })
    const toggle = screen.getByRole('button', { name: 'Change mode (now Zen)' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('link', { name: /Custom/ }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    window.history.replaceState(null, '', '/')
  })

  it('shows progress while the server starts a ranked run', () => {
    setup({ status: 'ready' }, { flow: { isStarting: true }, account: RANKED_PLAYER })

    expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled()
  })

  it('invites guests to sign in to be ranked', async () => {
    const { onOpenDialog, user } = setup({ status: 'ready' })

    expect(screen.getByText(/playing as a guest/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(onOpenDialog).toHaveBeenCalledWith('account')
  })

  it('asks signed-in players without a nickname to pick one', () => {
    setup({ status: 'ready' }, { account: { ...RANKED_PLAYER, nickname: null } })

    expect(screen.getByRole('button', { name: 'Pick a nickname' })).toBeInTheDocument()
  })

  it('confirms that the run counts for a ranked player', () => {
    setup({ status: 'ready' }, { account: RANKED_PLAYER })

    expect(screen.getByText(/ranked as/i)).toHaveTextContent('Ranked as Luna — this run counts.')
  })

  it('says when the account is still loading', () => {
    setup({ status: 'ready' }, { account: { status: 'loading', nickname: null, hasPlayedDailyToday: false } })

    expect(screen.getByText('Checking your account…')).toBeInTheDocument()
  })

  it('says when the Daily Challenge has already been played today', () => {
    setup({ status: 'ready', mode: 'daily' }, { account: { ...RANKED_PLAYER, hasPlayedDailyToday: true } })

    expect(screen.getByText(/replays are practice/i)).toBeInTheDocument()
  })

  it('marks practice modes as unranked', () => {
    setup({ status: 'ready', mode: 'zen', rankedMode: false })

    expect(screen.getByText(/practice mode — never ranked/i)).toBeInTheDocument()
  })

  it('offers a retry or an unranked game when a ranked start fails', async () => {
    const startError = new ApiError('network', 'Could not reach the server', 0)
    const { flow, user } = setup({ status: 'ready' }, { account: RANKED_PLAYER, flow: { startError } })

    expect(screen.getByText(/the server can’t be reached/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(flow.start).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'play unranked' }))
    expect(flow.startOffline).toHaveBeenCalledOnce()
  })

  it('offers to continue a saved practice run', async () => {
    const savedRun: SavedRun = { mode: 'zen', custom: null, level: 6, score: 9100, savedAt: 1 }
    const { flow, user } = setup({ status: 'ready', mode: 'zen', rankedMode: false }, { savedRun })

    expect(screen.getByRole('heading', { name: 'Continue from level 6' })).toBeInTheDocument()
    expect(screen.getByText(/9,100/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(flow.continueSaved).toHaveBeenCalledWith(savedRun)
    await user.click(screen.getByRole('button', { name: 'New game' }))
    expect(flow.start).toHaveBeenCalledOnce()
  })
})

describe('Custom setup', () => {
  it('replaces the details with the setup, applies it at once, and starts', async () => {
    const { store, flow, onAfterAction, user } = setup({ status: 'ready', mode: 'custom', rankedMode: false })

    expect(screen.getByRole('heading', { name: 'Set up your game' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Hard' }))
    expect(store.getSnapshot().settings.custom).toMatchObject({ orbCount: 5, speed: 1.3, walls: 16 })
    expect(screen.getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Unlimited lives' }))
    expect(store.getSnapshot().settings.custom.lives).toBeNull()
    expect(screen.getByRole('button', { name: 'Unlimited lives' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Lives')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Unlimited lives' }))
    expect(store.getSnapshot().settings.custom.lives).toBe(3)

    fireEvent.change(screen.getByLabelText('Orbs'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '1.8' } })
    fireEvent.change(screen.getByLabelText('Clear at'), { target: { value: '60' } })
    expect(store.getSnapshot().settings.custom).toMatchObject({ orbCount: 7, speed: 1.8, targetPercent: 60 })
    expect(screen.getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: /play custom/i }))
    expect(flow.start).toHaveBeenCalledOnce()
    expect(onAfterAction).toHaveBeenCalled()
  })

  it('restores sensible limits when "no limit" is switched off again', async () => {
    const { store, user } = setup({ status: 'ready', mode: 'custom', rankedMode: false })
    await user.click(screen.getByRole('button', { name: 'Easy' }))

    await user.click(screen.getByRole('button', { name: 'Unlimited walls' }))
    await user.click(screen.getByRole('button', { name: 'No time limit' }))
    fireEvent.change(screen.getByLabelText('Walls'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Timer'), { target: { value: '60' } })

    expect(store.getSnapshot().settings.custom).toMatchObject({ walls: 9, timeLimitSeconds: 60, lives: null })
  })

  it('offers to continue a saved Custom run, or to change the setup first', async () => {
    const savedRun: SavedRun = { mode: 'custom', custom: null, level: 4, score: 2000, savedAt: 1 }
    const { user } = setup({ status: 'ready', mode: 'custom', rankedMode: false }, { savedRun })

    expect(screen.getByRole('heading', { name: 'Continue from level 4' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change setup' }))

    expect(screen.getByRole('heading', { name: 'Set up your game' })).toBeInTheDocument()
  })
})

describe('PausedPanel', () => {
  it('moves focus to Resume when it appears', () => {
    setup({ status: 'paused', inRun: true })

    expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus()
  })

  it('lets ranked runs end early', async () => {
    const { flow, user } = setup({ status: 'paused', inRun: true, rankedMode: true })

    await user.click(screen.getByRole('button', { name: /end run/i }))

    expect(flow.endRun).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /restart level/i })).not.toBeInTheDocument()
  })

  it('lets practice runs restart the level or leave for another mode', async () => {
    const { controller, onLeaveRun, user } = setup({ status: 'paused', inRun: true, mode: 'zen', rankedMode: false })
    const restart = vi.spyOn(controller, 'restartLevel')

    await user.click(screen.getByRole('button', { name: /restart level/i }))
    expect(restart).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Change mode' }))
    expect(onLeaveRun).toHaveBeenCalledOnce()
  })
})

describe('LevelCompletePanel', () => {
  const lastResult = {
    level: 3,
    percent: 81.4,
    elapsedMs: 42_000,
    livesLeft: 2,
    wallsLeft: 4,
    areaBonus: 300,
    livesBonus: 600,
    timeBonus: 90,
    wallBonus: 600,
    totalBonus: 1590,
  }

  it('sums up the level and previews the next one', async () => {
    const { controller, user } = setup({
      status: 'levelComplete',
      inRun: true,
      score: 5400,
      orbTiers: [1, 0],
      lastResult,
      nextLevel: { level: 4, orbTiers: [1, 1], change: 'speedUp' },
    })
    const next = vi.spyOn(controller, 'nextLevel')

    expect(screen.getByRole('heading', { name: 'Level 3 cleared!' })).toBeInTheDocument()
    expect(screen.getByText('81% captured · 00:42 · 2 lives left')).toBeInTheDocument()
    expect(screen.getByText('Lives bonus')).toBeInTheDocument()
    expect(screen.queryByText('Unused walls bonus')).not.toBeInTheDocument()
    expect(screen.getByText('One orb gets faster.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next level/i })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: /next level/i }))
    expect(next).toHaveBeenCalledOnce()
  })

  it('adapts the bonuses to the mode', () => {
    setup({
      status: 'levelComplete',
      inRun: true,
      infiniteLives: true,
      wallBudget: 10,
      timeLeftMs: 20_000,
      lastResult,
      nextLevel: null,
    })

    expect(screen.getByText(/unlimited lives/)).toBeInTheDocument()
    expect(screen.queryByText('Lives bonus')).not.toBeInTheDocument()
    expect(screen.getByText('Unused walls bonus')).toBeInTheDocument()
    expect(screen.getByText('Time left bonus')).toBeInTheDocument()
  })
})

describe('ResultPanel', () => {
  it('focuses Play again and leads back to the modes', async () => {
    const { flow, onBackToReady, user } = setup(
      { status: 'gameOver', inRun: true, gameOverReason: 'lives' },
      { flow: { result: result({ status: 'local', reason: 'casual' }) } },
    )

    expect(screen.getByText('Out of lives · Classic')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '4,200' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play again/i })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: /play again/i }))
    expect(flow.start).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Change mode' }))
    expect(onBackToReady).toHaveBeenCalledOnce()
  })

  it('leads a finished Custom game back to its setup', async () => {
    const { onBackToReady, user } = setup(
      { status: 'gameOver', inRun: true, mode: 'custom', rankedMode: false },
      { flow: { result: result({ status: 'local', reason: 'casual' }, { mode: 'custom' }) } },
    )

    await user.click(screen.getByRole('button', { name: 'Change setup' }))

    expect(onBackToReady).toHaveBeenCalledOnce()
  })

  it('shows a run that was ended early', () => {
    setup({ status: 'ready' }, { flow: { result: result({ status: 'pending' }, { endedEarly: true }) } })

    expect(screen.getByText('Run ended · Classic')).toBeInTheDocument()
    expect(screen.getByText('Verifying your run…')).toBeInTheDocument()
  })

  it('lists new personal bests and badges once verified', () => {
    const verification = verified({
      records: [
        { board: 'score.classic', period: 'week', key: 'score.classic:week:2026-W39', value: 4200, rank: 3, improved: true },
        { board: 'score.classic', period: 'all', key: 'score.classic:all', value: 9000, rank: 40, improved: false },
        { board: 'stat.tightestTrap', period: 'all', key: 'stat.tightestTrap:all', value: 1.25, rank: 12, improved: true },
      ],
      newBadges: [{ id: 'squeeze', tier: 2 }],
    })
    setup({ status: 'gameOver', inRun: true }, { flow: { result: result(verification) } })

    const bests = screen.getByRole('region', { name: 'New personal bests' })
    expect(bests).toHaveTextContent('Classic · this week#3')
    expect(bests).toHaveTextContent('Tightest trap · 1.25%#12')
    expect(bests).not.toHaveTextContent('#40')
    expect(screen.getByRole('img', { name: 'Tight Squeeze, Silver' })).toBeInTheDocument()
  })

  it('says when a verified run was not a new best', () => {
    setup({ status: 'gameOver', inRun: true }, { flow: { result: result(verified()) } })

    expect(screen.getByText(/no new personal best/i)).toBeInTheDocument()
  })

  it('explains unranked Daily replays', () => {
    setup(
      { status: 'gameOver', inRun: true },
      { flow: { result: result(verified({ ranked: false }), { mode: 'daily' }) } },
    )

    expect(screen.getByText(/only your first daily challenge attempt each day is ranked/i)).toBeInTheDocument()
  })

  it('offers a retry when verification fails on the way', async () => {
    const error = new ApiError('network', 'Could not reach the server', 0)
    const { flow, user } = setup(
      { status: 'gameOver', inRun: true },
      { flow: { result: result({ status: 'failed', error }) } },
    )

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(flow.retrySubmit).toHaveBeenCalledOnce()
  })

  it('does not offer a retry for a rejected run', () => {
    const error = new ApiError('replay_mismatch', 'The replay did not match.', 422)
    setup({ status: 'gameOver', inRun: true }, { flow: { result: result({ status: 'failed', error }) } })

    expect(screen.getByText(/the replay did not match/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('lets guests save the score on this device and sign in', async () => {
    const { store, onOpenDialog, user } = setup(
      { status: 'gameOver', inRun: true },
      { flow: { result: result({ status: 'local', reason: 'guest' }) } },
    )

    await user.type(screen.getByLabelText(/your name/i), 'Ada')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText(/saved — #1 on this device/i)).toBeInTheDocument()
    expect(store.getSnapshot().highScores[0]).toMatchObject({ name: 'Ada', mode: 'classic', score: 4200 })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(onOpenDialog).toHaveBeenCalledWith('account')
  })

  it('does not save practice runs', () => {
    setup(
      { status: 'gameOver', inRun: true, mode: 'zen' },
      { flow: { result: result({ status: 'local', reason: 'casual' }, { mode: 'zen' }) } },
    )

    expect(screen.getByText('Practice mode — not ranked.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Leaderboards' })).not.toBeInTheDocument()
  })

  it('explains offline runs and runs sent while leaving the page', () => {
    setup({ status: 'ready' }, { flow: { result: result({ status: 'local', reason: 'submittedOnExit' }) } })

    expect(screen.getByText(/sent when you left the page/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leaderboards' })).toHaveAttribute(
      'href',
      '/trap-the-orb/leaderboards?board=score.classic&period=week',
    )
  })
})
