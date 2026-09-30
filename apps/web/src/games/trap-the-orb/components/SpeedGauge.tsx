import { useId } from 'react'

type SpeedGaugeProps = {
  /** Current orb speed relative to level 1. */
  readonly factor: number
  /** The speed cap, where the gauge is full. */
  readonly maxFactor: number
}

const CENTER_X = 16
const CENTER_Y = 19
const ARC = 'M5 19a11 11 0 0 1 22 0'

/** Half-circle speedometer: empty at level-1 speed, full at the speed cap. */
export function SpeedGauge({ factor, maxFactor }: SpeedGaugeProps) {
  const gradientId = useId()
  const progress = maxFactor > 1 ? Math.min(1, Math.max(0, (factor - 1) / (maxFactor - 1))) : 0
  const needleDegrees = Math.round(progress * 1800) / 10

  return (
    <svg viewBox="0 0 32 24" className="size-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2ec4bc" />
          <stop offset="0.6" stopColor="#f5b83d" />
          <stop offset="1" stopColor="#ed6461" />
        </linearGradient>
      </defs>
      <path d={ARC} fill="none" stroke="var(--color-line-strong)" strokeWidth="4" strokeLinecap="round" />
      <path
        d={ARC}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${Math.max(progress * 100, 0.01)} 100`}
        className="transition-[stroke-dasharray] duration-700 ease-(--ease-out-expo)"
      />
      <line
        x1={CENTER_X}
        y1={CENTER_Y}
        x2={CENTER_X - 8}
        y2={CENTER_Y}
        stroke="var(--color-ink)"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ transform: `rotate(${needleDegrees}deg)`, transformOrigin: `${CENTER_X}px ${CENTER_Y}px` }}
        className="transition-transform duration-700 ease-(--ease-out-expo)"
      />
      <circle cx={CENTER_X} cy={CENTER_Y} r="2.4" fill="var(--color-ink)" />
    </svg>
  )
}
