import { describe, expect, it } from 'vitest'
import { verifyRun } from './verify'

describe('verifyRun', () => {
  it('returns the replayed result', () => {
    const outcome = verifyRun({ mode: 'classic', seed: 7, field: 'landscape', inputs: [], endTick: 240 })
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.result.tick).toBe(240)
  })

  it('turns malformed recordings into a reason instead of an exception', () => {
    const outcome = verifyRun({
      mode: 'classic',
      seed: 7,
      field: 'landscape',
      inputs: [
        { t: 90, c: 50, r: 50, o: 'v' },
        { t: 30, c: 50, r: 50, o: 'v' },
      ],
      endTick: 200,
    })
    expect(outcome).toEqual({ ok: false, reason: 'order: input 1: inputs must be in tick order' })
  })
})
