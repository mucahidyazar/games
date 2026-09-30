import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SpeedGauge } from './SpeedGauge'

const needleRotation = (container: HTMLElement): string =>
  (container.querySelector('line') as SVGLineElement).style.transform

describe('SpeedGauge', () => {
  it('points the needle left at base speed and right at the cap', () => {
    const slow = render(<SpeedGauge factor={1} maxFactor={1.7} />)
    const fast = render(<SpeedGauge factor={1.7} maxFactor={1.7} />)

    expect(needleRotation(slow.container)).toBe('rotate(0deg)')
    expect(needleRotation(fast.container)).toBe('rotate(180deg)')
  })

  it('moves proportionally in between and clamps out-of-range values', () => {
    const middle = render(<SpeedGauge factor={1.35} maxFactor={1.7} />)
    const beyond = render(<SpeedGauge factor={3} maxFactor={1.7} />)
    const flat = render(<SpeedGauge factor={1.2} maxFactor={1} />)

    expect(needleRotation(middle.container)).toBe('rotate(90deg)')
    expect(needleRotation(beyond.container)).toBe('rotate(180deg)')
    expect(needleRotation(flat.container)).toBe('rotate(0deg)')
  })
})
