import { act, fireEvent, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualFrames } from '@/test/manualFrames'
import { FOOT_DILEMMAS } from '../content/foot'
import type { AnyDilemma, TrolleyChoice } from '../content/types'
import type { SceneEvent, SceneEventDetail } from '../scene/TrolleyScene'
import { HomeScene } from './HomeScene'
import type { Frame, MotionSceneHandle } from './scene'

const CHILDREN_CASE = FOOT_DILEMMAS.find((dilemma) => dilemma.id === 'foot-children') as AnyDilemma

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderScene({ settled = null as TrolleyChoice | null, reducedMotion = false, interactive = true, frame = 'wide' as Frame } = {}) {
  const ref = createRef<MotionSceneHandle>()
  const events: SceneEvent[] = []
  const details: (SceneEventDetail | undefined)[] = []
  const onLever = vi.fn()
  const view = render(
    <HomeScene
      ref={ref}
      frame={frame}
      dilemma={CHILDREN_CASE}
      lang="en"
      settled={settled}
      reducedMotion={reducedMotion}
      interactive={interactive}
      onLever={onLever}
      onEvent={(event, detail) => {
        events.push(event)
        details.push(detail)
      }}
    />,
  )
  const root = view.container.querySelector('.atp-m-scene') as SVGGElement
  const part = (name: string) => view.container.querySelector(`[data-part="${name}"]`)
  return { ...view, ref, events, details, onLever, root, part }
}

const count = (events: readonly SceneEvent[], event: SceneEvent): number => events.filter((seen) => seen === event).length
const dimmed = (container: HTMLElement, selector: string): number => container.querySelectorAll(`${selector} [data-part="body"][opacity="0.5"]`).length
const opacities = (container: HTMLElement, name: string): (string | null)[] => Array.from(container.querySelectorAll(`[data-part="${name}"]`), (node) => node.getAttribute('opacity'))
const settle = () =>
  act(async () => {
    await Promise.resolve()
  })

describe('the starving children, in motion', () => {
  it('brings the man up the street with his bread, then waits', async () => {
    const frames = manualFrames()
    const { root, events, part } = renderScene()
    expect(root.dataset.state).toBe('arriving')

    await frames.run(2100)

    expect(root.dataset.state).toBe('waiting')
    expect(events).toEqual(['creak'])
    expect(part('labels')?.getAttribute('opacity')).toBe('1')
    expect(part('man')?.getAttribute('transform')).toBe('translate(756 474)')
    expect(part('basket')?.getAttribute('transform')).toBe('translate(756 474)')
    expect(part('door')?.getAttribute('transform')).toBe('translate(536 0) scale(1 1)')
  })

  it('kills him for it: one life, then the stove is lit, the bowls filled and the children cheer', async () => {
    const frames = manualFrames()
    const { root, ref, events, details, part, container } = renderScene()
    await frames.run(2100)

    await act(() => frames.until(ref.current?.play('pull') as Promise<void>))

    expect(events).toEqual(['creak', 'push', 'impact', 'heal', 'cheer'])
    expect(details[events.indexOf('impact')]).toEqual({ kind: 'person' })
    expect(root.dataset.state).toBe('done')
    expect(dimmed(container, '[data-part="man"]')).toBe(1)
    expect(dimmed(container, '[data-part="child"]')).toBe(0)
    // The bread is on the table, you are beside it, and the house is warm.
    expect(part('basket')?.getAttribute('transform')).toBe('translate(407 368)')
    expect(part('you')?.getAttribute('transform')).toBe('translate(460 392)')
    for (const name of ['fire', 'warmth', 'soup', 'steam']) expect(part(name)?.getAttribute('opacity')).toBe('1')
    expect(opacities(container, 'shawl')).toEqual(['0', '0', '0'])
    // The dark moment has passed and the lamp is back on.
    expect(part('dark')?.getAttribute('opacity')).toBe('0')
    expect(part('lamp-light')?.getAttribute('opacity')).toBe('1')
  })

  it('holds back: he walks on with his bread, and the three children are lost', async () => {
    const frames = manualFrames()
    const { root, ref, events, details, part, container } = renderScene()
    await frames.run(2100)

    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))

    expect(events).toEqual(['creak', 'impact', 'impact', 'impact'])
    expect(details.filter(Boolean)).toEqual([
      { kind: 'person', how: 'flatline' },
      { kind: 'person', how: 'flatline' },
      { kind: 'person', how: 'flatline' },
    ])
    expect(root.dataset.state).toBe('done')
    expect(dimmed(container, '[data-part="child"]')).toBe(3)
    expect(dimmed(container, '[data-part="man"]')).toBe(0)
    expect(part('man')?.getAttribute('opacity')).toBe('0')
    expect(part('basket')?.getAttribute('opacity')).toBe('0')
    expect(part('you')?.getAttribute('transform')).toBe('translate(525 392)')
    expect(part('fire')?.getAttribute('opacity')).toBe('0')
    expect(part('chill')?.getAttribute('opacity')).toBe('1')
  })

  it('plays out a choice made before the man has stopped', async () => {
    const frames = manualFrames()
    const { ref, events, container } = renderScene()
    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))
    expect(count(events, 'impact')).toBe(3)
    expect(dimmed(container, '[data-part="child"]')).toBe(3)
  })

  it('plays the whole run at once for reduced motion', async () => {
    const { ref, events, root } = renderScene({ reducedMotion: true })
    await settle()
    expect(root.dataset.state).toBe('waiting')
    await act(() => ref.current?.play('pull') as Promise<void>)
    expect(events).toEqual(['creak', 'push', 'impact', 'heal', 'cheer'])
    expect(root.dataset.state).toBe('done')
  })

  it('opens either choice on its aftermath, without a sound', () => {
    const killed = renderScene({ settled: 'pull' })
    expect(killed.root.dataset.state).toBe('done')
    expect(killed.events).toEqual([])
    expect(dimmed(killed.container, '[data-part="man"]')).toBe(1)
    expect(dimmed(killed.container, '[data-part="child"]')).toBe(0)
    expect(killed.part('basket')?.getAttribute('transform')).toBe('translate(407 368)')
    expect(killed.part('fire')?.getAttribute('opacity')).toBe('1')
    expect(killed.part('soup')?.getAttribute('opacity')).toBe('1')
    expect(killed.part('labels')?.getAttribute('opacity')).toBe('0')
    killed.unmount()

    const held = renderScene({ settled: 'stay' })
    expect(held.root.dataset.state).toBe('done')
    expect(held.events).toEqual([])
    expect(dimmed(held.container, '[data-part="child"]')).toBe(3)
    expect(held.part('man')?.getAttribute('opacity')).toBe('0')
    expect(held.part('fire')?.getAttribute('opacity')).toBe('0')
    expect(held.part('chill')?.getAttribute('opacity')).toBe('1')
    expect(opacities(held.container, 'shawl')).toEqual(['0.5', '0.5', '0.5'])
  })

  it('takes a click on the man only while it waits for you', () => {
    manualFrames()
    const live = renderScene()
    fireEvent.click(live.container.querySelector('.atp-m-hotspot') as Element)
    expect(live.onLever).toHaveBeenCalledWith('pull')
    live.unmount()

    const idle = renderScene({ interactive: false })
    fireEvent.click(idle.container.querySelector('.atp-m-hotspot') as Element)
    expect(idle.onLever).not.toHaveBeenCalled()
  })

  it('names itself, and keeps the scale of each child', () => {
    const { container } = renderScene()
    expect(container.querySelector('svg')).toHaveAccessibleName(/poor home/)
    const scales = Array.from(container.querySelectorAll('[data-part="child"]'), (child) => /scale\(([\d.]+)\)/.exec(child.getAttribute('transform') ?? '')?.[1])
    expect(scales).toEqual(['0.7', '0.66', '0.62'])
  })

  it('lays itself out for a phone held upright, and plays it either way', async () => {
    const viewBox = (container: HTMLElement): number[] => (container.querySelector('svg')?.getAttribute('viewBox') ?? '').split(' ').map(Number)
    const wide = renderScene({ reducedMotion: true })
    const [, , wideW = 0, wideH = 1] = viewBox(wide.container)
    wide.unmount()

    const pulled = renderScene({ frame: 'tall', reducedMotion: true })
    const [, , tallW = 0, tallH = 1] = viewBox(pulled.container)
    expect(tallW).toBeLessThan(wideW)
    expect(tallW / tallH).toBeLessThan(wideW / wideH)
    await settle()
    await act(() => pulled.ref.current?.play('pull') as Promise<void>)
    expect(count(pulled.events, 'impact')).toBe(CHILDREN_CASE.trackB.length)
    expect(dimmed(pulled.container, '[data-part="man"]')).toBe(1)
    expect(pulled.root.dataset.state).toBe('done')
    pulled.unmount()

    const stayed = renderScene({ frame: 'tall', reducedMotion: true })
    await settle()
    await act(() => stayed.ref.current?.play('stay') as Promise<void>)
    expect(count(stayed.events, 'impact')).toBe(CHILDREN_CASE.trackA.length)
    expect(dimmed(stayed.container, '[data-part="child"]')).toBe(3)
    stayed.unmount()

    const settled = renderScene({ frame: 'tall', settled: 'pull' })
    expect(settled.root.dataset.state).toBe('done')
  })

  it('goes quiet when it is taken off the stage mid-run', async () => {
    const frames = manualFrames()
    const { ref, events, unmount } = renderScene()
    const run = ref.current?.play('stay') as Promise<void>
    frames.step(16)
    const before = events.length
    unmount()
    await run
    expect(events).toHaveLength(before)
  })
})
