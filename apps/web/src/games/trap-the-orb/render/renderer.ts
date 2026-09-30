import { formatNumber } from '@/lib/format'
import {
  CELL_FREE,
  CELL_WALL,
  previewExtent,
  wallTip,
  type Ball,
  type CellRun,
  type GameState,
  type Grid,
  type GridDims,
  type Orientation,
  type Rect,
  type WallHalf,
} from '@games/trap-the-orb-engine'
import { computeLayout, type CanvasSize, type CellPoint, type FieldLayout } from './layout'
import type { BallColors, RenderPalette } from './palette'
import { particleAt, PARTICLE_LIFETIME_MS, type Particle } from './particles'

export type Effect =
  | { readonly kind: 'capture'; readonly runs: readonly CellRun[]; readonly startedAt: number }
  | { readonly kind: 'broken'; readonly rect: Rect; readonly startedAt: number }
  | {
      readonly kind: 'points'
      readonly x: number
      readonly y: number
      readonly value: number
      readonly startedAt: number
    }
  | { readonly kind: 'particles'; readonly particles: readonly Particle[]; readonly startedAt: number }

export const EFFECT_DURATION_MS: Readonly<Record<Effect['kind'], number>> = {
  capture: 700,
  broken: 560,
  points: 1100,
  particles: PARTICLE_LIFETIME_MS,
}

export interface RenderView {
  readonly now: number
  readonly orientation: Orientation
  /** Cell the player is aiming at (mouse hover or keyboard cursor). */
  readonly aim: CellPoint | null
  readonly effects: readonly Effect[]
  readonly reducedMotion: boolean
}

/** Dash and gap length of walls under construction, in cells (≈ 12px / 7px on desktop). */
const WALL_DASH: readonly [number, number] = [3.2, 2]
const DASH_SPEED_CELLS = 7
const TRAIL_MS = 280
const TRAIL_MAX_SAMPLES = 18
const POINTS_RISE_PX = 28
/** A broken wall briefly jolts the field — just enough to feel the mistake. */
const SHAKE_MS = 260
const SHAKE_PX = 3.5
const PARTICLE_COLORS = ['#0bb5a9', '#7fd9d0', '#f5b83d'] as const

interface Offset {
  readonly x: number
  readonly y: number
}

const NO_OFFSET: Offset = { x: 0, y: 0 }

/** Decaying jitter after the most recent broken wall; none when motion is reduced. */
function shakeOffset(view: RenderView): Offset {
  if (view.reducedMotion) return NO_OFFSET
  let latest = -Infinity
  for (const effect of view.effects) {
    if (effect.kind === 'broken') latest = Math.max(latest, effect.startedAt)
  }
  const elapsed = view.now - latest
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= SHAKE_MS) return NO_OFFSET
  const amplitude = SHAKE_PX * (1 - elapsed / SHAKE_MS) ** 2
  return { x: Math.sin(elapsed * 0.09) * amplitude, y: Math.cos(elapsed * 0.13) * amplitude }
}

interface TrailSample {
  readonly x: number
  readonly y: number
  readonly t: number
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is not supported in this browser')
  return context
}

/**
 * Draws a game state onto a canvas. Walls and captured territory are cached in
 * an off-screen layer that is only redrawn when the grid changes.
 */
export class GameRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private palette: RenderPalette
  private readonly staticCanvas: HTMLCanvasElement
  private readonly staticCtx: CanvasRenderingContext2D
  private readonly sprites = new Map<string, HTMLCanvasElement>()
  private size: CanvasSize = { cssWidth: 0, cssHeight: 0, dpr: 1 }
  private layout: FieldLayout | null = null
  private layoutKey = ''
  private staticKey = ''
  private trails = new Map<number, readonly TrailSample[]>()

  constructor(canvas: HTMLCanvasElement, palette: RenderPalette) {
    this.canvas = canvas
    this.ctx = getContext(canvas)
    this.palette = palette
    this.staticCanvas = document.createElement('canvas')
    this.staticCtx = getContext(this.staticCanvas)
  }

  /**
   * Updates the canvas colour tokens without touching any game state.  The
   * static layer and orb sprites contain baked-in colours, so both caches must
   * be invalidated before the next render.
   */
  setPalette(palette: RenderPalette): void {
    if (palette === this.palette) return
    this.palette = palette
    this.staticKey = ''
    this.sprites.clear()
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.size = { cssWidth, cssHeight, dpr }
    const width = Math.max(1, Math.round(cssWidth * dpr))
    const height = Math.max(1, Math.round(cssHeight * dpr))
    this.canvas.width = width
    this.canvas.height = height
    this.staticCanvas.width = width
    this.staticCanvas.height = height
    this.layoutKey = ''
    this.staticKey = ''
  }

  /** Current mapping between the grid and the canvas, for input handling. */
  layoutFor(dims: GridDims): FieldLayout | null {
    if (this.size.cssWidth <= 0 || this.size.cssHeight <= 0) return null
    const key = `${this.size.cssWidth}x${this.size.cssHeight}@${this.size.dpr}|${dims.cols}x${dims.rows}`
    if (key !== this.layoutKey || !this.layout) {
      this.layout = computeLayout(this.size, dims)
      this.layoutKey = key
      this.sprites.clear()
    }
    return this.layout
  }

  render(state: GameState, view: RenderView): void {
    const layout = this.layoutFor(state.grid)
    if (!layout) return

    const { ctx } = this
    const { dpr } = layout
    const shake = shakeOffset(view)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.drawStaticLayer(state.grid, layout)
    ctx.setTransform(1, 0, 0, 1, shake.x * dpr, shake.y * dpr)
    ctx.drawImage(this.staticCanvas, 0, 0)

    // From here on, draw in grid-cell units.
    const unit = layout.scale * dpr
    ctx.setTransform(unit, 0, 0, unit, (layout.offsetX + shake.x) * dpr, (layout.offsetY + shake.y) * dpr)
    this.drawCaptureFlashes(view)
    this.drawBrokenWalls(view)
    if (state.status === 'playing' && state.walls.length === 0) this.drawAim(state.grid, view, layout)
    this.drawBuildingWalls(state.walls, view, layout)
    this.updateTrails(state.balls, view.now)
    this.drawTrails(state.balls)
    this.drawParticles(view)

    ctx.setTransform(1, 0, 0, 1, shake.x * dpr, shake.y * dpr)
    this.drawBalls(state.balls, layout)
    this.drawPoints(view, layout)
  }

  private drawParticles(view: RenderView): void {
    const { ctx } = this
    for (const effect of view.effects) {
      if (effect.kind !== 'particles') continue
      const elapsed = view.now - effect.startedAt
      if (elapsed < 0 || elapsed >= PARTICLE_LIFETIME_MS) continue
      for (const particle of effect.particles) {
        const frame = particleAt(particle, elapsed)
        if (frame.alpha <= 0) continue
        ctx.globalAlpha = frame.alpha
        ctx.fillStyle = PARTICLE_COLORS[particle.tone]
        ctx.fillRect(frame.x - particle.size / 2, frame.y - particle.size / 2, particle.size, particle.size)
      }
    }
    ctx.globalAlpha = 1
  }

  private drawStaticLayer(grid: Grid, layout: FieldLayout): void {
    const key = `${grid.version}|${this.layoutKey}`
    if (key === this.staticKey) return
    this.staticKey = key

    const c = this.staticCtx
    const px = (x: number): number => Math.round((layout.offsetX + x * layout.scale) * layout.dpr)
    const py = (y: number): number => Math.round((layout.offsetY + y * layout.scale) * layout.dpr)

    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height)
    c.fillStyle = this.palette.field
    c.fillRect(px(0), py(0), px(grid.cols) - px(0), py(grid.rows) - py(0))

    // Paint horizontal runs of equal cells instead of one rect per cell.
    for (let row = 0; row < grid.rows; row++) {
      const top = py(row)
      const height = py(row + 1) - top
      let runStart = 0
      let runState = grid.cells[row * grid.cols] ?? CELL_FREE

      for (let col = 1; col <= grid.cols; col++) {
        const state = col < grid.cols ? (grid.cells[row * grid.cols + col] ?? CELL_FREE) : -1
        if (state === runState) continue
        if (runState !== CELL_FREE) {
          c.fillStyle = runState === CELL_WALL ? this.palette.wall : this.palette.captured
          c.fillRect(px(runStart), top, px(col) - px(runStart), height)
        }
        runStart = col
        runState = state
      }
    }
  }

  private drawCaptureFlashes(view: RenderView): void {
    const { ctx } = this
    ctx.fillStyle = this.palette.building
    for (const effect of view.effects) {
      if (effect.kind !== 'capture') continue
      const t = (view.now - effect.startedAt) / EFFECT_DURATION_MS.capture
      if (t < 0 || t >= 1) continue
      ctx.globalAlpha = 0.45 * (1 - t) ** 2
      for (const run of effect.runs) ctx.fillRect(run.start, run.row, run.end - run.start, 1)
    }
    ctx.globalAlpha = 1
  }

  private drawBrokenWalls(view: RenderView): void {
    const { ctx } = this
    ctx.fillStyle = this.palette.broken
    for (const effect of view.effects) {
      if (effect.kind !== 'broken') continue
      const t = (view.now - effect.startedAt) / EFFECT_DURATION_MS.broken
      if (t < 0 || t >= 1) continue
      const grow = view.reducedMotion ? 0 : easeOutCubic(t) * 1.4
      const { left, top, right, bottom } = effect.rect
      ctx.globalAlpha = 0.9 * (1 - t)
      ctx.fillRect(left - grow, top - grow, right - left + grow * 2, bottom - top + grow * 2)
    }
    ctx.globalAlpha = 1
  }

  private drawAim(grid: Grid, view: RenderView, layout: FieldLayout): void {
    const { aim } = view
    if (!aim) return
    const extent = previewExtent(grid, aim.col, aim.row, view.orientation)
    if (!extent) return

    const vertical = view.orientation === 'vertical'
    const centre = (vertical ? aim.col : aim.row) + 0.5
    const origin = (vertical ? aim.row : aim.col) + 1
    const { ctx } = this

    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.strokeStyle = this.palette.building
    ctx.lineWidth = 1
    ctx.setLineDash(WALL_DASH)
    for (const end of [extent.start, extent.end]) {
      ctx.beginPath()
      if (vertical) {
        ctx.moveTo(centre, origin)
        ctx.lineTo(centre, end)
      } else {
        ctx.moveTo(origin, centre)
        ctx.lineTo(end, centre)
      }
      ctx.stroke()
    }
    ctx.restore()
    this.drawAnchor(view.orientation, vertical ? aim.col : aim.row, origin, layout, 0.5)
  }

  private drawBuildingWalls(walls: readonly WallHalf[], view: RenderView, layout: FieldLayout): void {
    const first = walls[0]
    if (!first) return
    const { ctx } = this
    const period = WALL_DASH[0] + WALL_DASH[1]

    ctx.save()
    ctx.strokeStyle = this.palette.building
    ctx.lineWidth = 1
    ctx.setLineDash(WALL_DASH)
    ctx.lineDashOffset = view.reducedMotion ? 0 : -(((view.now / 1000) * DASH_SPEED_CELLS) % period)
    for (const wall of walls) {
      const centre = wall.line + 0.5
      const tip = wallTip(wall)
      ctx.beginPath()
      if (wall.orientation === 'vertical') {
        ctx.moveTo(centre, wall.origin)
        ctx.lineTo(centre, tip)
      } else {
        ctx.moveTo(wall.origin, centre)
        ctx.lineTo(tip, centre)
      }
      ctx.stroke()
    }
    ctx.restore()
    this.drawAnchor(first.orientation, first.line, first.origin, layout, 1)
  }

  /** The rounded square marking where a wall starts. */
  private drawAnchor(orientation: Orientation, line: number, origin: number, layout: FieldLayout, alpha: number): void {
    const { ctx } = this
    const size = clamp(3.9 * layout.scale, 10, 15) / layout.scale
    const cx = orientation === 'vertical' ? line + 0.5 : origin
    const cy = orientation === 'vertical' ? origin : line + 0.5

    ctx.globalAlpha = alpha
    ctx.fillStyle = this.palette.anchor
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22)
    else ctx.rect(cx - size / 2, cy - size / 2, size, size)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  private updateTrails(balls: readonly Ball[], now: number): void {
    const next = new Map<number, readonly TrailSample[]>()
    for (const ball of balls) {
      const previous = this.trails.get(ball.id) ?? []
      const last = previous.at(-1)
      const moved = !last || Math.abs(last.x - ball.x) + Math.abs(last.y - ball.y) > 0.05
      const samples = moved ? [...previous, { x: ball.x, y: ball.y, t: now }] : previous
      next.set(
        ball.id,
        samples.filter((sample) => now - sample.t <= TRAIL_MS).slice(-TRAIL_MAX_SAMPLES),
      )
    }
    this.trails = next
  }

  /** Soft comet tails that follow each ball's recent path (two passes for a feathered edge). */
  private drawTrails(balls: readonly Ball[]): void {
    for (const ball of balls) {
      const samples = this.trails.get(ball.id)
      if (!samples || samples.length < 3) continue
      const colors = this.colorsFor(ball)
      this.fillTrail(samples, ball.radius * 2.3, 0.1, colors)
      this.fillTrail(samples, ball.radius * 1.35, 0.2, colors)
    }
  }

  private fillTrail(samples: readonly TrailSample[], maxWidth: number, maxAlpha: number, colors: BallColors): void {
    const { ctx } = this
    const count = samples.length
    const left: Array<readonly [number, number]> = []
    const right: Array<readonly [number, number]> = []

    for (let i = 0; i < count; i++) {
      const prev = samples[Math.max(0, i - 1)]
      const next = samples[Math.min(count - 1, i + 1)]
      const current = samples[i]
      if (!prev || !next || !current) continue
      const dx = next.x - prev.x
      const dy = next.y - prev.y
      const length = Math.hypot(dx, dy) || 1
      const half = (maxWidth / 2) * (0.25 + 0.75 * (i / (count - 1)))
      const nx = (-dy / length) * half
      const ny = (dx / length) * half
      left.push([current.x + nx, current.y + ny])
      right.push([current.x - nx, current.y - ny])
    }

    const oldest = samples[0]
    const newest = samples[count - 1]
    if (!oldest || !newest || left.length < 2) return

    const gradient = ctx.createLinearGradient(oldest.x, oldest.y, newest.x, newest.y)
    gradient.addColorStop(0, `rgb(${colors.trail} / 0)`)
    gradient.addColorStop(1, `rgb(${colors.trail} / ${maxAlpha})`)

    ctx.beginPath()
    left.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    for (let i = right.length - 1; i >= 0; i--) {
      const point = right[i]
      if (point) ctx.lineTo(point[0], point[1])
    }
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()
  }

  private drawBalls(balls: readonly Ball[], layout: FieldLayout): void {
    const { ctx } = this
    for (const ball of balls) {
      const radiusPx = ball.radius * layout.scale * layout.dpr
      const sprite = this.ballSprite(this.colorsFor(ball), radiusPx)
      const x = (layout.offsetX + ball.x * layout.scale) * layout.dpr
      const y = (layout.offsetY + ball.y * layout.scale) * layout.dpr
      ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2)
    }
  }

  private colorsFor(ball: Ball): BallColors {
    const { balls } = this.palette
    const colors = balls[Math.min(ball.tier, balls.length - 1)] ?? balls[0]
    if (!colors) throw new Error('Render palette has no ball colours')
    return colors
  }

  /** Pre-rendered glossy sphere with a soft drop shadow, cached per colour and size. */
  private ballSprite(colors: BallColors, radius: number): HTMLCanvasElement {
    const key = `${colors.base}|${radius.toFixed(2)}`
    const cached = this.sprites.get(key)
    if (cached) return cached

    const pad = Math.ceil(radius * 1.1)
    const size = Math.ceil(radius * 2 + pad * 2)
    const sprite = document.createElement('canvas')
    sprite.width = size
    sprite.height = size
    const c = getContext(sprite)
    const cx = size / 2
    const cy = size / 2

    c.save()
    c.shadowColor = `rgb(${colors.trail} / 0.38)`
    c.shadowBlur = radius * 0.9
    c.shadowOffsetY = radius * 0.3
    const body = c.createRadialGradient(cx - radius * 0.38, cy - radius * 0.42, radius * 0.06, cx, cy, radius)
    body.addColorStop(0, colors.highlight)
    body.addColorStop(0.42, colors.base)
    body.addColorStop(1, colors.shade)
    c.fillStyle = body
    c.beginPath()
    c.arc(cx, cy, radius, 0, Math.PI * 2)
    c.fill()
    c.restore()

    c.fillStyle = 'rgb(255 255 255 / 0.78)'
    c.beginPath()
    c.ellipse(cx - radius * 0.32, cy - radius * 0.4, radius * 0.3, radius * 0.2, -0.55, 0, Math.PI * 2)
    c.fill()

    this.sprites.set(key, sprite)
    return sprite
  }

  private drawPoints(view: RenderView, layout: FieldLayout): void {
    const { ctx } = this
    const { dpr } = layout
    ctx.font = `800 ${Math.round(17 * dpr)}px "Plus Jakarta Sans Variable", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 4 * dpr

    for (const effect of view.effects) {
      if (effect.kind !== 'points') continue
      const t = (view.now - effect.startedAt) / EFFECT_DURATION_MS.points
      if (t < 0 || t >= 1) continue
      const rise = view.reducedMotion ? 0 : easeOutCubic(t) * POINTS_RISE_PX
      const x = (layout.offsetX + effect.x * layout.scale) * dpr
      const y = (layout.offsetY + effect.y * layout.scale - rise) * dpr
      const text = `+${formatNumber(effect.value)}`

      ctx.globalAlpha = t < 0.12 ? t / 0.12 : 1 - clamp((t - 0.55) / 0.45, 0, 1)
      ctx.strokeStyle = 'rgb(255 255 255 / 0.92)'
      ctx.strokeText(text, x, y)
      ctx.fillStyle = this.palette.pointsText
      ctx.fillText(text, x, y)
    }
    ctx.globalAlpha = 1
  }
}
