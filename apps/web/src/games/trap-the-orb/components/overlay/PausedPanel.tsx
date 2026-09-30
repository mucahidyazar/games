import { useId } from 'react'
import { FlagIcon, PlayIcon, RestartIcon } from '@/components/icons'
import { ActionButton, Panel, TextButton } from './Panel'
import { useFocusOnMount } from './useFocusOnMount'
import type { OverlayProps } from './types'

export function PausedPanel({ hud, controller, flow, onLeaveRun, onAfterAction }: OverlayProps) {
  const titleId = useId()
  const resumeRef = useFocusOnMount<HTMLButtonElement>()
  const run = (action: () => void) => () => {
    action()
    onAfterAction()
  }

  return (
    <Panel labelledBy={titleId}>
      <h2 id={titleId} className="text-[1.3rem] font-extrabold tracking-[-0.02em]">
        Paused
      </h2>
      <p className="mt-1 text-[0.85rem] text-muted">The orbs will wait for you.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
        <ActionButton ref={resumeRef} onClick={run(() => controller.resume())}>
          <PlayIcon className="size-4" /> Resume
        </ActionButton>
        {hud.rankedMode ? (
          <ActionButton variant="secondary" onClick={run(() => flow.endRun())}>
            <FlagIcon className="size-4" /> End run
          </ActionButton>
        ) : (
          <ActionButton variant="secondary" onClick={run(() => controller.restartLevel())}>
            <RestartIcon className="size-4" /> Restart level
          </ActionButton>
        )}
      </div>
      {hud.rankedMode ? (
        <p className="mx-auto mt-3 max-w-[30ch] text-[0.75rem] text-subtle">
          Ending the run keeps the score you have so far. Pick another mode after that.
        </p>
      ) : (
        <div className="mt-3">
          <TextButton onClick={onLeaveRun}>Change mode</TextButton>
          <p className="mt-1 text-[0.72rem] text-subtle">You can continue this run later from its level.</p>
        </div>
      )}
    </Panel>
  )
}
