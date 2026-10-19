/**
 * Draws text the way the key frame's titles and buttons are: a bold face
 * rendered a few pixels tall, without anti-aliasing, ready to be blown up
 * into crisp squares. Kept apart from the component so it can be tested.
 */

export interface PixelTextStyle {
  readonly text: string
  readonly family: string
  readonly weight?: number
  /** Font size in art pixels. */
  readonly artSize: number
  /** One colour, or several stops from top to bottom. */
  readonly fill: string | readonly string[]
  readonly outline?: string
  /** Colour of a one-pixel shadow under each glyph and its outline. */
  readonly shadow?: string
  /** Crop the canvas to what was drawn, so the CSS alone sets the spacing (the logo). */
  readonly trim?: boolean
  readonly align?: 'left' | 'center'
  readonly letterSpacing?: number
  /** Never wrap (button labels). */
  readonly singleLine?: boolean
}

export interface Layout {
  readonly scale: number
  readonly maxWidth: number
}

const ALPHA_THRESHOLD = 110
const OVERSAMPLE = 4

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else line = candidate
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

/** Draws the text; null when the canvas can't be read back (some privacy modes block it). */
export function drawPixelText(canvas: HTMLCanvasElement, props: PixelTextStyle, layout: Layout): { readonly width: number; readonly height: number } | null {
  const { text, family, weight = 700, artSize, fill, outline, shadow, trim = false, align = 'center', letterSpacing = 0, singleLine = false } = props
  const measure = canvas.getContext('2d')
  if (!measure) return null
  const font = `${weight} ${artSize}px ${family}`
  measure.font = font
  measure.letterSpacing = `${letterSpacing}px`
  const pad = (outline ? 1 : 0) + 1
  const lines = singleLine ? [text] : wrap(measure, text, Math.max(artSize * 2, layout.maxWidth - pad * 2))
  const lineHeight = Math.round(artSize * 1.12)
  const widths = lines.map((line) => Math.ceil(measure.measureText(line).width))
  const width = Math.max(1, ...widths) + pad * 2
  const height = lines.length * lineHeight + pad * 2 + (shadow ? 1 : 0)
  canvas.width = width
  canvas.height = height

  // Draw four times larger, then let each 4 × 4 block vote: clean pixel glyphs
  // without the ragged edges that thresholding anti-aliased text leaves.
  const k = OVERSAMPLE
  const work = document.createElement('canvas')
  work.width = width * k
  work.height = height * k
  const big = work.getContext('2d', { willReadFrequently: true })
  const context = canvas.getContext('2d')
  if (!big || !context) return null
  big.font = `${weight} ${artSize * k}px ${family}`
  big.letterSpacing = `${letterSpacing * k}px`
  big.textBaseline = 'alphabetic'
  big.fillStyle = '#fff'
  lines.forEach((line, index) => {
    const lineWidth = widths[index] ?? 0
    const x = align === 'center' ? Math.round((width - lineWidth) / 2) : pad
    const y = pad + index * lineHeight + Math.round(artSize * 0.86)
    big.fillText(line, x * k, y * k)
  })
  const source = big.getImageData(0, 0, work.width, work.height)?.data
  if (!source) return null
  const mask = new Uint8Array(width * height)
  const votes = (k * k) / 2
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = 0
      for (let dy = 0; dy < k; dy++) {
        const row = (y * k + dy) * work.width
        for (let dx = 0; dx < k; dx++) if ((source[(row + x * k + dx) * 4 + 3] as number) > ALPHA_THRESHOLD) on++
      }
      mask[y * width + x] = on >= votes ? 1 : 0
    }
  }

  const stops = (Array.isArray(fill) ? fill : [fill]).map((hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const)
  const parse = (hex: string | undefined): readonly [number, number, number] | null =>
    hex ? [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] : null
  const outlineRgb = parse(outline)
  const shadowRgb = parse(shadow)
  const out = context.createImageData(width, height)
  if (!out) return null
  const data = out.data
  const put = (x: number, y: number, rgb: readonly [number, number, number]): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const i = (y * width + x) * 4
    data[i] = rgb[0]
    data[i + 1] = rgb[1]
    data[i + 2] = rgb[2]
    data[i + 3] = 255
  }
  const at = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1

  if (outlineRgb) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (at(x, y)) continue
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) put(x, y, outlineRgb)
      }
    }
  }
  // Fill, with a vertical gradient per line of text.
  for (let y = 0; y < height; y++) {
    const lineY = (y - pad) % lineHeight
    const t = Math.min(1, Math.max(0, lineY / (artSize * 0.9)))
    const position = t * (stops.length - 1)
    const a = stops[Math.floor(position)] ?? stops[0]
    const b = stops[Math.min(stops.length - 1, Math.floor(position) + 1)] ?? a
    const f = position - Math.floor(position)
    const rgb = a && b ? ([Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)] as const) : ([255, 255, 255] as const)
    for (let x = 0; x < width; x++) if (at(x, y)) put(x, y, rgb)
  }
  if (shadowRgb) {
    // Under everything drawn so far, glyphs and outline alike.
    const inked = Uint8Array.from({ length: width * height }, (_, i) => ((data[i * 4 + 3] as number) > 0 ? 1 : 0))
    for (let y = 1; y < height; y++) for (let x = 0; x < width; x++) if (inked[(y - 1) * width + x] === 1 && inked[y * width + x] === 0) put(x, y, shadowRgb)
  }
  if (trim) {
    let [minX, minY, maxX, maxY] = [width, height, -1, -1]
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((data[(y * width + x) * 4 + 3] as number) === 0) continue
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
    if (maxX >= minX) {
      canvas.width = maxX - minX + 1
      canvas.height = maxY - minY + 1
      context.putImageData(out, -minX, -minY)
      return { width: canvas.width, height: canvas.height }
    }
  }
  context.putImageData(out, 0, 0)
  return { width, height }
}
