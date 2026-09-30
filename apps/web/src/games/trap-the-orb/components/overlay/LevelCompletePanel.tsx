import type { LevelResult } from '@games/trap-the-orb-engine'
import { useId } from 'react'
import { ArrowRightIcon, CheckIcon } from '@/components/icons'
import { formatClock, formatNumber } from '@/lib/format'
import { describeLevelChange } from '../../modes/modeContent'
import { OrbLineup } from '../OrbLineup'
import { ActionButton, Panel } from './Panel'
import { useFocusOnMount } from './useFocusOnMount'
import type { OverlayProps } from './types'

function BonusRow({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular font-bold ${value > 0 ? 'text-teal-700' : 'text-subtle'}`}>+{formatNumber(value)}</dd>
    </div>
  )
}

function livesText(hud: OverlayProps['hud'], result: LevelResult): string {
  if (hud.infiniteLives) return 'unlimited lives'
  return `${result.livesLeft} ${result.livesLeft === 1 ? 'life' : 'lives'} left`
}

export function LevelCompletePanel({ hud, controller, onAfterAction, result }: OverlayProps & { readonly result: LevelResult }) {
  const titleId = useId()
  const nextRef = useFocusOnMount<HTMLButtonElement>()
  const next = hud.nextLevel

  return (
    <Panel labelledBy={titleId}>
      <span className="mx-auto grid size-10 place-items-center rounded-full bg-teal-100 text-teal-700">
        <CheckIcon className="size-5" />
      </span>
      <h2 id={titleId} className="mt-2.5 text-[1.3rem] font-extrabold tracking-[-0.02em]">
        Level {result.level} cleared!
      </h2>
      <p className="tabular mt-1.5 text-[0.82rem] text-muted">
        {Math.floor(result.percent)}% captured · {formatClock(result.elapsedMs)} · {livesText(hud, result)}
      </p>
      <dl className="mt-3.5 divide-y divide-divider rounded-[10px] bg-page px-3.5 py-1 text-left text-[0.82rem]">
        <BonusRow label="Territory bonus" value={result.areaBonus} />
        {!hud.infiniteLives && <BonusRow label="Lives bonus" value={result.livesBonus} />}
        <BonusRow label={hud.timeLeftMs === null ? 'Speed bonus' : 'Time left bonus'} value={result.timeBonus} />
        {hud.wallBudget !== null && <BonusRow label="Unused walls bonus" value={result.wallBonus} />}
        <div className="flex items-center justify-between py-1.5">
          <dt className="font-bold text-ink">Score</dt>
          <dd className="tabular text-[0.98rem] font-extrabold text-ink">{formatNumber(hud.score)}</dd>
        </div>
      </dl>
      {next && (
        <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-divider px-3.5 py-2.5 text-left">
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-bold tracking-[0.08em] text-subtle uppercase">Next · Level {next.level}</p>
            <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-soft">{describeLevelChange(hud.orbTiers, next)}</p>
          </div>
          <OrbLineup tiers={next.orbTiers} />
        </div>
      )}
      <div className="mt-4">
        <ActionButton
          ref={nextRef}
          onClick={() => {
            controller.nextLevel()
            onAfterAction()
          }}
        >
          Next level <ArrowRightIcon className="size-4" />
        </ActionButton>
      </div>
    </Panel>
  )
}
