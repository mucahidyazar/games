import { NearestFilter } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { disposeMarkerSprites, leverLabel, markerSprite } from './sprites'

/** Canvases that remember which colour each pixel was filled with. */
const painted = new WeakMap<HTMLCanvasElement, Map<string, string>>()

function recordPixels(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const pixels = new Map<string, string>()
    painted.set(this, pixels)
    const context = {
      fillStyle: '',
      fillRect(x: number, y: number) {
        pixels.set(`${x},${y}`, context.fillStyle)
      },
    }
    return context
  } as unknown as HTMLCanvasElement['getContext'])
}

/** The bitmap behind a sprite, one character per pixel: the first letter of each colour's key in `legend`. */
function bitmap(canvas: HTMLCanvasElement, legend: Readonly<Record<string, string>>): string[] {
  const pixels = painted.get(canvas) ?? new Map<string, string>()
  return Array.from({ length: canvas.height }, (_, y) =>
    Array.from({ length: canvas.width }, (_, x) => {
      const color = pixels.get(`${x},${y}`)
      return color ? (legend[color] ?? '?') : '.'
    }).join(''),
  )
}

const LEGEND = { '#141a2e': 'X', '#7fe3b8': 'M', '#2f9a74': 'm', '#ffd34d': 'Y', '#f6f1e7': 'W', '#e8433f': 'R' }

beforeEach(() => {
  disposeMarkerSprites()
  recordPixels()
})

afterEach(() => vi.restoreAllMocks())

describe('marker sprites', () => {
  it('draws crisp icons once and reuses them', () => {
    const heart = markerSprite('heart', 'en')
    expect([heart.width, heart.height]).toEqual([14, 12])
    expect(heart.texture.magFilter).toBe(NearestFilter)
    expect(markerSprite('heart', 'tr')).toBe(heart)
    const rows = bitmap(heart.texture.image as HTMLCanvasElement, LEGEND)
    expect(rows.join('')).toContain('R')
    expect(rows[2]?.startsWith('XW')).toBe(true)
  })

  it('writes “you” in the player’s language, with an arrow down', () => {
    const you = markerSprite('you', 'en')
    const sen = markerSprite('you', 'tr')
    expect(sen).not.toBe(you)
    const en = bitmap(you.texture.image as HTMLCanvasElement, LEGEND)
    const tr = bitmap(sen.texture.image as HTMLCanvasElement, LEGEND)
    expect(en).not.toEqual(tr)
    // Y, O, U: three letters, outlined, over a pointing arrow.
    expect(en[0]).toMatch(/^\.X+/)
    expect(en.at(-1)).toMatch(/^\.+X\.+$/)
    expect(en.at(-2)).toContain('XmX')
  })

  it('throws away the cache on dispose', () => {
    const first = markerSprite('zzz', 'en')
    const dispose = vi.spyOn(first.texture, 'dispose')
    disposeMarkerSprites()
    expect(dispose).toHaveBeenCalled()
    expect(markerSprite('zzz', 'en')).not.toBe(first)
  })
})

describe('lever labels', () => {
  it('point the way: mint to pull, amber to leave it', () => {
    const pull = bitmap(leverLabel('pull', 'en').texture.image as HTMLCanvasElement, LEGEND)
    const stay = bitmap(leverLabel('stay', 'en').texture.image as HTMLCanvasElement, LEGEND)

    expect(pull.join('')).toMatch(/M/)
    expect(pull.join('')).not.toMatch(/Y/)
    expect(stay.join('')).toMatch(/Y/)
    expect(stay.join('')).not.toMatch(/M/)
    // The arrow is the last glyph of PULL > and the first of < DO NOTHING: its tip is a single pixel.
    const middle = pull[3] as string
    expect(middle.replace(/\.+$/, '').endsWith('MMMX')).toBe(true)
    expect((stay[3] as string).replace(/^\.+/, '').startsWith('XYYY')).toBe(true)
    expect(stay[1]).toMatch(/^\.\.XYX/)
  })

  it('speaks Turkish, Ç and all', () => {
    const tr = leverLabel('pull', 'tr')
    const en = leverLabel('pull', 'en')
    expect(tr).not.toBe(en)
    // ÇEK > dips one row lower for the cedilla.
    expect(tr.height).toBe(en.height + 1)
    expect(leverLabel('stay', 'tr').width).toBeLessThan(leverLabel('stay', 'en').width)
    expect(leverLabel('pull', 'tr')).toBe(tr)
  })
})
