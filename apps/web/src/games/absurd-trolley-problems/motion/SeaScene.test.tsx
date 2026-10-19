import { act, fireEvent, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualFrames } from '@/test/manualFrames'
import { FOOT_DILEMMAS } from '../content/foot'
import type { AnyDilemma, Lang, TrolleyChoice } from '../content/types'
import type { SceneEvent, SceneEventDetail } from '../scene/TrolleyScene'
import type { Frame, MotionSceneHandle } from './scene'
import { SeaScene } from './SeaScene'

const LIFEBOAT = FOOT_DILEMMAS.find((dilemma) => dilemma.id === 'foot-lifeboat') as AnyDilemma

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderScene({ settled = null as TrolleyChoice | null, reducedMotion = false, interactive = true, frame = 'wide' as Frame, lang = 'en' as Lang } = {}) {
  const ref = createRef<MotionSceneHandle>()
  const events: SceneEvent[] = []
  const details: (SceneEventDetail | undefined)[] = []
  const onLever = vi.fn()
  const view = render(
    <SeaScene
      ref={ref}
      frame={frame}
      dilemma={LIFEBOAT}
      lang={lang}
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
  const dimmed = (selector: string): number => view.container.querySelectorAll(`${selector} [data-part="body"][opacity="0.5"]`).length
  const impacts = () => details.filter((_, index) => events[index] === 'impact')
  return { ...view, ref, events, impacts, onLever, root, part, dimmed }
}

const count = (events: readonly SceneEvent[], event: SceneEvent): number => events.filter((seen) => seen === event).length
const DROWNED = { kind: 'person', how: 'drown' }
const settle = () =>
  act(async () => {
    await Promise.resolve()
  })

describe('the lifeboat, in motion', () => {
  it('rides in on the storm, six aboard, and waits', async () => {
    const frames = manualFrames()
    const { root, events, part, container } = renderScene()
    expect(root.dataset.state).toBe('arriving')

    await frames.run(1600)

    expect(root.dataset.state).toBe('waiting')
    expect(events).toEqual(['creak'])
    expect(part('labels')?.getAttribute('opacity')).toBe('1')
    expect(part('sign')?.getAttribute('opacity')).toBe('1')
    expect(part('sign')).toHaveTextContent('STORM!')
    expect(container.querySelectorAll('[data-part="boat"] .atp-m-figure')).toHaveLength(LIFEBOAT.trackA.length)
    // You are the first of the five, standing beside the one at the stern.
    const marked = container.querySelector('[data-part="castaway"] [data-part="marker"]')
    expect(marked).toHaveAttribute('opacity', '1')
    expect(marked).toHaveTextContent('YOU')
    expect(container.querySelector('[data-part="one"] [data-part="marker"]')).toHaveAttribute('opacity', '0')
  })

  it('throws the one overboard: he goes under, the boat rides higher, the storm clears, the others cheer', async () => {
    const frames = manualFrames()
    const { root, ref, events, impacts, part, dimmed } = renderScene()
    await frames.run(1600)

    await act(() => frames.until(ref.current?.play('pull') as Promise<void>))

    expect(events).toEqual(['creak', 'push', 'splash', 'impact', 'cheer'])
    expect(impacts()).toEqual([DROWNED])
    expect(root.dataset.state).toBe('done')
    expect(dimmed('[data-part="one"]')).toBe(1)
    expect(dimmed('[data-part="castaway"]')).toBe(0)
    expect(part('labels')?.getAttribute('opacity')).toBe('0')
    expect(part('boat')?.getAttribute('transform')).toBe('translate(470 374) rotate(0) scale(1)')
    expect(part('one')?.getAttribute('transform')).toBe('translate(232 88) rotate(0 0 -40)')
    expect(part('rain')?.getAttribute('opacity')).toBe('0')
    expect(part('clear')?.getAttribute('opacity')).toBe('1')
    expect(part('bubbles')?.getAttribute('opacity')).toBe('1')
  })

  it('waits: a wave swamps the boat, and all six go under one after another', async () => {
    const frames = manualFrames()
    const { root, ref, events, impacts, part, dimmed } = renderScene()
    await frames.run(1600)

    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))

    expect(events.slice(0, 3)).toEqual(['creak', 'splash', 'creak'])
    expect(count(events, 'impact')).toBe(LIFEBOAT.trackA.length)
    expect(impacts()).toEqual(Array.from({ length: 6 }, () => DROWNED))
    expect(events).not.toContain('cheer')
    expect(root.dataset.state).toBe('done')
    expect(dimmed('[data-part="castaway"]')).toBe(5)
    expect(dimmed('[data-part="one"]')).toBe(1)
    expect(part('boat')?.getAttribute('transform')).toBe('translate(470 472) rotate(-12) scale(1)')
    expect(part('breaker')?.getAttribute('opacity')).toBe('0')
    expect(part('debris')?.getAttribute('opacity')).toBe('1')
  })

  it('plays the whole run at once for reduced motion', async () => {
    const pulled = renderScene({ reducedMotion: true })
    await settle()
    expect(pulled.root.dataset.state).toBe('waiting')
    await act(() => pulled.ref.current?.play('pull') as Promise<void>)
    expect(pulled.events).toEqual(['creak', 'push', 'splash', 'impact', 'cheer'])
    pulled.unmount()

    const waited = renderScene({ reducedMotion: true })
    await settle()
    await act(() => waited.ref.current?.play('stay') as Promise<void>)
    expect(count(waited.events, 'impact')).toBe(6)
    expect(waited.dimmed('[data-part="boat"]')).toBe(6)
  })

  it('opens either choice on its aftermath, without a sound', () => {
    const thrown = renderScene({ settled: 'pull' })
    expect(thrown.root.dataset.state).toBe('done')
    expect(thrown.events).toEqual([])
    expect(thrown.part('boat')?.getAttribute('transform')).toBe('translate(470 374) rotate(0) scale(1)')
    expect(thrown.dimmed('[data-part="one"]')).toBe(1)
    expect(thrown.dimmed('[data-part="castaway"]')).toBe(0)
    expect(thrown.part('clear')?.getAttribute('opacity')).toBe('1')
    expect(thrown.container.querySelector('[data-part="castaway"] [data-part="marker"]')).toHaveAttribute('opacity', '0')
    thrown.unmount()

    const sunk = renderScene({ settled: 'stay' })
    expect(sunk.root.dataset.state).toBe('done')
    expect(sunk.events).toEqual([])
    expect(sunk.part('boat')?.getAttribute('transform')).toBe('translate(470 472) rotate(-12) scale(1)')
    expect(sunk.dimmed('[data-part="boat"]')).toBe(6)
    expect(sunk.part('debris')?.getAttribute('opacity')).toBe('1')
    expect(sunk.part('clear')?.getAttribute('opacity')).toBe('0')
  })

  it('takes a click on the one at the stern only while it is live', () => {
    manualFrames()
    const live = renderScene()
    fireEvent.click(live.container.querySelector('.atp-m-hotspot') as Element)
    expect(live.onLever).toHaveBeenCalledWith('pull')
    live.unmount()

    const idle = renderScene({ interactive: false })
    fireEvent.click(idle.container.querySelector('.atp-m-hotspot') as Element)
    expect(idle.onLever).not.toHaveBeenCalled()
  })

  it('lays the boat out for a phone held upright, and plays it either way', async () => {
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
    expect(count(pulled.events, 'impact')).toBe(LIFEBOAT.trackB.length)
    expect(pulled.root.dataset.state).toBe('done')
    pulled.unmount()

    const stayed = renderScene({ frame: 'tall', reducedMotion: true })
    await settle()
    await act(() => stayed.ref.current?.play('stay') as Promise<void>)
    expect(count(stayed.events, 'impact')).toBe(LIFEBOAT.trackA.length)
    stayed.unmount()

    const settled = renderScene({ frame: 'tall', settled: 'stay' })
    expect(settled.root.dataset.state).toBe('done')
    expect(settled.dimmed('[data-part="boat"]')).toBe(6)
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

  it('names itself, and its warning, in either language', () => {
    const english = renderScene()
    expect(english.container.querySelector('svg')).toHaveAccessibleName(/overloaded lifeboat in a storm/)
    english.unmount()
    const turkish = renderScene({ lang: 'tr' })
    expect(turkish.container.querySelector('svg')).toHaveAccessibleName('Hareketli çizim: fırtınada aşırı yüklü bir filika')
    expect(turkish.part('sign')).toHaveTextContent('FIRTINA!')
    expect(turkish.part('labels')).toHaveTextContent('Denize at')
    expect(turkish.part('labels')).toHaveTextContent('Bekle')
  })
})
