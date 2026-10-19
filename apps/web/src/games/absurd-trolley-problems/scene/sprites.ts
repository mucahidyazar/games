import { CanvasTexture, NearestFilter, SRGBColorSpace, type Texture } from 'three'
import type { Lang, Marker, TrolleyChoice } from '../content/types'

/**
 * Pixel-art icons that float above the actors, and the words beside the
 * lever, drawn from tiny bitmaps so they stay crisp in the low-resolution
 * render. One character per pixel.
 */

const COLORS: Readonly<Record<string, string>> = {
  X: '#141a2e', // outline
  W: '#f6f1e7', // bubble
  w: '#c9c3b8', // bubble shade
  R: '#e8433f', // heart
  r: '#a92c33',
  P: '#ff7aa8', // love
  p: '#c84a7a',
  Y: '#ffd34d', // surprise lines, star
  y: '#c99a1c',
  M: '#7fe3b8', // mint (you)
  m: '#2f9a74',
  B: '#4fb8ff', // read receipts
  G: '#3fbf6a', // money
  g: '#23804a',
  N: '#cfd8ff', // notes, zzz
  n: '#7f8cc4',
  S: '#e9eef5', // steam
  s: '#9aa6b8',
  K: '#1d2236', // text on bubble
}

const BUBBLE = [
  '..XXXXXXXXXX..',
  '.XWWWWWWWWWWX.',
  'XWWWWWWWWWWWWX',
  'XWWWWWWWWWWWWX',
  'XWWWWWWWWWWWWX',
  'XWWWWWWWWWWWWX',
  'XWWWWWWWWWWWWX',
  'XWWWWWWWWWWWWX',
  '.XwwwwwwwwwwX.',
  '..XXXXwwXXXX..',
  '.....XwX......',
  '......X.......',
]

/** Draws `glyph` into the bubble's 10 × 6 interior. */
function inBubble(glyph: readonly string[]): string[] {
  const rows = [...BUBBLE]
  glyph.forEach((line, y) => {
    const row = rows[y + 2] as string
    rows[y + 2] = row.slice(0, 2) + line.padEnd(10, '.').replace(/\./g, (_, i: number) => row[2 + i] ?? '.') + row.slice(12)
  })
  return rows
}

const HEART = ['.RR..RR...', 'RRRRRRRR..', 'RRRRRRRR..', '.RRRRRR...', '..RRRR....', '...RR.....'].map((line) => `.${line.slice(0, 9)}`)
const QUESTION = ['...KKKK...', '..KK..KK..', '.....KK...', '....KK....', '..........', '....KK....']
const SEEN = ['..........', '.......B..', 'B....BB.B.', '.B..BB.BB.', '..BBB.BB..', '...B..B...']
const DOLLAR = ['....G.....', '...GGGG...', '..GG.G....', '...GGGG...', '....G.GG..', '..GGGGG...']

const ICONS: Readonly<Record<Exclude<Marker, 'you'>, readonly string[]>> = {
  heart: inBubble(HEART),
  question: inBubble(QUESTION),
  seen: inBubble(SEEN),
  dollar: inBubble(DOLLAR),
  exclaim: [
    'Y.....Y.....Y',
    '.Y....Y....Y.',
    '.Y....Y....Y.',
    '..Y...Y...Y..',
    '..............',
    '......Y......',
  ],
  love: [
    '.XXX...XXX.',
    'XPPPX.XPPPX',
    'XPWPPXPPPPX',
    'XPPPPPPPPpX',
    '.XPPPPPPpX.',
    '..XPPPPpX..',
    '...XPPpX...',
    '....XpX....',
    '.....X.....',
  ],
  music: [
    '....XXXXX',
    '....XNNNX',
    '....XNXNX',
    '....XNXNX',
    '..XXXNXXX',
    '.XNNNX...',
    'XNNNNX...',
    '.XNNX....',
    '..XX.....',
  ],
  zzz: [
    '.......XXXXX',
    '.......XNNNX',
    '.........XNX',
    '...XXXX.XNX.',
    '...XNNX.XNNX',
    '....XNX.XXXX',
    'XXXXNX......',
    'XNNXXX......',
    '.XNX........',
    'XNNNX.......',
    'XXXXX.......',
  ],
  steam: [
    '.S...S...S..',
    'S...S...S...',
    '.S...S...S..',
    '..S...S...S.',
    '.S...S...S..',
    'S...S...S...',
  ],
}

/** Little capitals, 5 pixels tall (Ç dips one lower), for the words in the scene. */
const FONT: Readonly<Record<string, readonly string[]>> = {
  A: ['.M.', 'M.M', 'MMM', 'M.M', 'M.M'],
  Ç: ['MMM', 'M..', 'M..', 'M..', 'MMM', '.M.'],
  D: ['MM.', 'M.M', 'M.M', 'M.M', 'MM.'],
  E: ['MMM', 'M..', 'MM.', 'M..', 'MMM'],
  G: ['MMM', 'M..', 'M.M', 'M.M', 'MMM'],
  H: ['M.M', 'M.M', 'MMM', 'M.M', 'M.M'],
  I: ['MMM', '.M.', '.M.', '.M.', 'MMM'],
  K: ['M.M', 'M.M', 'MM.', 'M.M', 'M.M'],
  L: ['M..', 'M..', 'M..', 'M..', 'MMM'],
  M: ['M...M', 'MM.MM', 'M.M.M', 'M...M', 'M...M'],
  N: ['M..M', 'MM.M', 'M.MM', 'M..M', 'M..M'],
  O: ['MMM', 'M.M', 'M.M', 'M.M', 'MMM'],
  P: ['MM.', 'M.M', 'MM.', 'M..', 'M..'],
  S: ['MMM', 'M..', 'MMM', '..M', 'MMM'],
  T: ['MMM', '.M.', '.M.', '.M.', '.M.'],
  U: ['M.M', 'M.M', 'M.M', 'M.M', 'MMM'],
  Y: ['M.M', 'M.M', '.M.', '.M.', '.M.'],
  '<': ['..M', '.MM', 'MMM', '.MM', '..M'],
  '>': ['M..', 'MM.', 'MMM', 'MM.', 'M..'],
  ' ': ['.'],
}

/** A word in the little capitals, coloured `fill`, with a dark outline all round. */
function wordRows(word: string, fill: string): string[] {
  const glyphs = [...word].map((letter) => FONT[letter] ?? (FONT[' '] as readonly string[]))
  const widths = glyphs.map((glyph) => glyph[0]?.length ?? 1)
  const width = widths.reduce((sum, w) => sum + w, 0) + glyphs.length + 1
  const height = Math.max(...glyphs.map((glyph) => glyph.length)) + 2
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => '.'))
  let left = 1
  glyphs.forEach((glyph, index) => {
    glyph.forEach((line, y) => [...line].forEach((c, x) => c === 'M' && ((grid[1 + y] as string[])[left + x] = 'M')))
    left += (widths[index] as number) + 1
  })
  grid.forEach((row, y) =>
    row.forEach((c, x) => {
      const touches = [grid[y - 1]?.[x], grid[y + 1]?.[x], row[x - 1], row[x + 1]].includes('M')
      if (c === '.' && touches) row[x] = 'X'
    }),
  )
  return grid.map((row) => row.join('').replace(/M/g, fill))
}

function youIcon(lang: Lang): string[] {
  const word = wordRows(lang === 'tr' ? 'SEN' : 'YOU', 'M')
  const width = word[0]?.length ?? 0
  // An arrow pointing down at the player.
  const arrow = ['XXXXXXX', 'XMMMMMX', '.XMMMX.', '..XmX..', '...X...']
  const left = Math.max(0, Math.floor((width - 7) / 2))
  return [...word, ...arrow.map((line) => ('.'.repeat(left) + line).padEnd(width, '.'))]
}

/** Which way the lever goes for each choice, written beside it. */
const LEVER_WORDS: Readonly<Record<TrolleyChoice, Readonly<Record<Lang, string>>>> = {
  pull: { en: 'PULL >', tr: 'ÇEK >' },
  stay: { en: '< DO NOTHING', tr: '< DOKUNMA' },
}

function paint(rows: readonly string[]): HTMLCanvasElement {
  const width = Math.max(...rows.map((row) => row.length))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = rows.length
  const context = canvas.getContext('2d')
  if (!context) return canvas
  rows.forEach((row, y) => {
    ;[...row].forEach((c, x) => {
      const color = COLORS[c]
      if (!color) return
      context.fillStyle = color
      context.fillRect(x, y, 1, 1)
    })
  })
  return canvas
}

export interface MarkerSprite {
  readonly texture: Texture
  /** Size in pixels, so the sprite can keep the icon's aspect ratio. */
  readonly width: number
  readonly height: number
}

const cache = new Map<string, MarkerSprite>()

function sprite(key: string, rows: () => readonly string[]): MarkerSprite {
  const cached = cache.get(key)
  if (cached) return cached
  const canvas = paint(rows())
  const texture = new CanvasTexture(canvas)
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = SRGBColorSpace
  const made = { texture, width: canvas.width, height: canvas.height }
  cache.set(key, made)
  return made
}

export function markerSprite(marker: Marker, lang: Lang): MarkerSprite {
  return marker === 'you' ? sprite(`you:${lang}`, () => youIcon(lang)) : sprite(marker, () => ICONS[marker])
}

/** The words either side of the lever: mint for the way that pulls it, amber for leaving it. */
export function leverLabel(choice: TrolleyChoice, lang: Lang): MarkerSprite {
  return sprite(`lever:${choice}:${lang}`, () => wordRows(LEVER_WORDS[choice][lang], choice === 'pull' ? 'M' : 'Y'))
}

export function disposeMarkerSprites(): void {
  for (const sprite of cache.values()) sprite.texture.dispose()
  cache.clear()
}
