import { createRun, placeWall, startGame, tick, type GameState } from '@games/trap-the-orb-engine'
import { describe, expect, it } from 'vitest'
import { BALL_COLORS, readPalette } from './palette'
import { GameRenderer, type RenderView } from './renderer'

/** A canvas whose 2D context records the name of every method called on it. */
function recordingCanvas() {
  const calls: string[] = []
  const state: Record<PropertyKey, unknown> = {}
  const context = new Proxy(state, {
    get(target, property) {
      if (property in target) return target[property]
      return (..._args: unknown[]) => {
        calls.push(String(property))
        if (property === 'createLinearGradient' || property === 'createRadialGradient') {
          return { addColorStop: () => undefined }
        }
        return undefined
      }
    },
    set(target, property, value) {
      target[property] = value
      return true
    },
  })
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'getContext', { value: () => context })
  return { canvas, calls }
}

const baseView: RenderView = { now: 1000, orientation: 'vertical', aim: null, effects: [], reducedMotion: false }

/** A Classic level 1 in play: a 300 x 150 field. */
const playing = (): GameState => startGame(createRun({ mode: 'classic', seed: 3 }))

/** Advances the game by a number of fixed ticks. */
const advance = (state: GameState, ticks: number): GameState => {
  let current = state
  for (let i = 0; i < ticks; i++) current = tick(current).state
  return current
}

describe('GameRenderer', () => {
  it('draws nothing until it knows its size', () => {
    const { canvas, calls } = recordingCanvas()
    const renderer = new GameRenderer(canvas, readPalette(null))

    renderer.render(playing(), baseView)

    expect(renderer.layoutFor({ cols: 300, rows: 150 })).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('sizes the backing store for the device pixel ratio', () => {
    const { canvas } = recordingCanvas()
    const renderer = new GameRenderer(canvas, readPalette(null))

    renderer.resize(600, 300, 2)

    expect(canvas.width).toBe(1200)
    expect(canvas.height).toBe(600)
    expect(renderer.layoutFor({ cols: 300, rows: 150 })).toMatchObject({ scale: 2, offsetX: 0, offsetY: 0 })
  })

  it('draws the field, the balls and the aim preview', () => {
    const { canvas, calls } = recordingCanvas()
    const renderer = new GameRenderer(canvas, readPalette(null))
    renderer.resize(600, 300, 1)

    renderer.render(playing(), { ...baseView, aim: { col: 100, row: 50 } })

    expect(calls).toContain('clearRect')
    // The cached static layer plus one sprite per orb (level 1 has a single orb).
    expect(calls.filter((call) => call === 'drawImage')).toHaveLength(2)
    expect(calls).toContain('setLineDash')
  })

  it('draws walls under construction with their anchor', () => {
    const { canvas, calls } = recordingCanvas()
    const renderer = new GameRenderer(canvas, readPalette(null))
    renderer.resize(600, 300, 1)
    const building = advance(placeWall(playing(), { col: 150, row: 75, orientation: 'horizontal' }).state, 2)

    renderer.render(building, { ...baseView, orientation: 'horizontal' })

    expect(building.walls).toHaveLength(2)
    expect(calls).toContain('setLineDash')
    expect(calls).toContain('stroke')
    expect(calls).toContain('fill')
  })

  it('invalidates colour-dependent caches when the palette changes', () => {
    const { canvas, calls } = recordingCanvas()
    const renderer = new GameRenderer(canvas, readPalette(null))
    renderer.resize(600, 300, 1)
    const state = playing()

    renderer.render(state, baseView)
    const internals = renderer as unknown as {
      staticKey: string
      sprites: Map<string, HTMLCanvasElement>
      palette: ReturnType<typeof readPalette>
    }
    expect(internals.staticKey).not.toBe('')
    expect(internals.sprites.size).toBeGreaterThan(0)

    const nextPalette = { ...readPalette(null), field: '#0b1630' }
    renderer.setPalette(nextPalette)
    renderer.render(state, baseView)

    expect(internals.palette).toBe(nextPalette)
    expect(internals.staticKey).not.toBe('')
    expect(internals.sprites.size).toBeGreaterThan(0)
    expect(calls).toContain('clearRect')
  })

  it('animates capture flashes, broken walls, floating points and trails', () => {
    const { canvas, calls } = recordingCanvas()
    const renderer = new GameRenderer(canvas, readPalette(null))
    renderer.resize(600, 300, 1)
    let state = playing()
    const effects: RenderView['effects'] = [
      { kind: 'capture', runs: [{ row: 5, start: 2, end: 9 }], startedAt: 900 },
      { kind: 'broken', rect: { left: 4, top: 1, right: 5, bottom: 12 }, startedAt: 900 },
      { kind: 'points', x: 10, y: 10, value: 1250, startedAt: 900 },
    ]

    for (let frame = 0; frame < 5; frame++) {
      state = advance(state, 4)
      renderer.render(state, { ...baseView, now: 1000 + frame * 33, effects, reducedMotion: frame % 2 === 0 })
    }

    expect(calls).toContain('fillText')
    expect(calls).toContain('strokeText')
    expect(calls).toContain('createLinearGradient')
  })
})

describe('readPalette', () => {
  it('falls back to the built-in colours without a document root', () => {
    const palette = readPalette(null)

    expect(palette.wall).toBe('#a0b6c6')
    expect(palette.balls).toBe(BALL_COLORS)
  })

  it('prefers design tokens defined on the root element', () => {
    const root = document.createElement('div')
    root.style.setProperty('--color-wall', '#123456')

    expect(readPalette(root).wall).toBe('#123456')
    expect(readPalette(root).captured).toBe('#dcf1f0')
  })
})

describe('orb colours', () => {
  it('has one colour per speed tier, from calm blue to blazing violet', () => {
    expect(BALL_COLORS.map((colors) => colors.base)).toEqual(['#2b8cff', '#ff8c1a', '#ef4f6c', '#8b5cf6'])
  })
})
