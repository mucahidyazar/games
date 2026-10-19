import type { CSSProperties } from 'react'
import type { Marker, PersonActor } from '../content/types'
import { FIGURE } from './geometry'

/**
 * The cast of the motion scenes, drawn in smooth vector shapes. People are
 * drawn from the same actor data as the 3D scene, so both looks tell the
 * same story. Every figure stands with its feet on (0, 0); the scenes move
 * the groups marked with data-part, and leave the rest to CSS.
 */

const HAIR_CAP = 'M-12.6 -64A12.6 12.6 0 0 1 12.6 -64Q7 -71 0 -70.4Q-7 -71 -12.6 -64Z'

function Hair({ style, color }: { readonly style: PersonActor['hair']; readonly color: string }) {
  switch (style) {
    case 'bald':
      return <ellipse cx="-4" cy="-73" rx="3.2" ry="1.6" fill="#ffffff" opacity="0.35" />
    case 'spiky':
      return <path d="M-12.6 -63L-11 -75L-6.5 -71L-3 -81L1 -72.5L5.5 -80L8 -71.5L12.6 -63Q0 -70 -12.6 -63Z" fill={color} />
    case 'bun':
      return (
        <g fill={color}>
          <circle cx="0" cy="-80" r="5.4" />
          <path d={HAIR_CAP} />
        </g>
      )
    case 'messy':
      return (
        <g fill={color}>
          <path d={HAIR_CAP} />
          <path d="M-9 -74q-2 -6 3 -6q0 4 -3 6zM2 -77q1 -6 6 -4q-2 4 -6 4z" />
        </g>
      )
    default:
      return <path d={HAIR_CAP} fill={color} />
  }
}

/** A floating sign over someone: why they matter right now. */
export function MarkerBadge({ marker, youLabel, className = '' }: { readonly marker: Marker; readonly youLabel: string; readonly className?: string }) {
  if (marker === 'you') {
    const width = youLabel.length * 8 + 14
    return (
      <g className={`atp-m-badge is-you ${className}`}>
        <rect x={-width / 2} y="-12" width={width} height="18" rx="6" fill="#7fe3b8" />
        <path d="M-5 6h10l-5 6z" fill="#7fe3b8" />
        <text y="1.5" textAnchor="middle" className="atp-m-badge-text" fill="#0d2a1e">
          {youLabel}
        </text>
      </g>
    )
  }
  const glyph = marker === 'question' ? '?' : '!'
  const fill = marker === 'question' ? '#8fc4ff' : '#ffd36b'
  return (
    <g className={`atp-m-badge ${className}`}>
      <rect x="-10" y="-13" width="20" height="21" rx="7" fill={fill} />
      <path d="M-4 7.5h8l-4 5z" fill={fill} />
      <text y="3" textAnchor="middle" className="atp-m-badge-text" fill="#13254a">
        {glyph}
      </text>
    </g>
  )
}

type FigureProps = {
  readonly actor: PersonActor
  readonly youLabel: string
  /** Staggers the idle loops, so a crowd never breathes in step. */
  readonly delay?: number
  /** A judge's robe instead of a shirt and trousers. */
  readonly robe?: boolean
}

/**
 * A person, front on. The parts the scenes animate: data-part="body" (knocked
 * over, jumping for joy), the two arms (raised), "marker" and "alert" (the
 * signs over their head) and "soul" (what rises when they are lost).
 */
export function Figure({ actor, youLabel, delay = 0, robe = false }: FigureProps) {
  const { skin, hair, hairColor, top, bottom, shoes, accessories, hatColor, marker } = actor
  const has = (accessory: PersonActor['accessories'][number]): boolean => accessories.includes(accessory)
  const style = { '--delay': `${-delay}s` } as CSSProperties
  const arm = (side: -1 | 1) => (
    <g data-part={side < 0 ? 'arm-left' : 'arm-right'} transform={`translate(${side * FIGURE.shoulderX} ${FIGURE.shoulderY}) rotate(${-side * FIGURE.armRest})`}>
      <rect x="-3.6" y="-2" width="7.2" height="23" rx="3.6" fill={robe ? '#23263a' : top} />
      <circle cx="0" cy="22" r="3.7" fill={skin} />
    </g>
  )

  return (
    <g className="atp-m-figure" style={style}>
      <ellipse className="atp-m-shadow" cx="0" cy="0" rx="15" ry="4" />
      <g data-part="body">
        <g className="atp-m-idle">
          {hair === 'long' && <rect x="-13.5" y="-74" width="27" height="30" rx="10" fill={hairColor} />}
          {robe ? (
            <>
              <path d="M-15 -50Q-17 -20 -18 -2H18Q17 -20 15 -50Z" fill="#23263a" />
              <rect x="-11" y="-5" width="9" height="5" rx="2.5" fill={shoes} />
              <rect x="2" y="-5" width="9" height="5" rx="2.5" fill={shoes} />
            </>
          ) : (
            <>
              <rect x="-9" y="-28" width="8" height="25" rx="3" fill={bottom} />
              <rect x="1" y="-28" width="8" height="25" rx="3" fill={bottom} />
              <rect x="-10.5" y="-5" width="10" height="5" rx="2.5" fill={shoes} />
              <rect x="0.5" y="-5" width="10" height="5" rx="2.5" fill={shoes} />
            </>
          )}
          {arm(-1)}
          {arm(1)}
          {robe ? (
            <>
              <rect x="-13.5" y="-53" width="27" height="20" rx="9" fill="#23263a" />
              <path d="M-6 -53h12l-6 9z" fill="#f4f1e6" />
            </>
          ) : (
            <>
              <rect x="-13" y="-53" width="26" height="29" rx="9" fill={top} />
              {hatColor && has('cap') && <rect x="-13" y="-38" width="26" height="3.5" fill="#f4f1e6" opacity="0.8" />}
              {has('tie') && <path d="M-2.4 -52h4.8l-0.8 3 2 14-3.6 4-3.6-4 2-14z" fill="#b8323a" />}
            </>
          )}
          <rect x="-3.6" y="-57" width="7.2" height="6" fill={skin} />
          <circle cx="0" cy={FIGURE.headY} r="12" fill={skin} />
          <Hair style={hair} color={hairColor} />
          <g className="atp-m-eyes" fill="#1d1a1f">
            <ellipse cx="-4.3" cy="-65" rx="1.7" ry="1.9" />
            <ellipse cx="4.3" cy="-65" rx="1.7" ry="1.9" />
          </g>
          {has('glasses') && <path d="M-9 -65a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0M1.8 -65a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0M-1.8 -65h3.6" fill="none" stroke="#1d1a1f" strokeWidth="1.2" />}
          {has('mustache') && <path d="M-5 -59.5q5 -3 10 0q-5 1.5 -10 0z" fill={hairColor} />}
          {has('beard') && <path d="M-11 -64q0 14 11 14q11 0 11 -14q-3 6 -11 6q-8 0 -11 -6z" fill={hairColor} />}
          {has('cap') && (
            <g>
              <path d="M-12.8 -66.5A12.8 12.8 0 0 1 12.8 -66.5Z" fill={hatColor ?? '#e0475a'} />
              <rect x="-15.5" y="-68.5" width="31" height="4" rx="2" fill={hatColor ?? '#e0475a'} />
              <path d="M0 -79v10" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
            </g>
          )}
        </g>
      </g>
      <g data-part="marker" transform="translate(0 -96)" opacity={marker ? 1 : 0}>
        {marker && <MarkerBadge marker={marker} youLabel={youLabel} />}
      </g>
      <g data-part="alert" transform="translate(0 -96)" opacity="0">
        <MarkerBadge marker="exclaim" youLabel={youLabel} />
      </g>
      <g data-part="soul" opacity="0" aria-hidden="true">
        <ellipse cx="0" cy="-30" rx="7" ry="2.2" fill="none" stroke="#fff3c4" strokeWidth="1.6" />
        <circle cx="0" cy="-18" r="6" fill="#eef4ff" opacity="0.7" />
        <path d="M-7 -11q7 -5 14 0v12q-3.5 -3 -7 0q-3.5 -3 -7 0z" fill="#eef4ff" opacity="0.55" />
      </g>
    </g>
  )
}

/** One of the angry crowd at the courthouse: a dark shape against the torchlight. */
export function MobMember({ variant, delay }: { readonly variant: number; readonly delay: number }) {
  const style = { '--delay': `${-delay}s` } as CSSProperties
  const holds = variant % 3
  return (
    <g className="atp-m-mob" style={style}>
      <ellipse cx="0" cy="0" rx="15" ry="4" className="atp-m-shadow" />
      <g className="atp-m-mob-body">
        <path d="M-10 -2V-28h20V-2z" fill="#121729" />
        <rect x="-14" y="-56" width="28" height="31" rx="10" fill="#161c31" />
        <circle cx="0" cy="-67" r="11.5" fill="#161c31" />
        <path d="M-11.5 -67a11.5 11.5 0 0 1 23 0" fill="none" stroke="#ff9a4d" strokeOpacity="0.35" strokeWidth="2" />
        <rect x="-17.5" y="-52" width="7" height="22" rx="3.5" fill="#161c31" />
        <g className="atp-m-mob-arm">
          <rect x="10.5" y="-80" width="7" height="30" rx="3.5" fill="#161c31" />
          {holds === 0 && (
            <g>
              <rect x="12.5" y="-112" width="3" height="36" rx="1.5" fill="#6b4a2b" />
              <path className="atp-m-flame" d="M14 -134c7 7 8 13 3 19c-2 2-4 2-6 0c-5-6-3-12 3-19z" fill="#ffb347" />
              <path className="atp-m-flame is-core" d="M14 -125c3 4 3 7 1 9h-2c-2-2-2-5 1-9z" fill="#fff1b0" />
            </g>
          )}
          {holds === 1 && (
            <g fill="#8a94a6">
              <rect x="12.5" y="-118" width="3" height="42" rx="1.5" fill="#6b4a2b" />
              <path d="M7 -118v-10h2v8h4v-10h2v10h4v-8h2v10z" />
            </g>
          )}
          {holds === 2 && <circle cx="14" cy="-82" r="5" fill="#161c31" />}
        </g>
      </g>
    </g>
  )
}

/**
 * The tram, side on and heading right, its wheels on (0, 0). Its headlight
 * throws a beam down the track; data-part="tremble" shakes while it waits,
 * "speed" is the streaks behind it, "sign" the warning over its roof.
 */
export function Tram({ id, youLabel, warning, sign = { x: -38, y: -126 } }: { readonly id: string; readonly youLabel: string; readonly warning: string; readonly sign?: { readonly x: number; readonly y: number } }) {
  const warnWidth = warning.length * 7.6 + 34
  return (
    <g className="atp-m-tram">
      <defs>
        <linearGradient id={`${id}-beam`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff6cf" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff6cf" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-body`}>
          <rect x="-93" y="-82" width="186" height="66" rx="17" />
        </clipPath>
      </defs>
      <polygon data-part="beam" points="92,-30 430,-96 430,40" fill={`url(#${id}-beam)`} />
      <g data-part="speed" opacity="0" stroke="#c8d1df" strokeLinecap="round" strokeWidth="3">
        <path d="M-120 -66h-70M-112 -44h-110M-124 -22h-60" />
      </g>
      <g data-part="tremble">
        <ellipse cx="0" cy="2" rx="96" ry="7" className="atp-m-shadow" />
        <path d="M-22 -86L0 -104L22 -86" fill="none" stroke="#2a3550" strokeWidth="3" />
        <rect x="-28" y="-107" width="56" height="5" rx="2.5" fill="#2a3550" />
        <rect x="-82" y="-90" width="164" height="12" rx="6" fill="#e9dcc0" />
        <g clipPath={`url(#${id}-body)`}>
          <rect x="-93" y="-82" width="186" height="66" fill="#ffd36b" />
          <rect x="-93" y="-36" width="186" height="20" fill="#d9473f" />
          <rect x="-93" y="-38" width="186" height="3" fill="#fff1c9" opacity="0.7" />
          <rect x="-93" y="-82" width="186" height="8" fill="#ffffff" opacity="0.18" />
        </g>
        {[-76, -44, -12, 20].map((x) => (
          <g key={x}>
            <rect x={x} y="-72" width="27" height="25" rx="6" fill="#1b2d55" />
            <path d={`M${x + 4} -68l9 0l-9 13z`} fill="#ffffff" opacity="0.14" />
          </g>
        ))}
        <path d="M54 -72h20q14 0 16 15v10h-36z" fill="#1b2d55" />
        <g>
          <circle cx="69" cy="-58" r="6.5" fill="#f0c39c" />
          <path d="M59.5 -47q9.5 -9 19 0v1h-19z" fill="#7fe3b8" />
          <path d="M62.5 -62a6.5 6.5 0 0 1 13 0q-6.5 -3 -13 0z" fill="#1d1a1f" />
        </g>
        <circle cx="89" cy="-27" r="5" fill="#fff8e8" />
        <circle cx="89" cy="-27" r="9" fill="#fff8e8" opacity="0.25" />
        {[
          [-62, -34],
          [34, 62],
        ].map(([a, b]) => (
          <g key={a}>
            <rect x={(a as number) - 12} y="-19" width={(b as number) - (a as number) + 24} height="8" rx="4" fill="#2a3550" />
            {[a, b].map((x) => (
              <g key={x}>
                <circle cx={x} cy="-8" r="8.5" fill="#20263a" />
                <circle cx={x} cy="-8" r="3" fill="#8a94a6" />
              </g>
            ))}
          </g>
        ))}
        <g data-part="sparks" className="atp-m-sparks" stroke="#ffd36b" strokeWidth="2" strokeLinecap="round">
          <path d="M-30 -2l-12 -6M-34 0l-14 2M62 -2l12 -7M60 0l15 1" />
        </g>
      </g>
      <g data-part="you" transform="translate(70 -120)">
        <MarkerBadge marker="you" youLabel={youLabel} />
      </g>
      <g data-part="sign" transform={`translate(${sign.x} ${sign.y})`} opacity="0">
        <g className="atp-m-blink">
          <rect x={-warnWidth / 2} y="-13" width={warnWidth} height="24" rx="8" fill="#d9473f" />
          <path d={`M${-warnWidth / 2 + 9} 5l7 -12l7 12z`} fill="#ffd36b" />
          <text x={-warnWidth / 2 + 16} y="4" textAnchor="middle" className="atp-m-badge-text" fill="#d9473f">
            !
          </text>
          <text x={11} y="3.5" textAnchor="middle" className="atp-m-sign-text" fill="#fff8e8">
            {warning}
          </text>
        </g>
      </g>
    </g>
  )
}
