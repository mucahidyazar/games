import { setAttr } from './animate'

/** The lines a hospital monitor shows in the motion scenes (the ward, the operating theatre). */

export type Pulse = 'weak' | 'well' | 'flat'

const LINES: Readonly<Record<Pulse, string>> = {
  well: 'M-18 0h7l3 -9l4 18l3 -13l2 4h17',
  weak: 'M-18 0h9l2 -3l3 6l2 -4l1 1h19',
  flat: 'M-18 0h36',
}

/** The line a monitor starts on: a weak pulse. */
export const WEAK_LINE = LINES.weak

/** Sets what a monitor inside `holder` shows; `line` names its trace, when there is more than one. */
export function monitor(holder: Element | null, state: Pulse, line = 'ecg'): void {
  const trace = holder?.querySelector(`[data-part="${line}"]`)
  setAttr(trace, 'd', LINES[state])
  setAttr(trace, 'class', `atp-m-ecg is-${state}`)
}
