import {
  ReplayError,
  replayRun,
  type FieldOrientation,
  type GameMode,
  type ReplayResult,
  type RunInput,
} from '@games/trap-the-orb-engine'

/**
 * Replay verification, kept free of I/O and shared state: plain data in,
 * plain data out. That is exactly what a worker thread needs, so this can move
 * off the event loop without touching its callers.
 */

export interface VerifyRequest {
  readonly mode: GameMode
  readonly seed: number
  readonly field: FieldOrientation
  readonly inputs: readonly RunInput[]
  readonly endTick: number
}

export type VerifyOutcome =
  | { readonly ok: true; readonly result: ReplayResult }
  | { readonly ok: false; readonly reason: string }

export function verifyRun(request: VerifyRequest): VerifyOutcome {
  try {
    return { ok: true, result: replayRun(request) }
  } catch (error) {
    if (error instanceof ReplayError) return { ok: false, reason: `${error.code}: ${error.message}` }
    throw error
  }
}
