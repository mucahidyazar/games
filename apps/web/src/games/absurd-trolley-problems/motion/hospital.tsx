import type { PersonActor } from '../content/types'
import { Figure } from './figures'
import { WEAK_LINE } from './monitor'

/**
 * The bed of the scenes set in a hospital (the ward, the operating theatre),
 * with whoever lies in it and their monitor.
 */

/** How high a patient sits in bed: just their head and shoulders above the blanket. */
const IN_BED = 'translate(0 -12) scale(0.9)'

type BedProps = {
  readonly actor: PersonActor
  readonly youLabel: string
  readonly delay: number
  /** How far to the side the monitor stands. */
  readonly monitorAt: number
  /** A bandage round the head (off the crash). */
  readonly bandaged?: boolean
  /** A rise in the blanket: the patient is pregnant. */
  readonly expecting?: boolean
}

/** A hospital bed, front on, its foot on (0, 0), with whoever lies in it and their monitor `monitorAt` to the side. */
export function Bed({ actor, youLabel, delay, monitorAt, bandaged = false, expecting = false }: BedProps) {
  return (
    <g className="atp-m-hospital-bed">
      <ellipse cx="0" cy="2" rx="50" ry="6" className="atp-m-shadow" />
      <rect x="-40" y="-100" width="80" height="62" rx="12" fill="#7d93b4" />
      <rect x="-36" y="-96" width="72" height="8" rx="4" fill="#a9bcd6" />
      <ellipse cx="0" cy="-74" rx="26" ry="10" fill="#eef3f8" />
      <g transform={IN_BED}>
        <Figure actor={actor} youLabel={youLabel} delay={delay} />
        {bandaged && <path data-part="bandage" d="M-12.4 -73.5q12.4 -4 24.8 0v5q-12.4 -4 -24.8 0z" fill="#f4f6f8" stroke="#d6dde6" strokeWidth="0.8" />}
      </g>
      {expecting && <ellipse cx="0" cy="-50" rx="25" ry="11" fill="#e6edf5" />}
      <rect x="-46" y="-50" width="92" height="30" rx="8" fill="#e6edf5" />
      <path d="M-40 -42H40" stroke="#c4d0de" strokeWidth="2" />
      <rect x="-44" y="-22" width="88" height="8" rx="3" fill="#9fb2cb" />
      <rect x="-40" y="-14" width="6" height="14" fill="#5d6f8c" />
      <rect x="34" y="-14" width="6" height="14" fill="#5d6f8c" />
      <g transform={`translate(${monitorAt} 0)`}>
        <rect x="-2" y="-112" width="4" height="112" fill="#5d6f8c" />
        <rect x="-22" y="-142" width="44" height="30" rx="5" fill="#0d1a2c" stroke="#5d6f8c" strokeWidth="2" />
        <path data-part="ecg" className="atp-m-ecg is-weak" d={WEAK_LINE} transform="translate(0 -127)" />
      </g>
    </g>
  )
}
