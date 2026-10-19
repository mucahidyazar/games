import type { Ref, RefObject } from 'react'
import type { Actor, AnyDilemma, Lang, PersonActor, TrolleyChoice } from '../content/types'
import type { SceneEvent, SceneEventDetail } from '../scene/TrolleyScene'
import type { Timeline } from './animate'

/** What every motion scene gets, and gives back: the same contract as the 3D stage. */

export interface MotionSceneHandle {
  /** Plays the choice out; resolves when it is over. */
  play(choice: TrolleyChoice): Promise<void>
}

/** How a scene is laid out: for a wide stage, or a tall one (a phone held upright). */
export type Frame = 'wide' | 'tall'

export type MotionSceneProps = {
  readonly ref?: Ref<MotionSceneHandle>
  readonly frame?: Frame
  readonly dilemma: AnyDilemma
  readonly lang: Lang
  /** A choice already made: open on its aftermath instead of the arrival. */
  readonly settled: TrolleyChoice | null
  readonly reducedMotion: boolean
  /** Whether the switch in the scene can be clicked to decide. */
  readonly interactive: boolean
  readonly onLever?: (choice: TrolleyChoice) => void
  readonly onEvent: (event: SceneEvent, detail?: SceneEventDetail) => void
}

export type Emit = (event: SceneEvent, detail?: SceneEventDetail) => void

export const isPerson = (actor: Actor): actor is PersonActor => actor.kind === 'person'

/** Turns useId's output into something safe inside url(#…). */
export const svgId = (id: string): string => `atp-m${id.replace(/[^a-zA-Z0-9_-]/g, '')}`

/** Counts runs, so an arrival cut short by an early choice knows to stop. */
export interface Turn {
  current: number
}

/** Passes a scene's events on, until its timeline is finished (the scene has gone). */
export function emitter(timeline: Timeline, latest: RefObject<{ readonly onEvent: Emit }>): Emit {
  return (event, detail) => {
    if (!timeline.finished) latest.current.onEvent(event, detail)
  }
}
