/**
 * The night both motion scenes play under: sky, moon, a town asleep on the
 * hills, and the ground. Everything reaches far past the scene's frame, so a
 * stage of any shape is filled edge to edge.
 */

const FAR = -2000
const WIDTH = 5000

/** A rolling skyline of hills along `base`, `rise` tall, one crest every `step`. */
function hills(base: number, rise: number, step: number, phase: number): string {
  let d = `M${FAR} ${base + 400}V${base}`
  for (let x = FAR, i = 0; x < FAR + WIDTH; x += step, i++) {
    const peak = base - rise * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + phase)))
    d += `Q${x + step / 2} ${Math.round(peak)} ${x + step} ${base}`
  }
  return `${d}V${base + 400}Z`
}

const STARS: readonly (readonly [number, number, number])[] = [
  [70, 70, 1.4], [150, 120, 1], [210, 52, 1.7], [290, 96, 1.1], [360, 44, 1.3], [430, 128, 1], [480, 74, 1.6], [560, 40, 1.1],
  [610, 112, 1.4], [680, 62, 1], [740, 140, 1.2], [930, 58, 1.5], [980, 120, 1], [1040, 80, 1.3], [-40, 110, 1.2], [20, 150, 1],
  [250, 160, 1.1], [520, 160, 1.2], [880, 170, 1], [1100, 150, 1.4], [-120, 60, 1.5], [1180, 50, 1.1],
]

export function Stars() {
  return (
    <g className="atp-m-stars" fill="#f6f1da">
      {STARS.map(([x, y, r], index) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={r} className="atp-m-star" style={{ animationDelay: `${-index * 0.37}s` }} />
      ))}
    </g>
  )
}

const WINDOWS: readonly (readonly [number, number])[] = [
  [128, 176], [140, 182], [176, 170], [190, 178], [212, 184], [236, 174], [250, 182], [690, 186], [712, 180], [728, 188],
]

export function Backdrop({ id, horizon }: { readonly id: string; readonly horizon: number }) {
  return (
    <g className="atp-m-backdrop" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} gradientUnits="userSpaceOnUse" x1="0" y1="-120" x2="0" y2={horizon}>
          <stop offset="0" stopColor="#050c1f" />
          <stop offset="0.62" stopColor="#0c1c3f" />
          <stop offset="1" stopColor="#1d3768" />
        </linearGradient>
        <linearGradient id={`${id}-ground`} gradientUnits="userSpaceOnUse" x1="0" y1={horizon} x2="0" y2="640">
          <stop offset="0" stopColor="#163a3c" />
          <stop offset="1" stopColor="#0a2023" />
        </linearGradient>
        <radialGradient id={`${id}-moon`}>
          <stop offset="0" stopColor="#fff3cf" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fff3cf" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-vignette`} gradientUnits="userSpaceOnUse" cx="500" cy="300" r="620">
          <stop offset="0.42" stopColor="#030817" stopOpacity="0" />
          <stop offset="1" stopColor="#030817" stopOpacity="0.78" />
        </radialGradient>
      </defs>
      <rect x={FAR} y={FAR} width={WIDTH} height={-FAR + horizon + 2} fill={`url(#${id}-sky)`} />
      <circle cx="838" cy="96" r="92" fill={`url(#${id}-moon)`} />
      <circle cx="838" cy="96" r="29" fill="#fff3cf" />
      <circle cx="828" cy="88" r="5" fill="#f0dfae" />
      <circle cx="847" cy="105" r="3.5" fill="#f0dfae" />
      <path d={hills(horizon - 4, 46, 260, 0.4)} fill="#12254d" />
      {/* The far-off town sits on the far hills, wherever the horizon is. */}
      <g transform={`translate(0 ${horizon - 208})`}>
        {WINDOWS.map(([x, y]) => (
          <rect key={`${x},${y}`} x={x} y={y} width="4" height="5" rx="1" fill="#ffd36b" opacity="0.85" />
        ))}
        <path d="M118 196V172l14-10l14 10v24zM168 196V164h18v32zM204 196V178l12-9l12 9v18zM228 196V168h28v28zM684 196V180l14-10l14 10v16zM712 196V174h22v22z" fill="#0e1f42" />
      </g>
      <path d={hills(horizon + 6, 30, 340, 2.1)} fill="#0e2140" />
      <rect x={FAR} y={horizon} width={WIDTH} height="2400" fill={`url(#${id}-ground)`} />
      <g className="atp-m-tufts" stroke="#2c5e52" strokeWidth="2" strokeLinecap="round">
        {[
          [90, 250], [210, 470], [520, 236], [880, 254], [960, 480], [640, 500], [160, 360], [770, 360], [1060, 340], [-30, 420], [400, 520],
        ].map(([x, y]) => (
          <path key={`${x},${y}`} d={`M${x} ${y}l-3 -7M${x} ${y}l1 -9M${x} ${y}l4 -6`} />
        ))}
      </g>
    </g>
  )
}

/** A rounded label in the scene, sized to its text. */
export function Pill({ x, y, text, tone }: { readonly x: number; readonly y: number; readonly text: string; readonly tone: 'stay' | 'pull' }) {
  const width = Math.round(text.length * 7.6 + 30)
  return (
    <g transform={`translate(${x} ${y})`} className={`atp-m-pill is-${tone}`}>
      <rect x={-width / 2} y="-13" width={width} height="26" rx="13" />
      <text y="4.6" textAnchor="middle">
        {text}
      </text>
    </g>
  )
}
