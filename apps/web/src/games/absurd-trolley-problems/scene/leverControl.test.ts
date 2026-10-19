import { describe, expect, it } from 'vitest'
import { CLICK_SLOP, leverAngle, moveDrag, releaseChoice, startDrag } from './leverControl'

const REST = { x: 100, y: 100 }
const PULLED = { x: 200, y: 80 }

describe('dragging the lever', () => {
  it('pulls on a click, even with a little wobble', () => {
    const drag = startDrag({ x: 120, y: 90 }, REST, PULLED)
    moveDrag(drag, { x: 120 + CLICK_SLOP - 1, y: 90 })
    expect(drag.moved).toBe(false)
    expect(releaseChoice(drag)).toBe('pull')
  })

  it('follows the knob’s swing and pulls past halfway', () => {
    const drag = startDrag({ x: 120, y: 90 }, REST, PULLED)
    expect(moveDrag(drag, { x: 175, y: 80 })).toBeCloseTo(0.548, 3)
    expect(releaseChoice(drag)).toBe('pull')
    // Movement across the swing barely counts.
    expect(moveDrag(drag, { x: 120, y: 190 })).toBe(0)
  })

  it('leaves the lever be when let go short of halfway', () => {
    const drag = startDrag({ x: 120, y: 90 }, REST, PULLED)
    moveDrag(drag, { x: 150, y: 90 })
    expect(drag.moved).toBe(true)
    expect(drag.progress).toBeLessThan(0.5)
    expect(releaseChoice(drag)).toBe('stay')
  })

  it('stops at either end of the swing', () => {
    const drag = startDrag({ x: 120, y: 90 }, REST, PULLED, 0.4)
    expect(moveDrag(drag, { x: 600, y: 0 })).toBe(1)
    expect(moveDrag(drag, { x: -600, y: 300 })).toBe(0)
  })

  it('copes with a lever seen end-on', () => {
    const drag = startDrag({ x: 10, y: 10 }, REST, REST)
    expect(moveDrag(drag, { x: 80, y: 10 })).toBe(0)
    expect(releaseChoice(drag)).toBe('stay')
  })

  it('turns progress into the arm’s angle', () => {
    expect(leverAngle(0, 0.5)).toBe(0.5)
    expect(leverAngle(1, 0.5)).toBe(-0.5)
    expect(leverAngle(0.5, 0.5)).toBe(0)
    expect(leverAngle(3, 0.5)).toBe(-0.5)
  })
})
