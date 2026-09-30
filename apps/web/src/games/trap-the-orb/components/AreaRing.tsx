import { useId } from 'react'

type AreaRingProps = {
  readonly percent: number
  readonly targetPercent: number
}

const RADIUS = 11
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Progress ring for captured area, with a tick marking the level target. */
export function AreaRing({ percent, targetPercent }: AreaRingProps) {
  const gradientId = useId()
  const progress = Math.min(100, Math.max(0, percent)) / 100
  const tickRotation = (targetPercent / 100) * 360
  const isTargetReached = percent >= targetPercent

  return (
    <svg viewBox="0 0 28 28" className="size-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2ec4bc" />
          <stop offset="1" stopColor="#0aa39a" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r={RADIUS} fill="none" stroke="var(--color-teal-150)" strokeWidth="4" />
      <circle
        cx="14"
        cy="14"
        r={RADIUS}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        transform="rotate(-90 14 14)"
        className="transition-[stroke-dashoffset] duration-500 ease-(--ease-out-expo)"
      />
      <line
        x1="14"
        y1="0.6"
        x2="14"
        y2="5.4"
        stroke={isTargetReached ? 'var(--color-accent)' : 'var(--color-subtle)'}
        strokeWidth="1.6"
        strokeLinecap="round"
        transform={`rotate(${tickRotation} 14 14)`}
      />
    </svg>
  )
}
