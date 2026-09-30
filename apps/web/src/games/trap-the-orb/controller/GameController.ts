import {
  advanceToNextLevel,
  capturedPercent,
  createRun,
  getLevelConfig,
  isRankedMode,
  isSolid,
  orientationForAspect,
  pauseGame,
  placeWall,
  randomSeed,
  restartLevel,
  resumeGame,
  SPEED_TIERS,
  startGame,
  tick,
  TICK_SECONDS,
  TICKS_PER_SECOND,
  wallRect,
  type CustomSettings,
  type FieldOrientation,
  type GameEvent,
  type GameMode,
  type GameOverReason,
  type GameState,
  type GameStatus,
  type LevelChange,
  type LevelResult,
  type Orientation,
  type RunInput,
} from '@games/trap-the-orb-engine'
import { formatNumber } from '@/lib/format'
import { logger } from '@/lib/logger'
import { THEME_CHANGE_EVENT } from '@/app/theme'
import type { SoundPlayer } from '../audio/sfx'
import { cellFromPoint, runsCentroid, type CellPoint } from '../render/layout'
import { readPalette } from '../render/palette'
import { createCaptureParticles } from '../render/particles'
import { EFFECT_DURATION_MS, GameRenderer, type Effect } from '../render/renderer'

export type HudStatus = GameStatus | 'loading'

export interface NextLevelPreview {
  readonly level: number
  readonly orbTiers: readonly number[]
  readonly change: LevelChange
}

/** Everything the React UI needs to know about the game, as one immutable value. */
export interface HudSnapshot {
  readonly status: HudStatus
  readonly mode: GameMode
  /** The mode has fixed rules and can reach leaderboards. */
  readonly rankedMode: boolean
  /** A real run is in progress (as opposed to the ready-screen preview). */
  readonly inRun: boolean
  readonly level: number
  readonly orbCount: number
  readonly orbTiers: readonly number[]
  /** Speed of the fastest orb relative to a calm orb. */
  readonly topSpeedFactor: number
  readonly maxSpeedFactor: number
  readonly lives: number
  readonly maxLives: number
  readonly infiniteLives: boolean
  readonly score: number
  /** Captured area, floored to a whole percent. */
  readonly percent: number
  readonly targetPercent: number
  /** Level time, rounded down to whole seconds. */
  readonly elapsedMs: number
  /** Countdown left in timed modes (whole seconds), otherwise null. */
  readonly timeLeftMs: number | null
  readonly wallsLeft: number | null
  readonly wallBudget: number | null
  readonly orientation: Orientation
  readonly lastResult: LevelResult | null
  readonly nextLevel: NextLevelPreview | null
  readonly gameOverReason: GameOverReason | null
  /** Latest message for the screen-reader live region. */
  readonly announcement: string
}

export const INITIAL_HUD: HudSnapshot = {
  status: 'loading',
  mode: 'classic',
  rankedMode: true,
  inRun: false,
  level: 1,
  orbCount: 1,
  orbTiers: [0],
  topSpeedFactor: 1,
  maxSpeedFactor: SPEED_TIERS[SPEED_TIERS.length - 1] ?? 1,
  lives: 2,
  maxLives: 2,
  infiniteLives: false,
  score: 0,
  percent: 0,
  targetPercent: 75,
  elapsedMs: 0,
  timeLeftMs: null,
  wallsLeft: null,
  wallBudget: null,
  orientation: 'vertical',
  lastResult: null,
  nextLevel: null,
  gameOverReason: null,
  announcement: '',
}

/** Controller events on top of the engine's: a run or a level began. */
export type ControllerEvent =
  | GameEvent
  | { readonly type: 'runStarted'; readonly mode: GameMode; readonly level: number; readonly score: number }
  | { readonly type: 'levelStarted'; readonly level: number; readonly score: number }

export type GameEventListener = (events: readonly ControllerEvent[], state: GameState) => void

export interface RunStartOptions {
  readonly seed: number
  /** Field shape of the run; defaults to the one that fits the board right now. */
  readonly field?: FieldOrientation
  /** Continue an unranked run at a later level. */
  readonly level?: number
  readonly score?: number
}

/** What the server needs to replay the current run. */
export interface RunRecording {
  readonly mode: GameMode
  readonly custom: CustomSettings | null
  readonly field: FieldOrientation
  readonly seed: number
  readonly inputs: readonly RunInput[]
  readonly endTick: number
  readonly score: number
  readonly level: number
}

export interface GameControllerOptions {
  readonly sound: SoundPlayer
  /** Fixed seed for the ready-screen preview (tests and `?seed=` links). */
  readonly seed?: number
  readonly mode?: GameMode
  readonly custom?: CustomSettings | null
}

const MAX_DEVICE_PIXEL_RATIO = 2
/** Keyboard aiming moves the cursor by this share of the short side per key press. */
const KEYBOARD_STEP_RATIO = 0.025
/** Longest stretch of time simulated after a hitch (e.g. a background tab); the rest is dropped. */
const MAX_BACKLOG_SECONDS = 0.25

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const sameCell = (a: CellPoint | null, b: CellPoint | null): boolean =>
  a === b || (a !== null && b !== null && a.col === b.col && a.row === b.row)

function hudEquals(a: HudSnapshot, b: HudSnapshot): boolean {
  return (Object.keys(a) as Array<keyof HudSnapshot>).every((key) => a[key] === b[key])
}

const secondsFloorMs = (ticks: number): number => Math.floor(ticks / TICKS_PER_SECOND) * 1000

/**
 * Imperative shell around the pure engine: owns the fixed-tick loop, the
 * canvas renderer, input mapping and recording, sounds and short-lived
 * effects, and exposes a HUD snapshot that React reads through
 * useSyncExternalStore. It never talks to the network.
 */
export class GameController {
  private readonly sound: SoundPlayer
  private readonly previewSeed: number
  private readonly hudListeners = new Set<() => void>()
  private readonly eventListeners = new Set<GameEventListener>()
  private mode: GameMode
  private custom: CustomSettings | null
  private state: GameState | null = null
  private inRun = false
  private runSeed = 0
  private inputs: readonly RunInput[] = []
  private orientation: Orientation = 'vertical'
  private aim: CellPoint | null = null
  private effects: readonly Effect[] = []
  private hud: HudSnapshot = INITIAL_HUD
  private nextLevelCache: NextLevelPreview | null = null
  private announcement = ''
  private renderer: GameRenderer | null = null
  private canvas: HTMLCanvasElement | null = null
  private size = { width: 0, height: 0 }
  private frameId = 0
  private lastFrameTime = 0
  private backlog = 0
  private needsRender = true
  private reducedMotion = false
  private isVisible = true

  constructor({ sound, seed, mode = 'classic', custom = null }: GameControllerOptions) {
    this.sound = sound
    this.previewSeed = seed ?? randomSeed()
    this.mode = mode
    this.custom = custom
  }

  // ---------------------------------------------------------------- React glue

  readonly subscribe = (listener: () => void): (() => void) => {
    this.hudListeners.add(listener)
    return () => {
      this.hudListeners.delete(listener)
    }
  }

  readonly getHud = (): HudSnapshot => this.hud

  /** Current engine state (read-only), for tooling and debugging. */
  getState(): GameState | null {
    return this.state
  }

  getMode(): { readonly mode: GameMode; readonly custom: CustomSettings | null } {
    return { mode: this.mode, custom: this.custom }
  }

  /** The field shape that fits the board right now — what a new run would use. */
  getFieldOrientation(): FieldOrientation {
    return this.fieldOrientation()
  }

  /** A run is in progress and not over yet. */
  isRunActive(): boolean {
    return this.inRun && this.state !== null && this.state.status !== 'gameOver'
  }

  onGameEvents(listener: GameEventListener): () => void {
    this.eventListeners.add(listener)
    return () => {
      this.eventListeners.delete(listener)
    }
  }

  /** Attaches the controller to a canvas; returns the matching cleanup. */
  mount(canvas: HTMLCanvasElement): () => void {
    this.canvas = canvas
    try {
      this.renderer = new GameRenderer(canvas, readPalette(document.body))
    } catch (error: unknown) {
      // The game still runs (and the HUD still updates) — there is just nothing to draw on.
      logger.warn('Could not create the canvas renderer', error)
      this.renderer = null
    }
    // A fresh renderer has no size yet, even if the controller saw this size before a remount.
    this.size = { width: 0, height: 0 }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.reducedMotion = motionQuery.matches
    const onMotionChange = (event: MediaQueryListEvent): void => {
      this.reducedMotion = event.matches
    }
    motionQuery.addEventListener('change', onMotionChange)

    // CSS tokens are updated before the shared theme event is dispatched. Keep
    // the current engine state and run intact while repainting the canvas with
    // the newly resolved palette.
    const onThemeChange = (): void => {
      this.renderer?.setPalette(readPalette(document.body))
      this.needsRender = true
      if (this.state) this.draw(performance.now())
    }
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange)

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) this.resize(box.width, box.height, window.devicePixelRatio)
    })
    observer.observe(canvas)
    const rect = canvas.getBoundingClientRect()
    this.resize(rect.width, rect.height, window.devicePixelRatio)

    const onVisibilityChange = (): void => {
      if (document.hidden) this.pause()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    // Switching windows or clicking into another frame should not cost lives.
    const onWindowBlur = (): void => this.pause()
    window.addEventListener('blur', onWindowBlur)

    this.startLoop()

    return () => {
      cancelAnimationFrame(this.frameId)
      observer.disconnect()
      motionQuery.removeEventListener('change', onMotionChange)
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onWindowBlur)
      this.renderer = null
      this.canvas = null
    }
  }

  /** Sizes the field; shows the ready-screen preview once the canvas has a size. */
  resize(width: number, height: number, devicePixelRatio = 1): void {
    const isUsable = (value: number): boolean => Number.isFinite(value) && value >= 1
    if (!isUsable(width) || !isUsable(height)) return
    const changed = width !== this.size.width || height !== this.size.height
    this.size = { width, height }
    if (changed) this.renderer?.resize(width, height, clamp(devicePixelRatio || 1, 1, MAX_DEVICE_PIXEL_RATIO))
    if (!this.state || (!this.inRun && this.state.field !== this.fieldOrientation())) this.showPreview()
    this.needsRender = true
    this.publish()
  }

  /** Stops the frame loop (and pauses) while the board is off screen, e.g. on another page. */
  setVisible(visible: boolean): void {
    if (visible === this.isVisible) return
    this.isVisible = visible
    if (visible) {
      this.startLoop()
      return
    }
    this.pause()
    cancelAnimationFrame(this.frameId)
    this.frameId = 0
  }

  // ------------------------------------------------------------------ commands

  /** Chooses the mode for the next run. Ignored while a run is in progress. */
  setMode(mode: GameMode, custom: CustomSettings | null = null): void {
    if (this.isRunActive()) return
    const nextCustom = mode === 'custom' ? custom : null
    // Re-selecting the mode shown on the ready screen keeps its preview running.
    if (this.state && !this.inRun && mode === this.mode && nextCustom === this.custom) return
    this.mode = mode
    this.custom = nextCustom
    this.showPreview()
    this.commit()
  }

  /** Starts a run of the chosen mode. Ranked runs use the seed and field the server handed out. */
  startRun({ seed, field = this.fieldOrientation(), level = 1, score = 0 }: RunStartOptions): void {
    if (!this.state) return
    this.runSeed = seed >>> 0
    this.inputs = []
    this.inRun = true
    const fresh = createRun({
      mode: this.mode,
      seed: this.runSeed,
      field,
      custom: this.custom ?? undefined,
      level,
      score,
    })
    this.beginLevel(startGame(fresh), 'runStarted')
  }

  /**
   * Ends the run where it stands — the player gave up. The final field stays on
   * screen and the recording stays available, like after a game over.
   */
  endRun(): void {
    if (!this.state || !this.isRunActive()) return
    this.state = { ...this.state, status: 'gameOver' }
    this.backlog = 0
    this.commit()
  }

  /** Leaves the current run and returns to the ready screen. */
  abandonRun(): void {
    this.inRun = false
    this.inputs = []
    this.showPreview()
    this.commit()
  }

  togglePause(): void {
    switch (this.state?.status) {
      case 'playing':
        this.pause()
        break
      case 'paused':
        this.resume()
        break
      default:
        break
    }
  }

  pause(): void {
    if (this.state?.status !== 'playing') return
    this.state = pauseGame(this.state)
    this.commit()
  }

  resume(): void {
    if (this.state?.status !== 'paused') return
    this.sound.unlock()
    this.state = resumeGame(this.state)
    this.commit()
  }

  /** Replays the current level — only offered in the casual modes. */
  restartLevel(): void {
    const status = this.state?.status
    if (!this.state || !this.inRun || status === 'gameOver' || status === 'levelComplete') return
    this.beginLevel(restartLevel(this.state), 'levelStarted')
  }

  nextLevel(): void {
    if (this.state?.status !== 'levelComplete') return
    this.beginLevel(advanceToNextLevel(this.state), 'levelStarted')
  }

  /** The recording of the current run, for server verification. */
  getRecording(): RunRecording | null {
    const state = this.state
    if (!state || !this.inRun) return null
    return {
      mode: this.mode,
      custom: this.custom,
      field: state.field,
      seed: this.runSeed,
      inputs: this.inputs,
      endTick: state.tick,
      score: state.score,
      level: state.level,
    }
  }

  toggleOrientation(): void {
    this.setOrientation(this.orientation === 'vertical' ? 'horizontal' : 'vertical')
  }

  setOrientation(orientation: Orientation): void {
    if (orientation === this.orientation) return
    this.orientation = orientation
    this.commit()
  }

  // --------------------------------------------------------------------- input

  /** Grid cell under a point in canvas CSS pixels. */
  cellAt(x: number, y: number): CellPoint | null {
    const state = this.state
    const layout = state ? this.renderer?.layoutFor(state.grid) : null
    return state && layout ? cellFromPoint(layout, state.grid, x, y) : null
  }

  aimAtPoint(x: number, y: number): void {
    this.setAim(this.cellAt(x, y))
  }

  clearAim(): void {
    this.setAim(null)
  }

  /** Moves the keyboard aim cursor, starting from the centre of the field. */
  moveAim(dx: number, dy: number): void {
    const state = this.state
    if (!state) return
    const { cols, rows } = state.grid
    const stride = Math.max(1, Math.round(Math.min(cols, rows) * KEYBOARD_STEP_RATIO))
    const current = this.aim ?? { col: Math.floor(cols / 2), row: Math.floor(rows / 2) }
    this.setAim({
      col: clamp(current.col + Math.sign(dx) * stride, 1, cols - 2),
      row: clamp(current.row + Math.sign(dy) * stride, 1, rows - 2),
    })
  }

  buildAtPoint(x: number, y: number, orientation: Orientation = this.orientation): boolean {
    const cell = this.cellAt(x, y)
    return cell ? this.buildAt(cell, orientation) : false
  }

  buildAtAim(): boolean {
    return this.aim ? this.buildAt(this.aim, this.orientation) : false
  }

  buildAt(cell: CellPoint, orientation: Orientation = this.orientation): boolean {
    const state = this.state
    if (!state || !this.inRun) return false
    this.sound.unlock()
    const result = placeWall(state, { col: cell.col, row: cell.row, orientation })
    const started = result.events.find((event) => event.type === 'wallStarted')
    if (started) {
      // Recorded at the current tick so the server can replay the exact same move.
      this.inputs = [...this.inputs, { t: state.tick, c: started.col, r: started.row, o: orientation === 'vertical' ? 'v' : 'h' }]
    }
    this.state = result.state
    this.handleEvents(result.events, performance.now())
    this.commit()
    return started !== undefined
  }

  // ----------------------------------------------------------------- internals

  private startLoop(): void {
    if (!this.canvas || !this.isVisible) return
    cancelAnimationFrame(this.frameId)
    this.lastFrameTime = 0
    this.needsRender = true
    this.frameId = requestAnimationFrame(this.frame)
  }

  private readonly frame = (time: number): void => {
    this.frameId = requestAnimationFrame(this.frame)
    this.advance(time)
  }

  /** One animation frame: run the fixed ticks that fit, expire effects, draw, publish. */
  advance(time: number): void {
    const state = this.state
    if (!state) return

    const dt = this.lastFrameTime === 0 ? 0 : (time - this.lastFrameTime) / 1000
    this.lastFrameTime = time
    const running = state.status === 'playing' || state.status === 'ready'
    this.backlog = running ? Math.min(this.backlog + dt, MAX_BACKLOG_SECONDS) : 0

    let current = state
    const events: GameEvent[] = []
    while (this.backlog >= TICK_SECONDS) {
      const result = tick(current)
      current = result.state
      events.push(...result.events)
      this.backlog -= TICK_SECONDS
      if (current.status !== 'playing' && current.status !== 'ready') {
        this.backlog = 0
        break
      }
    }
    if (current !== state) {
      this.state = current
      this.needsRender = true
    }
    if (events.length > 0) this.handleEvents(events, time)

    if (this.effects.length > 0) {
      this.effects = this.effects.filter((effect) => time - effect.startedAt < EFFECT_DURATION_MS[effect.kind])
      this.needsRender = true
    }

    if (this.needsRender) this.draw(time)
    this.publish()
  }

  private fieldOrientation(): FieldOrientation {
    return orientationForAspect(this.size.width / this.size.height)
  }

  /** The animated field behind the ready screen: the next run's mode, but never the real run seed. */
  private showPreview(): void {
    this.inRun = false
    this.nextLevelCache = null
    this.state = createRun({
      mode: this.mode,
      seed: this.previewSeed,
      field: this.fieldOrientation(),
      custom: this.custom ?? undefined,
    })
    this.effects = []
  }

  /** Switches to a freshly started level and tells listeners about it. */
  private beginLevel(state: GameState, kind: 'runStarted' | 'levelStarted'): void {
    this.sound.unlock()
    this.state = state
    this.effects = []
    this.nextLevelCache = null
    this.backlog = 0
    this.sound.play('start')
    this.commit()
    const event: ControllerEvent =
      kind === 'runStarted'
        ? { type: 'runStarted', mode: this.mode, level: state.level, score: state.levelStartScore }
        : { type: 'levelStarted', level: state.level, score: state.levelStartScore }
    for (const listener of this.eventListeners) listener([event], state)
  }

  private draw(time: number): void {
    if (!this.renderer || !this.state) return
    this.renderer.render(this.state, {
      now: time,
      orientation: this.orientation,
      aim: this.inRun ? this.aim : null,
      effects: this.effects,
      reducedMotion: this.reducedMotion,
    })
    this.updateCursor()
    this.needsRender = false
  }

  private setAim(cell: CellPoint | null): void {
    if (sameCell(cell, this.aim)) return
    this.aim = cell
    this.needsRender = true
  }

  private commit(): void {
    this.needsRender = true
    this.publish()
  }

  private announce(message: string): void {
    this.announcement = message
  }

  private updateCursor(): void {
    const { canvas, state } = this
    if (!canvas || !state) return

    let cursor = 'default'
    if (state.status === 'playing') {
      if (state.walls.length > 0) cursor = 'progress'
      else if (this.aim && isSolid(state.grid, this.aim.col, this.aim.row)) cursor = 'not-allowed'
      else cursor = this.orientation === 'vertical' ? 'ns-resize' : 'ew-resize'
    }
    if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor
  }

  private handleEvents(events: readonly GameEvent[], time: number): void {
    const state = this.state
    if (!state) return
    const added: Effect[] = []
    // Both halves can break in the same instant; that is one mistake, so give feedback once.
    let hasReportedBreak = false

    for (const event of events) {
      switch (event.type) {
        case 'wallStarted':
          this.sound.play('build')
          break
        case 'wallRejected':
          if (event.reason === 'busy' || event.reason === 'noWalls') this.sound.play('blocked')
          if (event.reason === 'noWalls') this.announce('No walls left in this level.')
          break
        case 'wallCompleted': {
          if (event.capturedCells === 0) {
            this.sound.play('wall')
            break
          }
          added.push({ kind: 'capture', runs: event.runs, startedAt: time })
          if (!this.reducedMotion) {
            added.push({ kind: 'particles', particles: createCaptureParticles(event.runs, Math.random), startedAt: time })
          }
          const centre = runsCentroid(event.runs)
          if (centre && event.points > 0) {
            added.push({ kind: 'points', x: centre.x, y: centre.y, value: event.points, startedAt: time })
          }
          this.sound.play('capture')
          break
        }
        case 'wallBroken':
          added.push({ kind: 'broken', rect: wallRect(event.wall), startedAt: time })
          if (hasReportedBreak) break
          hasReportedBreak = true
          this.sound.play('break')
          this.announce(
            state.rules.livesPolicy === 'infinite'
              ? 'Wall broken.'
              : `Wall broken — ${event.livesLeft} ${event.livesLeft === 1 ? 'life' : 'lives'} left.`,
          )
          break
        case 'levelComplete':
          this.sound.play('level')
          this.announce(`Level ${event.result.level} cleared with ${Math.floor(event.result.percent)}% captured.`)
          break
        case 'gameOver':
          this.sound.play('gameOver')
          this.announce(`Game over. Final score ${formatNumber(event.score)}.`)
          break
      }
    }

    if (added.length > 0) this.effects = [...this.effects, ...added]
    for (const listener of this.eventListeners) listener(events, state)
  }

  private publish(): void {
    const next = this.computeHud()
    if (hudEquals(next, this.hud)) return
    this.hud = next
    for (const listener of this.hudListeners) listener()
  }

  /** Preview of the next level for the "level cleared" card, computed once per level. */
  private nextLevelFor(state: GameState): NextLevelPreview | null {
    if (state.status !== 'levelComplete') return null
    if (this.nextLevelCache?.level !== state.level + 1) {
      const config = getLevelConfig(state.level + 1, state.rules)
      this.nextLevelCache = { level: config.level, orbTiers: config.orbTiers, change: config.change }
    }
    return this.nextLevelCache
  }

  private computeHud(): HudSnapshot {
    const state = this.state
    if (!state) return { ...INITIAL_HUD, mode: this.mode, rankedMode: isRankedMode(this.mode), orientation: this.orientation }

    const { config, rules } = state
    const topTier = Math.max(...config.orbTiers)
    const customSpeed = rules.custom?.speed
    const topSpeedFactor = customSpeed ?? SPEED_TIERS[topTier] ?? 1

    return {
      status: state.status,
      mode: this.mode,
      rankedMode: rules.ranked,
      inRun: this.inRun,
      level: state.level,
      orbCount: config.orbCount,
      orbTiers: config.orbTiers,
      topSpeedFactor,
      maxSpeedFactor: Math.max(INITIAL_HUD.maxSpeedFactor, topSpeedFactor),
      lives: state.lives,
      maxLives: rules.livesPolicy === 'perRun' ? rules.runLives : config.lives,
      infiniteLives: rules.livesPolicy === 'infinite',
      score: state.score,
      percent: Math.floor(capturedPercent(state.grid)),
      targetPercent: config.targetPercent,
      elapsedMs: secondsFloorMs(state.levelTicks),
      timeLeftMs:
        config.timeLimitTicks === null
          ? null
          : Math.ceil(Math.max(0, config.timeLimitTicks - state.levelTicks) / TICKS_PER_SECOND) * 1000,
      wallsLeft: state.wallsLeft,
      wallBudget: config.wallBudget,
      orientation: this.orientation,
      lastResult: state.lastResult,
      nextLevel: this.nextLevelFor(state),
      gameOverReason: state.gameOverReason,
      announcement: this.announcement,
    }
  }
}

/** Reads a numeric `?seed=` query parameter (used for reproducible games and tests). */
export function parseSeed(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('seed')
  if (raw === null || !/^\d{1,10}$/.test(raw)) return undefined
  return Number(raw) >>> 0
}
