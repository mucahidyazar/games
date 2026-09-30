export interface BallColors {
  readonly highlight: string
  readonly base: string
  readonly shade: string
  /** "r g b" triplet used for the translucent trail. */
  readonly trail: string
}

export interface RenderPalette {
  readonly field: string
  readonly captured: string
  readonly wall: string
  readonly building: string
  readonly anchor: string
  readonly broken: string
  readonly pointsText: string
  readonly balls: readonly BallColors[]
}

/**
 * One colour per speed tier (calm, quick, fast, blazing), so a glance tells
 * how fast an orb is. Calm blue and quick orange match the reference design.
 */
export const BALL_COLORS: readonly BallColors[] = [
  { highlight: '#9dd2ff', base: '#2b8cff', shade: '#0a5fe0', trail: '43 140 255' },
  { highlight: '#ffd08a', base: '#ff8c1a', shade: '#e86400', trail: '255 140 26' },
  { highlight: '#ffb3c0', base: '#ef4f6c', shade: '#c92c4a', trail: '239 79 108' },
  { highlight: '#cbb8ff', base: '#8b5cf6', shade: '#6334d8', trail: '139 92 246' },
]

const FALLBACK: RenderPalette = {
  field: '#ffffff',
  captured: '#dcf1f0',
  wall: '#a0b6c6',
  building: '#0bb5a9',
  anchor: '#0aa39a',
  broken: '#ed6461',
  pointsText: '#077f85',
  balls: BALL_COLORS,
}

/** Reads the canvas colours from the CSS design tokens, falling back to defaults. */
export function readPalette(root: Element | null): RenderPalette {
  if (!root || typeof getComputedStyle !== 'function') return FALLBACK
  const styles = getComputedStyle(root)
  const token = (name: string, fallback: string): string => styles.getPropertyValue(name).trim() || fallback

  return {
    field: token('--color-field', FALLBACK.field),
    captured: token('--color-captured', FALLBACK.captured),
    wall: token('--color-wall', FALLBACK.wall),
    building: token('--color-building', FALLBACK.building),
    anchor: token('--color-anchor', FALLBACK.anchor),
    broken: token('--color-coral-500', FALLBACK.broken),
    pointsText: token('--color-teal-700', FALLBACK.pointsText),
    balls: BALL_COLORS,
  }
}
