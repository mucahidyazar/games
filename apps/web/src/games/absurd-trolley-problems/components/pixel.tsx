import type { CSSProperties } from 'react'

/** Small pixel-art pieces of the key frame's interface. */

/** The bold rounded face behind the pixel titles and buttons. */
export const ROUNDED_FONT = "'Rubik Variable', 'Rubik', system-ui, sans-serif"
/** A true pixel face, drawn at its native size. */
export const BLOCK_FONT = "'Silkscreen', ui-monospace, monospace"

/** A four-point sparkle drawn on a 7 × 7 pixel grid. */
export function Sparkle({ className = '', tone = 'mint', style }: { readonly className?: string; readonly tone?: 'mint' | 'cream'; readonly style?: CSSProperties }) {
  const fill = tone === 'mint' ? 'var(--atp-mint)' : 'var(--atp-cream)'
  return (
    <svg viewBox="0 0 7 7" aria-hidden="true" className={`atp-sparkle ${className}`} style={style} shapeRendering="crispEdges">
      <rect x="3" y="0" width="1" height="7" fill={fill} />
      <rect x="0" y="3" width="7" height="1" fill={fill} />
      <rect x="2" y="2" width="3" height="3" fill={fill} />
      <rect x="3" y="3" width="1" height="1" fill="#ffffff" />
    </svg>
  )
}

/** A dotted twinkle: two pixels and a gap. */
export function Twinkle({ className = '' }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 5 5" aria-hidden="true" className={`atp-twinkle ${className}`} shapeRendering="crispEdges">
      <rect x="0" y="2" width="1" height="1" fill="var(--atp-mint)" />
      <rect x="4" y="2" width="1" height="1" fill="var(--atp-mint)" />
      <rect x="2" y="0" width="1" height="1" fill="var(--atp-mint)" />
      <rect x="2" y="4" width="1" height="1" fill="var(--atp-mint)" />
    </svg>
  )
}

/** A clump of grass for the frame's corners. */
export function GrassTuft({ className = '', flip = false }: { readonly className?: string; readonly flip?: boolean }) {
  return (
    <svg viewBox="0 0 12 8" aria-hidden="true" className={`atp-grass ${className}`} shapeRendering="crispEdges" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <g fill="#3f8a55">
        <rect x="1" y="3" width="1" height="5" />
        <rect x="0" y="2" width="1" height="2" />
        <rect x="4" y="1" width="1" height="7" />
        <rect x="5" y="0" width="1" height="2" />
        <rect x="8" y="4" width="1" height="4" />
        <rect x="9" y="3" width="1" height="2" />
      </g>
      <g fill="#6fbf6f">
        <rect x="2" y="5" width="1" height="3" />
        <rect x="6" y="3" width="1" height="5" />
        <rect x="10" y="5" width="1" height="3" />
      </g>
    </svg>
  )
}

/** A keyboard key cap, as on the key frame beside the two choices. */
export function KeyCap({ children, className = '' }: { readonly children: string; readonly className?: string }) {
  return (
    <kbd className={`atp-key ${className}`} aria-hidden="true">
      {children}
    </kbd>
  )
}

/** A chunky right arrow. */
export function PixelArrow({ className = '' }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 10 8" aria-hidden="true" className={`atp-arrow ${className}`} shapeRendering="crispEdges">
      <path d="M0 3h7v2H0zM5 0h2v2H5zM7 2h2v4H7zM5 6h2v2H5z" fill="currentColor" />
    </svg>
  )
}

/** A pixel ×, drawn on its own grid so it sits dead centre in its button. */
export function CloseIcon({ className = '' }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 7 7" aria-hidden="true" className={`atp-close-icon ${className}`} shapeRendering="crispEdges">
      <path d="M0 0h1v1H0zM6 0h1v1H6zM0 1h2v1H0zM5 1h2v1H5zM1 2h2v1H1zM4 2h2v1H4zM2 3h3v1H2zM1 4h2v1H1zM4 4h2v1H4zM0 5h2v1H0zM5 5h2v1H5zM0 6h1v1H0zM6 6h1v1H6z" fill="currentColor" />
    </svg>
  )
}

/** A pixel "go round again" arrow, for the reset buttons. */
export function ResetArrow({ className = '' }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={`atp-reset-arrow ${className}`} shapeRendering="crispEdges">
      <path d="M3 1h5v2H3zM1 3h2v4H1zM3 7h4v2H3zM7 5h2v2H7zM7 0h1v1H7zM8 1h1v2H8zM7 3h1v1H7z" fill="currentColor" />
    </svg>
  )
}

const SEGMENTS = 18

/** The community meter: a row of pixel segments, filled up to `value` (0–1). */
export function SegmentMeter({ value, label, className = '' }: { readonly value: number | null; readonly label: string; readonly className?: string }) {
  const filled = value === null ? 0 : Math.round(value * SEGMENTS)
  return (
    <div
      className={`atp-meter ${value === null ? 'is-empty' : ''} ${className}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(value * 100)}
    >
      {Array.from({ length: SEGMENTS }, (_, index) => (
        <span key={index} className={index < filled ? 'is-on' : undefined} style={{ transitionDelay: `${index * 28}ms` }} />
      ))}
    </div>
  )
}

/** A pixel music note, struck through when the music is off. */
export function MusicNote({ off = false, className = '' }: { readonly off?: boolean; readonly className?: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={`atp-note ${className}`} shapeRendering="crispEdges">
      <path d="M4 1h5v2H6v5H5v1H2V8H1V6h1V5h3V3H4z" fill="currentColor" opacity={off ? 0.45 : 1} />
      {off && <path d="M0 1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1H8V9H7V8H6V7H5V6H4V5H3V4H2V3H1V2H0z" fill="currentColor" />}
    </svg>
  )
}

/** A pixel skull for the kill count. */
export function Skull({ className = '' }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 9 9" aria-hidden="true" className={`atp-skull ${className}`} shapeRendering="crispEdges">
      <path d="M2 0h5v1h1v1h1v4H8v1H7v2H2V7H1V6H0V2h1V1h1z" fill="#0a1226" />
      <path d="M2 1h5v1h1v4H7v1H6v1H3V7H2V6H1V2h1z" fill="#f4f1e6" />
      <path d="M2 3h2v2H2zM5 3h2v2H5z" fill="#0a1226" />
      <path d="M4 5h1v1H4zM3 7h1v1H3zM5 7h1v1H5z" fill="#0a1226" />
    </svg>
  )
}
