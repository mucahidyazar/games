import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualFrames } from '@/test/manualFrames'
import { easeInCubic, easeInOutCubic, easeInQuad, easeOutBack, easeOutCubic, easeOutQuad, linear, round2, setAttr, Timeline, transform } from './animate'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('easing', () => {
  it('starts at 0 and ends at 1', () => {
    for (const ease of [linear, easeInQuad, easeOutQuad, easeInCubic, easeOutCubic, easeInOutCubic, easeOutBack]) {
      expect(ease(0)).toBeCloseTo(0)
      expect(ease(1)).toBeCloseTo(1)
    }
    // Back overshoots on the way.
    expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map(easeOutBack))).toBeGreaterThan(1)
  })
})

describe('Timeline', () => {
  it('jumps straight to the end when motion is reduced', async () => {
    const update = vi.fn()
    await new Timeline(true).tween(500, update)
    expect(update).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('jumps to the end without requestAnimationFrame', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    const update = vi.fn()
    await new Timeline(false).tween(500, update)
    expect(update).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('eases a value along, frame by frame', async () => {
    const frames = manualFrames()
    const seen: number[] = []
    const done = new Timeline(false).tween(100, (value) => seen.push(value), linear)
    await frames.until(done, 25)
    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(1)
    expect(seen.length).toBeGreaterThan(3)
  })

  it('skips what is running, then carries on as usual', async () => {
    const frames = manualFrames()
    const timeline = new Timeline(false)
    const first = vi.fn()
    const running = timeline.tween(1000, first)
    frames.step(16)
    timeline.skip()
    await running
    expect(first).toHaveBeenLastCalledWith(1)
    const later = vi.fn()
    const next = timeline.tween(100, later)
    expect(later).not.toHaveBeenCalled()
    await frames.until(next)
  })

  it('finishes for good when its scene goes away', async () => {
    manualFrames()
    const timeline = new Timeline(false)
    const running = timeline.tween(1000, () => undefined)
    timeline.finish()
    await running
    expect(timeline.finished).toBe(true)
    const after = vi.fn()
    await timeline.wait(1000)
    await timeline.tween(1000, after)
    expect(after).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('can be told mid-scene that motion is now reduced', async () => {
    const timeline = new Timeline(false)
    timeline.setInstant(true)
    const update = vi.fn()
    await timeline.tween(1000, update)
    expect(update).toHaveBeenCalledExactlyOnceWith(1)
  })
})

describe('attribute helpers', () => {
  it('writes short transforms', () => {
    expect(transform(1.234, 5)).toBe('translate(1.23 5)')
    expect(transform(0, 0, 12.345, 1.5)).toBe('translate(0 0) rotate(12.35) scale(1.5)')
    expect(round2(0.12345)).toBe(0.12)
  })

  it('ignores nodes that are gone', () => {
    expect(() => setAttr(null, 'opacity', 1)).not.toThrow()
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    setAttr(node, 'opacity', 0.5)
    expect(node.getAttribute('opacity')).toBe('0.5')
  })
})
