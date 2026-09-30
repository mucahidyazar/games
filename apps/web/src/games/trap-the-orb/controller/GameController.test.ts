import { CUSTOM_PRESETS, replayRun, type CustomSettings } from '@games/trap-the-orb-engine'
import { describe, expect, it, vi } from 'vitest'
import { THEME_CHANGE_EVENT } from '@/app/theme'
import type { SoundPlayer } from '../audio/sfx'
import { GameController, parseSeed, type ControllerEvent } from './GameController'
import { GameRenderer } from '../render/renderer'

const fakeSound = (): SoundPlayer => ({ play: vi.fn(), unlock: vi.fn(), setEnabled: vi.fn() })

/** A slow single orb with unlimited lives and a low target: easy to clear in a test. */
const EASY_CUSTOM: CustomSettings = {
  orbCount: 1,
  speed: 0.6,
  lives: null,
  walls: null,
  timeLimitSeconds: null,
  targetPercent: 50,
}

/** A controller with a 1000 x 500 board (a 300 x 150 landscape field), without a canvas. */
const setup = (seed = 42) => {
  const sound = fakeSound()
  const controller = new GameController({ sound, seed })
  controller.resize(1000, 500)
  return { controller, sound }
}

/** Runs `frames` animation frames of 1/60 s; returns the time of the next frame. */
const runFrames = (controller: GameController, frames: number, start = 1000): number => {
  let time = start
  for (let i = 0; i <= frames; i++) {
    controller.advance(time)
    time += 1000 / 60
  }
  return time
}

/** Builds a wall right on top of the first orb so it breaks immediately. */
const breakWallOnBall = (controller: GameController): void => {
  const ball = controller.getState()?.balls[0]
  if (!ball) throw new Error('expected a ball')
  controller.buildAt({ col: Math.floor(ball.x), row: Math.floor(ball.y) }, 'vertical')
}

/** Keeps walling off the side of the field away from the only orb until the level is cleared. */
const clearLevel = (controller: GameController, start = 1000): number => {
  let time = start
  for (let attempt = 0; attempt < 30 && controller.getHud().status === 'playing'; attempt++) {
    const state = controller.getState()
    const ball = state?.balls[0]
    if (!state || !ball) throw new Error('expected a running level')
    const { cols, rows } = state.grid
    const col = ball.x < cols / 2 ? Math.min(cols - 3, Math.floor(ball.x) + 40) : Math.max(2, Math.floor(ball.x) - 40)
    controller.buildAt({ col, row: Math.floor(rows / 2) }, 'vertical')
    time = runFrames(controller, 90, time)
  }
  return time
}

const collect = (controller: GameController): ControllerEvent[] => {
  const events: ControllerEvent[] = []
  controller.onGameEvents((batch) => events.push(...batch))
  return events
}

describe('GameController setup', () => {
  it('waits for a size before showing the ready screen', () => {
    const controller = new GameController({ sound: fakeSound(), seed: 1 })

    expect(controller.getHud().status).toBe('loading')
    expect(controller.getState()).toBeNull()

    controller.resize(1000, 500)

    expect(controller.getHud()).toMatchObject({
      status: 'ready',
      mode: 'classic',
      rankedMode: true,
      inRun: false,
      orbCount: 1,
      orbTiers: [0],
      topSpeedFactor: 1,
      maxSpeedFactor: 1.6,
      lives: 2,
      infiniteLives: false,
      timeLeftMs: null,
      wallsLeft: null,
    })
    expect(controller.getState()?.grid).toMatchObject({ cols: 300, rows: 150 })
  })

  it('uses a tall field on a portrait board', () => {
    const controller = new GameController({ sound: fakeSound(), seed: 1 })

    controller.resize(500, 1000)

    expect(controller.getState()?.grid).toMatchObject({ cols: 150, rows: 300 })
    expect(controller.getFieldOrientation()).toBe('portrait')
  })

  it('reshapes the preview on rotation but never a run in progress', () => {
    const { controller } = setup()

    controller.resize(500, 1000)
    expect(controller.getState()?.field).toBe('portrait')

    controller.startRun({ seed: 5 })
    controller.resize(1000, 500)
    expect(controller.getState()?.field).toBe('portrait')
  })

  it('ignores empty or invalid sizes', () => {
    const controller = new GameController({ sound: fakeSound(), seed: 1 })

    controller.resize(0, 400)
    controller.resize(Number.NaN, 400)
    controller.resize(800, Number.POSITIVE_INFINITY)

    expect(controller.getState()).toBeNull()
  })

  it('notifies subscribers only when the HUD changes', () => {
    const { controller } = setup()
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)

    controller.advance(1000)
    expect(listener).not.toHaveBeenCalled()

    controller.startRun({ seed: 1 })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    controller.pause()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('GameController runs', () => {
  it('starts a run with feedback and a runStarted event', () => {
    const { controller, sound } = setup()
    const events = collect(controller)

    controller.startRun({ seed: 9 })

    expect(controller.getHud()).toMatchObject({ status: 'playing', inRun: true, level: 1, score: 0 })
    expect(controller.isRunActive()).toBe(true)
    expect(sound.unlock).toHaveBeenCalled()
    expect(sound.play).toHaveBeenCalledWith('start')
    expect(events).toContainEqual({ type: 'runStarted', mode: 'classic', level: 1, score: 0 })
  })

  it('uses the field the server handed out, whatever the board shape', () => {
    const { controller } = setup()

    controller.startRun({ seed: 9, field: 'portrait' })

    expect(controller.getState()?.grid).toMatchObject({ cols: 150, rows: 300 })
  })

  it('can start an unranked run at a later level', () => {
    const { controller } = setup()

    controller.startRun({ seed: 9, level: 4, score: 5000 })

    expect(controller.getHud()).toMatchObject({ level: 4, score: 5000, orbTiers: [1, 1] })
  })

  it('runs 120 fixed ticks per second and drops long hitches', () => {
    const { controller } = setup()
    controller.startRun({ seed: 3 })

    runFrames(controller, 60)
    const afterOneSecond = controller.getState()?.tick ?? 0
    controller.advance(60_000)

    expect(afterOneSecond).toBeGreaterThanOrEqual(119)
    expect(afterOneSecond).toBeLessThanOrEqual(121)
    expect((controller.getState()?.tick ?? 0) - afterOneSecond).toBeLessThanOrEqual(30)
  })

  it('pauses and resumes only a level in play', () => {
    const { controller } = setup()

    controller.togglePause()
    expect(controller.getHud().status).toBe('ready')

    controller.startRun({ seed: 1 })
    controller.togglePause()
    expect(controller.getHud().status).toBe('paused')
    controller.togglePause()
    expect(controller.getHud().status).toBe('playing')
  })

  it('keeps the clock still while paused', () => {
    const { controller } = setup()
    controller.startRun({ seed: 1 })
    const time = runFrames(controller, 90)
    const before = controller.getHud().elapsedMs

    controller.pause()
    runFrames(controller, 120, time)

    expect(before).toBe(1000)
    expect(controller.getHud().elapsedMs).toBe(before)
  })

  it('flips the wall orientation and exposes it in the HUD', () => {
    const { controller } = setup()

    controller.toggleOrientation()
    expect(controller.getHud().orientation).toBe('horizontal')
    controller.setOrientation('horizontal')
    expect(controller.getHud().orientation).toBe('horizontal')
    controller.setOrientation('vertical')
    expect(controller.getHud().orientation).toBe('vertical')
  })

  it('only moves on to the next level once the level is complete', () => {
    const { controller } = setup()
    controller.startRun({ seed: 1 })

    controller.nextLevel()

    expect(controller.getHud()).toMatchObject({ level: 1, status: 'playing' })
  })

  it('ends a run on request and keeps the final field and recording', () => {
    const { controller } = setup()
    controller.startRun({ seed: 1 })
    runFrames(controller, 30)
    controller.buildAt({ col: 150, row: 75 })

    controller.endRun()
    controller.endRun()

    expect(controller.getHud()).toMatchObject({ status: 'gameOver', gameOverReason: null, inRun: true })
    expect(controller.isRunActive()).toBe(false)
    expect(controller.getRecording()?.inputs).toHaveLength(1)
  })

  it('leaves a run for the ready screen', () => {
    const { controller } = setup()
    controller.startRun({ seed: 1 })

    controller.abandonRun()

    expect(controller.getHud()).toMatchObject({ status: 'ready', inRun: false, level: 1 })
    expect(controller.isRunActive()).toBe(false)
    expect(controller.getRecording()).toBeNull()
  })
})

describe('GameController modes', () => {
  it('switches the ready screen to another mode', () => {
    const { controller } = setup()

    controller.setMode('zen')

    expect(controller.getMode()).toEqual({ mode: 'zen', custom: null })
    expect(controller.getHud()).toMatchObject({ mode: 'zen', rankedMode: false, infiniteLives: true })
  })

  it('keeps the preview when the same mode is picked again', () => {
    const { controller } = setup()
    const preview = controller.getState()

    controller.setMode('classic')

    expect(controller.getState()).toBe(preview)
  })

  it('does not switch modes in the middle of a run', () => {
    const { controller } = setup()
    controller.startRun({ seed: 1 })

    controller.setMode('zen')

    expect(controller.getHud().mode).toBe('classic')
  })

  it('shows the limits of a Custom setup', () => {
    const { controller } = setup()

    controller.setMode('custom', CUSTOM_PRESETS.hard)

    expect(controller.getHud()).toMatchObject({
      mode: 'custom',
      orbCount: 5,
      topSpeedFactor: 1.3,
      maxLives: 3,
      wallsLeft: 16,
      wallBudget: 16,
      timeLeftMs: 120_000,
      targetPercent: 80,
    })
  })

  it('ignores Custom settings for the other modes', () => {
    const { controller } = setup()

    controller.setMode('zen', CUSTOM_PRESETS.hard)

    expect(controller.getMode().custom).toBeNull()
  })

  it('counts down in Time Attack', () => {
    const { controller } = setup()
    controller.setMode('timeAttack')
    controller.startRun({ seed: 2 })

    runFrames(controller, 60)

    expect(controller.getHud().timeLeftMs).toBe(44_000)
  })

  it('spends the wall budget in Limited Walls and says when it is gone', () => {
    const { controller, sound } = setup()
    controller.setMode('limitedWalls')
    controller.startRun({ seed: 2 })
    const budget = controller.getHud().wallBudget ?? 0
    let time = 1000

    for (let wall = 0; wall < budget; wall++) {
      breakWallOnBall(controller)
      time = runFrames(controller, 6, time)
      if (controller.getHud().status !== 'playing') break
    }

    const hud = controller.getHud()
    expect(budget).toBe(6)
    expect(hud.wallsLeft === 0 || hud.status === 'gameOver').toBe(true)
    if (hud.status === 'playing') {
      expect(controller.buildAt({ col: 20, row: 20 })).toBe(false)
      expect(sound.play).toHaveBeenCalledWith('blocked')
      expect(controller.getHud().announcement).toBe('No walls left in this level.')
    }
  })
})

describe('GameController walls', () => {
  it('builds one wall at a time and plays feedback sounds', () => {
    const { controller, sound } = setup()
    controller.startRun({ seed: 42 })

    expect(controller.buildAt({ col: 150, row: 75 })).toBe(true)
    expect(controller.buildAt({ col: 40, row: 40 })).toBe(false)
    expect(sound.play).toHaveBeenCalledWith('build')
    expect(sound.play).toHaveBeenCalledWith('blocked')
  })

  it('ignores walls on the ready screen', () => {
    const { controller } = setup()

    expect(controller.buildAt({ col: 150, row: 75 })).toBe(false)
  })

  it('reports broken walls to listeners, the HUD and the live region', () => {
    const { controller } = setup()
    const events = collect(controller)
    controller.startRun({ seed: 42 })

    breakWallOnBall(controller)
    runFrames(controller, 6)

    expect(events.some((event) => event.type === 'wallBroken')).toBe(true)
    expect(controller.getHud().lives).toBe(1)
    expect(controller.getHud().announcement).toMatch(/Wall broken — 1 life left/)
  })

  it('plays one break sound when both halves break together', () => {
    const { controller, sound } = setup()
    controller.startRun({ seed: 42 })

    breakWallOnBall(controller)
    runFrames(controller, 6)

    const breakSounds = vi.mocked(sound.play).mock.calls.filter(([name]) => name === 'break')
    expect(breakSounds).toHaveLength(1)
  })

  it('never takes lives in Zen', () => {
    const { controller } = setup()
    controller.setMode('zen')
    controller.startRun({ seed: 42 })

    breakWallOnBall(controller)
    runFrames(controller, 6)

    expect(controller.getHud()).toMatchObject({ status: 'playing', infiniteLives: true })
    expect(controller.getHud().announcement).toBe('Wall broken.')
  })

  it('ends the run after the last life', () => {
    const { controller } = setup()
    controller.startRun({ seed: 42 })

    let time = 1000
    for (let attempt = 0; attempt < 2; attempt++) {
      breakWallOnBall(controller)
      time = runFrames(controller, 6, time)
    }

    expect(controller.getHud()).toMatchObject({ status: 'gameOver', gameOverReason: 'lives' })
    expect(controller.getHud().announcement).toMatch(/Game over/)
    expect(controller.isRunActive()).toBe(false)

    controller.restartLevel()
    expect(controller.getHud().status).toBe('gameOver')

    controller.startRun({ seed: 43 })
    expect(controller.getHud()).toMatchObject({ status: 'playing', level: 1, score: 0 })
  })

  it('restarts the current level while playing', () => {
    const { controller } = setup()
    const events = collect(controller)
    controller.startRun({ seed: 42 })
    breakWallOnBall(controller)
    runFrames(controller, 6)

    controller.restartLevel()

    expect(controller.getHud()).toMatchObject({ status: 'playing', lives: 2, elapsedMs: 0 })
    expect(events).toContainEqual({ type: 'levelStarted', level: 1, score: 0 })
  })

  it('aims from the centre with the keyboard and builds at the cursor', () => {
    const { controller } = setup()
    controller.startRun({ seed: 42 })

    controller.moveAim(1, 0)
    expect(controller.buildAtAim()).toBe(true)

    const wall = controller.getState()?.walls[0]
    expect(wall?.orientation).toBe('vertical')
    expect(wall?.line).toBe(150 + Math.round(150 * 0.025))
  })

  it('cannot map screen points without a mounted renderer', () => {
    const { controller } = setup()
    controller.startRun({ seed: 42 })

    expect(controller.cellAt(10, 10)).toBeNull()
    expect(controller.buildAtPoint(10, 10)).toBe(false)
    expect(controller.buildAtAim()).toBe(false)
  })
})

describe('GameController levels', () => {
  it('previews the next level once one is cleared, then starts it', () => {
    const { controller } = setup(7)
    const events = collect(controller)
    controller.setMode('custom', EASY_CUSTOM)
    controller.startRun({ seed: 7 })

    clearLevel(controller)

    expect(controller.getHud()).toMatchObject({
      status: 'levelComplete',
      nextLevel: { level: 2, orbTiers: [0], change: 'repeat' },
    })
    expect(controller.getHud().lastResult?.level).toBe(1)

    controller.nextLevel()

    expect(controller.getHud()).toMatchObject({ status: 'playing', level: 2, nextLevel: null })
    expect(events.some((event) => event.type === 'levelStarted' && event.level === 2)).toBe(true)
  })
})

describe('GameController recording', () => {
  it('has nothing to record outside a run', () => {
    const { controller } = setup()

    expect(controller.getRecording()).toBeNull()
  })

  it('records every accepted wall with the tick it was built on', () => {
    const { controller } = setup()
    controller.startRun({ seed: 11 })
    const time = runFrames(controller, 30)
    controller.buildAt({ col: 150, row: 75 }, 'horizontal')
    runFrames(controller, 30, time)

    const recording = controller.getRecording()

    expect(recording).toMatchObject({ mode: 'classic', custom: null, field: 'landscape', seed: 11, level: 1 })
    expect(recording?.inputs).toEqual([{ t: expect.any(Number), c: 150, r: 75, o: 'h' }])
    expect(recording?.inputs[0]?.t).toBeGreaterThan(50)
    expect(recording?.endTick).toBe(controller.getState()?.tick)
  })

  it('produces recordings the engine replays to the same result', () => {
    const { controller } = setup()
    controller.setMode('custom', EASY_CUSTOM)
    controller.startRun({ seed: 21 })
    let time = clearLevel(controller)
    controller.nextLevel()
    time = runFrames(controller, 45, time)
    breakWallOnBall(controller)
    runFrames(controller, 30, time)

    const recording = controller.getRecording()
    if (!recording) throw new Error('expected a recording')
    const replay = replayRun({ ...recording, custom: recording.custom ?? undefined })

    expect(replay.tick).toBe(recording.endTick)
    expect(replay.score).toBe(controller.getState()?.score)
    expect(replay.level).toBe(2)
    expect(replay.acceptedInputs).toBe(recording.inputs.length)
  })
})

describe('GameController mounting', () => {
  it('repaints the mounted renderer when the theme changes without resetting a run', () => {
    const { controller } = setup()
    const canvas = document.createElement('canvas')
    const setPalette = vi.spyOn(GameRenderer.prototype, 'setPalette')
    const unmount = controller.mount(canvas)
    controller.startRun({ seed: 1 })
    const stateBefore = controller.getState()
    const hudBefore = controller.getHud()

    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))

    expect(setPalette).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toBe(stateBefore)
    expect(controller.getHud()).toMatchObject({
      status: hudBefore.status,
      inRun: true,
      level: hudBefore.level,
      score: hudBefore.score,
    })
    unmount()
  })

  it('pauses when the window loses focus', () => {
    const { controller } = setup()
    const unmount = controller.mount(document.createElement('canvas'))
    controller.startRun({ seed: 1 })

    window.dispatchEvent(new Event('blur'))

    expect(controller.getHud().status).toBe('paused')
    unmount()
  })

  it('attaches to a canvas and cleans up after itself', () => {
    const { controller } = setup()
    const canvas = document.createElement('canvas')
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')

    const unmount = controller.mount(canvas)
    unmount()

    expect(cancel).toHaveBeenCalled()
  })

  it('stops the frame loop and pauses while hidden, and resumes drawing when shown', () => {
    const { controller } = setup()
    const request = vi.spyOn(window, 'requestAnimationFrame')
    const unmount = controller.mount(document.createElement('canvas'))
    controller.startRun({ seed: 1 })
    const requestsBefore = request.mock.calls.length

    controller.setVisible(false)
    expect(controller.getHud().status).toBe('paused')

    controller.setVisible(true)
    expect(request.mock.calls.length).toBeGreaterThan(requestsBefore)
    unmount()
  })
})

describe('parseSeed', () => {
  it('reads a numeric seed from the query string', () => {
    expect(parseSeed('?seed=42')).toBe(42)
    expect(parseSeed('?level=2&seed=7')).toBe(7)
  })

  it('ignores missing or invalid seeds', () => {
    expect(parseSeed('')).toBeUndefined()
    expect(parseSeed('?seed=abc')).toBeUndefined()
    expect(parseSeed('?seed=-4')).toBeUndefined()
  })
})
