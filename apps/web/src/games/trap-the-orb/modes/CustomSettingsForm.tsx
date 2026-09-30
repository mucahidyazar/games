import {
  CUSTOM_LIMITS,
  CUSTOM_PRESETS,
  tierForSpeed,
  type CustomPreset,
  type CustomSettings,
} from '@games/trap-the-orb-engine'
import { useId, type CSSProperties, type ReactNode } from 'react'
import { OrbLineup } from '../components/OrbLineup'
import { matchingPreset, PRESET_LABELS, SPEED_TIER_INFO } from './modeContent'

type CustomSettingsFormProps = {
  readonly value: CustomSettings
  readonly onChange: (value: CustomSettings) => void
}

/** More orbs than this are shown as a number only; the dots would crowd the label. */
const MAX_DOTS = 6

/** Defaults used when an "unlimited" setting is switched back to a limit. */
const LIMIT_DEFAULTS = { lives: 3, walls: 16, timeLimitSeconds: 120 } as const

type LimitKey = keyof typeof LIMIT_DEFAULTS

type SettingProps = {
  readonly label: string
  readonly inputId: string
  readonly value: ReactNode
  /** Adds an "∞" switch; `label` is its full name for screen readers, e.g. "Unlimited lives". */
  readonly limit?: { readonly label: string; readonly isOn: boolean; readonly onToggle: () => void }
  readonly children: ReactNode
}

function Setting({ label, inputId, value, limit, children }: SettingProps) {
  return (
    <div className="min-w-0 text-left">
      <div className="flex min-h-6 items-center gap-1.5">
        <label htmlFor={inputId} className="text-[0.78rem] font-semibold text-ink">
          {label}
        </label>
        <span className="tabular min-w-0 truncate text-[0.78rem] font-bold text-teal-700">{value}</span>
        {limit && (
          <button
            type="button"
            aria-pressed={limit.isOn}
            aria-label={limit.label}
            title="No limit"
            onClick={limit.onToggle}
            className={`ml-auto grid h-6 w-8 shrink-0 place-items-center rounded-full border text-[0.9rem] leading-none font-bold transition ${
              limit.isOn
                ? 'border-teal-600 bg-teal-600 text-white'
                : 'border-line-strong bg-surface text-subtle hover:border-teal-300 hover:text-teal-700'
            }`}
          >
            ∞
          </button>
        )}
      </div>
      <div className="mt-1.5 flex h-4 items-center">{children}</div>
    </div>
  )
}

type SliderProps = {
  readonly id: string
  readonly min: number
  readonly max: number
  readonly step?: number
  readonly value: number
  readonly disabled?: boolean
  readonly onChange: (value: number) => void
}

function Slider({ id, min, max, step = 1, value, disabled = false, onChange }: SliderProps) {
  const fill = `${((value - min) / (max - min)) * 100}%`
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      style={{ '--fill': fill } as CSSProperties}
      className="range"
    />
  )
}

/**
 * Custom mode setup: a preset to start from, then every rule on its own
 * control. Two columns when there is room (container query on the panel).
 */
export function CustomSettingsForm({ value, onChange }: CustomSettingsFormProps) {
  const ids = {
    orbs: useId(),
    speed: useId(),
    lives: useId(),
    walls: useId(),
    time: useId(),
    target: useId(),
  }
  const preset = matchingPreset(value)
  const set = (patch: Partial<CustomSettings>): void => onChange({ ...value, ...patch })
  const limitFor = (key: LimitKey, label: string) => ({
    label,
    isOn: value[key] === null,
    onToggle: () => onChange({ ...value, [key]: value[key] === null ? LIMIT_DEFAULTS[key] : null }),
  })
  const orbTier = tierForSpeed(value.speed)
  const tierName = SPEED_TIER_INFO[orbTier]?.name ?? ''

  return (
    <div>
      <fieldset>
        <legend className="sr-only">Start from a preset</legend>
        <div className="grid grid-cols-4 gap-1 rounded-[12px] bg-sunken p-1">
          {(Object.keys(CUSTOM_PRESETS) as CustomPreset[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={preset === id}
              onClick={() => onChange(CUSTOM_PRESETS[id])}
              className={`h-8 rounded-[9px] text-[0.8rem] font-bold transition ${
                preset === id ? 'bg-surface text-teal-700 shadow-card' : 'text-muted hover:bg-surface hover:text-ink'
              }`}
            >
              {PRESET_LABELS[id]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-3.5 grid grid-cols-1 gap-x-5 gap-y-3 @min-[260px]:grid-cols-2 @min-[380px]:grid-cols-3">
        <Setting
          label="Orbs"
          inputId={ids.orbs}
          value={
            <span className="inline-flex items-center gap-1.5">
              {value.orbCount}
              <OrbLineup tiers={Array<number>(Math.min(value.orbCount, MAX_DOTS)).fill(orbTier)} size="sm" />
            </span>
          }
        >
          <Slider
            id={ids.orbs}
            min={CUSTOM_LIMITS.orbCount.min}
            max={CUSTOM_LIMITS.orbCount.max}
            value={value.orbCount}
            onChange={(orbCount) => set({ orbCount })}
          />
        </Setting>
        <Setting
          label="Speed"
          inputId={ids.speed}
          value={
            <span className="inline-flex items-center gap-1.5" title={tierName}>
              {value.speed.toFixed(1)}×
              <OrbLineup tiers={[orbTier]} size="sm" />
            </span>
          }
        >
          <Slider
            id={ids.speed}
            min={CUSTOM_LIMITS.speed.min}
            max={CUSTOM_LIMITS.speed.max}
            step={0.1}
            value={value.speed}
            onChange={(speed) => set({ speed: Math.round(speed * 10) / 10 })}
          />
        </Setting>
        <Setting label="Clear at" inputId={ids.target} value={`${value.targetPercent}%`}>
          <Slider
            id={ids.target}
            min={CUSTOM_LIMITS.targetPercent.min}
            max={CUSTOM_LIMITS.targetPercent.max}
            value={value.targetPercent}
            onChange={(targetPercent) => set({ targetPercent })}
          />
        </Setting>
        <Setting
          label="Lives"
          inputId={ids.lives}
          value={value.lives ?? '∞'}
          limit={limitFor('lives', 'Unlimited lives')}
        >
          <Slider
            id={ids.lives}
            min={CUSTOM_LIMITS.lives.min}
            max={CUSTOM_LIMITS.lives.max}
            value={value.lives ?? LIMIT_DEFAULTS.lives}
            disabled={value.lives === null}
            onChange={(lives) => set({ lives })}
          />
        </Setting>
        <Setting
          label="Walls"
          inputId={ids.walls}
          value={value.walls ?? '∞'}
          limit={limitFor('walls', 'Unlimited walls')}
        >
          <Slider
            id={ids.walls}
            min={CUSTOM_LIMITS.walls.min}
            max={CUSTOM_LIMITS.walls.max}
            value={value.walls ?? LIMIT_DEFAULTS.walls}
            disabled={value.walls === null}
            onChange={(walls) => set({ walls })}
          />
        </Setting>
        <Setting
          label="Timer"
          inputId={ids.time}
          value={value.timeLimitSeconds === null ? '∞' : `${value.timeLimitSeconds} s`}
          limit={limitFor('timeLimitSeconds', 'No time limit')}
        >
          <Slider
            id={ids.time}
            min={CUSTOM_LIMITS.timeLimitSeconds.min}
            max={CUSTOM_LIMITS.timeLimitSeconds.max}
            step={10}
            value={value.timeLimitSeconds ?? LIMIT_DEFAULTS.timeLimitSeconds}
            disabled={value.timeLimitSeconds === null}
            onChange={(timeLimitSeconds) => set({ timeLimitSeconds })}
          />
        </Setting>
      </div>
      <p className="mt-2.5 text-left text-[0.7rem] text-subtle">∞ removes a limit. Lives, walls and the timer reset every level.</p>
    </div>
  )
}
