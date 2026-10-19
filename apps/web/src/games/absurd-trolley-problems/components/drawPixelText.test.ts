import { afterEach, describe, expect, it, vi } from 'vitest'
import { drawPixelText } from './drawPixelText'

interface Put {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly dx: number
  readonly dy: number
}

const puts = new WeakMap<HTMLCanvasElement, Put>()

/**
 * A 2D context with real pixels, where every letter is a solid block: enough
 * to follow the text from the big canvas, through the vote, to the colours.
 */
function blockContext(canvas: HTMLCanvasElement) {
  let pixels = new Uint8ClampedArray(0)
  let size = 0
  const fontSize = (font: string): number => Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 10)
  const context = {
    font: '10px sans-serif',
    letterSpacing: '0px',
    textBaseline: 'alphabetic',
    fillStyle: '#000',
    measureText(text: string) {
      return { width: text.length * fontSize(context.font) * 0.6 }
    },
    fillText(text: string, x: number, y: number) {
      if (size !== canvas.width * canvas.height) {
        size = canvas.width * canvas.height
        pixels = new Uint8ClampedArray(size * 4)
      }
      const em = fontSize(context.font)
      ;[...text].forEach((letter, index) => {
        if (letter === ' ') return
        const left = Math.round(x + index * em * 0.6)
        for (let py = Math.round(y - em * 0.7); py < Math.round(y); py++) {
          for (let px = left; px < left + Math.round(em * 0.45); px++) {
            if (px >= 0 && py >= 0 && px < canvas.width && py < canvas.height) pixels[(py * canvas.width + px) * 4 + 3] = 255
          }
        }
      })
    },
    getImageData(_x: number, _y: number, width: number, height: number) {
      return { data: pixels.length === width * height * 4 ? pixels : new Uint8ClampedArray(width * height * 4), width, height }
    },
    createImageData(width: number, height: number) {
      return { data: new Uint8ClampedArray(width * height * 4), width, height }
    },
    putImageData(image: { data: Uint8ClampedArray; width: number }, dx: number, dy: number) {
      puts.set(canvas, { data: image.data, width: image.width, dx, dy })
    },
  }
  return context
}

function useBlockCanvases(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return blockContext(this)
  } as unknown as HTMLCanvasElement['getContext'])
}

/** The colour at (x, y) of what was put on the canvas, as #rrggbb, or null when clear. */
function colorAt(put: Put, x: number, y: number): string | null {
  const i = (y * put.width + x) * 4
  if (put.data[i + 3] === 0) return null
  return `#${[put.data[i], put.data[i + 1], put.data[i + 2]].map((v) => (v as number).toString(16).padStart(2, '0')).join('')}`
}

const LAYOUT = { scale: 4, maxWidth: 400 }

afterEach(() => vi.restoreAllMocks())

describe('drawPixelText', () => {
  it('fills the letters, outlines them and drops a shadow under both', () => {
    useBlockCanvases()
    const canvas = document.createElement('canvas')
    const size = drawPixelText(canvas, { text: 'AB', family: 'Test', artSize: 10, fill: '#ffffff', outline: '#102030', shadow: '#000000' }, LAYOUT)

    expect(size).toEqual({ width: canvas.width, height: canvas.height })
    const put = puts.get(canvas) as Put
    const colors = new Set<string | null>()
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) colors.add(colorAt(put, x, y))
    expect(colors).toEqual(new Set([null, '#ffffff', '#102030', '#000000']))
    // Down any column through a letter: outline, letter, outline, then the shadow.
    const column = Array.from({ length: canvas.height }, (_, y) => colorAt(put, 4, y)).filter(Boolean)
    expect(column[0]).toBe('#102030')
    expect(column.at(-2)).toBe('#102030')
    expect(column.at(-1)).toBe('#000000')
  })

  it('shades the letters top to bottom', () => {
    useBlockCanvases()
    const canvas = document.createElement('canvas')
    drawPixelText(canvas, { text: 'I', family: 'Test', artSize: 20, fill: ['#ff0000', '#0000ff'] }, LAYOUT)

    const put = puts.get(canvas) as Put
    const column = Array.from({ length: canvas.height }, (_, y) => colorAt(put, 4, y)).filter((c): c is string => c !== null)
    const channel = (color: string | undefined, at: number): number => parseInt(color?.slice(at, at + 2) ?? '0', 16)
    // Red fades out and blue comes in on the way down.
    expect(channel(column[0], 1)).toBeGreaterThan(channel(column.at(-1), 1))
    expect(channel(column[0], 5)).toBeLessThan(channel(column.at(-1), 5))
  })

  it('crops to what it drew when asked to', () => {
    useBlockCanvases()
    const loose = document.createElement('canvas')
    drawPixelText(loose, { text: 'ABC', family: 'Test', artSize: 10, fill: '#ffffff', outline: '#000000' }, LAYOUT)
    const tight = document.createElement('canvas')
    const size = drawPixelText(tight, { text: 'ABC', family: 'Test', artSize: 10, fill: '#ffffff', outline: '#000000', trim: true }, LAYOUT)

    expect(size).toEqual({ width: tight.width, height: tight.height })
    expect(tight.height).toBeLessThan(loose.height)
    expect(tight.width).toBeLessThanOrEqual(loose.width)
    const put = puts.get(tight) as Put
    expect(put.dy).toBeLessThan(0)
    // The first row and column of the cropped canvas hold ink.
    const row = Array.from({ length: tight.width }, (_, x) => colorAt(put, x - put.dx, -put.dy))
    expect(row.some(Boolean)).toBe(true)
  })

  it('wraps to the room it has, unless kept on one line', () => {
    useBlockCanvases()
    const narrow = { scale: 4, maxWidth: 40 }
    const wrapped = document.createElement('canvas')
    drawPixelText(wrapped, { text: 'one two three', family: 'Test', artSize: 10, fill: '#ffffff' }, narrow)
    const single = document.createElement('canvas')
    drawPixelText(single, { text: 'one two three', family: 'Test', artSize: 10, fill: '#ffffff', singleLine: true }, narrow)

    expect(wrapped.height).toBeGreaterThan(single.height * 2)
    expect(single.width).toBeGreaterThan(wrapped.width)
  })

  it('gives up when the canvas can’t be drawn on or read back', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(drawPixelText(document.createElement('canvas'), { text: 'A', family: 'Test', artSize: 8, fill: '#fff' }, LAYOUT)).toBeNull()
  })
})
