import type { ReactNode } from 'react'
import { ClockIcon, HeartIcon, StarIcon } from '@/components/icons'
import { formatClock, formatCompactNumber, formatNumber, formatPercent, formatSpeed } from '@/lib/format'
import type { HudSnapshot } from '../controller/GameController'
import { SPEED_TIER_INFO } from '../modes/modeContent'
import { AreaRing } from './AreaRing'
import { SpeedGauge } from './SpeedGauge'

type HudStatProps = {
  readonly icon: ReactNode
  readonly label: string
  readonly value: ReactNode
  /** Full, spoken version of the value when the visual one is abbreviated or symbolic. */
  readonly valueLabel?: string
  /** Explanation shown on hover. */
  readonly hint?: string
  readonly isAlert?: boolean
}

function HudStat({ icon, label, value, valueLabel, hint, isAlert = false }: HudStatProps) {
  return (
    <div title={hint} className="flex min-w-0 items-center justify-center gap-2.5 px-1 py-2 sm:justify-start sm:px-3">
      <span aria-hidden="true" className="hidden size-7 shrink-0 place-items-center sm:grid">
        {icon}
      </span>
      <div className="min-w-0 text-center sm:text-left">
        <dt className="truncate text-[0.6rem] font-semibold tracking-[0.08em] text-subtle uppercase sm:text-[0.64rem]">
          {label}
        </dt>
        <dd
          aria-label={valueLabel}
          className={`tabular text-[0.95rem] leading-tight font-bold tracking-[-0.01em] whitespace-nowrap sm:text-[1.05rem] ${
            isAlert ? 'text-coral-600' : 'text-ink'
          }`}
        >
          {value}
        </dd>
      </div>
    </div>
  )
}

function WallsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-teal-600" aria-hidden="true" focusable="false">
      <path d="M4 5h16M4 12h16M4 19h16M9 5v7M15 12v7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Seconds left at which the countdown turns red. */
const LOW_TIME_MS = 10_000

type HudBarProps = {
  readonly hud: HudSnapshot
}

/** One compact bar with every live statistic of the current level. */
export function HudBar({ hud }: HudBarProps) {
  const isPlaying = hud.status === 'playing'
  const speed = formatSpeed(hud.topSpeedFactor)
  const topTier = SPEED_TIER_INFO[Math.max(0, ...hud.orbTiers)]?.name ?? 'Calm'
  const hasWalls = hud.wallsLeft !== null && hud.wallBudget !== null
  const isTimed = hud.timeLeftMs !== null

  return (
    <div role="group" aria-label="Game status" className="card">
      <dl className={`grid divide-x divide-divider ${hasWalls ? 'grid-cols-6' : 'grid-cols-5'}`}>
        <HudStat
          icon={<AreaRing percent={hud.percent} targetPercent={hud.targetPercent} />}
          label="Area"
          value={formatPercent(hud.percent)}
          valueLabel={`${formatPercent(hud.percent)} of the ${hud.targetPercent}% target`}
          hint={`Captured area — clear the level at ${hud.targetPercent}%`}
        />
        <HudStat
          icon={<HeartIcon className="size-5 text-coral-500" />}
          label="Lives"
          value={hud.infiniteLives ? '∞' : hud.lives}
          valueLabel={hud.infiniteLives ? 'Unlimited' : `${hud.lives} of ${hud.maxLives}`}
          isAlert={isPlaying && !hud.infiniteLives && hud.lives === 1}
        />
        <HudStat
          icon={<SpeedGauge factor={hud.topSpeedFactor} maxFactor={hud.maxSpeedFactor} />}
          label="Speed"
          value={speed}
          valueLabel={`Fastest orb ${speed}, ${topTier.toLowerCase()}`}
          hint={`Fastest orb: ${speed} (${topTier}). Orb colour shows speed: blue calm, orange quick, red fast, violet blazing.`}
        />
        {hasWalls && (
          <HudStat
            icon={<WallsIcon />}
            label="Walls"
            value={hud.wallsLeft}
            valueLabel={`${hud.wallsLeft} of ${hud.wallBudget} walls left`}
            hint="Walls left in this level — unused walls earn bonus points"
            isAlert={isPlaying && hud.wallsLeft !== null && hud.wallsLeft <= 2}
          />
        )}
        <HudStat
          icon={<ClockIcon className={`size-5 ${isTimed ? 'text-coral-500' : 'text-subtle'}`} />}
          label={isTimed ? 'Left' : 'Time'}
          value={formatClock(hud.timeLeftMs ?? hud.elapsedMs)}
          valueLabel={isTimed ? `${formatClock(hud.timeLeftMs ?? 0)} left` : undefined}
          hint={isTimed ? 'Time left in this level' : undefined}
          isAlert={isPlaying && isTimed && (hud.timeLeftMs ?? 0) <= LOW_TIME_MS}
        />
        <HudStat
          icon={<StarIcon className="size-5 text-[#f5b83d]" />}
          label="Score"
          value={
            <>
              <span className="sm:hidden">{formatCompactNumber(hud.score)}</span>
              <span className="hidden sm:inline">{formatNumber(hud.score)}</span>
            </>
          }
          valueLabel={formatNumber(hud.score)}
        />
      </dl>
    </div>
  )
}
