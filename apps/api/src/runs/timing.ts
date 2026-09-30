import { MAX_RUN_TICKS, TICKS_PER_SECOND } from '@games/trap-the-orb-engine'

/** Longest replayable run, in seconds of game time (three hours). */
export const MAX_RUN_SECONDS = MAX_RUN_TICKS / TICKS_PER_SECOND
/** Extra wall-clock time a run may stay open (pauses, slow networks) before it expires. */
export const RUN_EXPIRY_MARGIN_SECONDS = 30 * 60
/** Clock skew and latency allowed when comparing game time with wall-clock time. */
export const PLAUSIBILITY_GRACE_SECONDS = 5

const MS_PER_SECOND = 1000

export function secondsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_SECOND
}

/** Runs left open longer than any real game could last are closed as abandoned. */
export function isExpired(elapsedSeconds: number): boolean {
  return elapsedSeconds > MAX_RUN_SECONDS + RUN_EXPIRY_MARGIN_SECONDS
}

/** Nobody plays faster than real time: the recording cannot cover more game time than has passed. */
export function isPlausible(endTick: number, elapsedSeconds: number): boolean {
  return endTick / TICKS_PER_SECOND <= elapsedSeconds + PLAUSIBILITY_GRACE_SECONDS
}
