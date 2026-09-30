import { FIELD_LONG_SIDE, FIELD_SHORT_SIDE } from './constants'
import type { FieldOrientation, GridDims } from './types'

/**
 * Grid size of the playing field. Portrait is the landscape field turned on
 * its side, so every player — on any screen — faces the same challenge.
 */
export function fieldDims(orientation: FieldOrientation): GridDims {
  return orientation === 'portrait'
    ? { cols: FIELD_SHORT_SIDE, rows: FIELD_LONG_SIDE }
    : { cols: FIELD_LONG_SIDE, rows: FIELD_SHORT_SIDE }
}

/** Portrait for tall boxes (width / height below 1), landscape otherwise. */
export function orientationForAspect(aspect: number): FieldOrientation {
  return Number.isFinite(aspect) && aspect > 0 && aspect < 1 ? 'portrait' : 'landscape'
}
