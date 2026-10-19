import { act, fireEvent, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualFrames } from '@/test/manualFrames'
import { FOOT_DILEMMAS } from '../content/foot'
import type { AnyDilemma, TrolleyChoice } from '../content/types'
import type { SceneEvent, SceneEventDetail } from '../scene/TrolleyScene'
import type { Frame, MotionSceneHandle } from './scene'
import { SchoolScene } from './SchoolScene'

const EDUCATION = FOOT_DILEMMAS.find((dilemma) => dilemma.id === 'foot-education') as AnyDilemma
const RUN_PULL: readonly SceneEvent[] = ['gavel', 'creak', 'bell', 'cheer', 'impact']

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderScene({ settled = null as TrolleyChoice | null, reducedMotion = false, interactive = true, frame = 'wide' as Frame } = {}) {
  const ref = createRef<MotionSceneHandle>()
  const events: SceneEvent[] = []
  const impacts: (SceneEventDetail | undefined)[] = []
  const onLever = vi.fn()
  const view = render(
    <SchoolScene
      ref={ref}
      frame={frame}
      dilemma={EDUCATION}
      lang="en"
      settled={settled}
      reducedMotion={reducedMotion}
      interactive={interactive}
      onLever={onLever}
      onEvent={(event, detail) => {
        events.push(event)
        if (event === 'impact') impacts.push(detail)
      }}
    />,
  )
  const root = view.container.querySelector('.atp-m-scene') as SVGGElement
  const part = (name: string) => view.container.querySelector(`[data-part="${name}"]`)
  const all = (name: string, attribute: string) => Array.from(view.container.querySelectorAll(`[data-part="${name}"]`), (node) => node.getAttribute(attribute))
  return { ...view, ref, events, impacts, onLever, root, part, all }
}

const count = (events: readonly SceneEvent[], event: SceneEvent): number => events.filter((seen) => seen === event).length
const dimmed = (container: HTMLElement, selector = ''): number => container.querySelectorAll(`${selector} [data-part="body"][opacity="0.5"]`.trim()).length
const settle = () =>
  act(async () => {
    await Promise.resolve()
  })

describe('the school, in motion', () => {
  it('brings the students up to the locked gate, then waits', async () => {
    const frames = manualFrames()
    const { root, events, part, all } = renderScene()
    expect(root.dataset.state).toBe('arriving')

    await frames.run(2000)

    expect(root.dataset.state).toBe('waiting')
    expect(events).toEqual([])
    expect(part('labels')?.getAttribute('opacity')).toBe('1')
    expect(all('student', 'transform')).toEqual(['translate(168 466)', 'translate(214 466)', 'translate(386 466)', 'translate(432 466)', 'translate(478 466)'])
    expect(part('lock')?.getAttribute('opacity')).toBeNull()
  })

  it('passes the reform: sealed, the gate opens, the school fills, and the statistics take one unknown life', async () => {
    const frames = manualFrames()
    const { root, ref, events, impacts, part, all, container } = renderScene()
    await frames.run(2000)

    await act(() => frames.until(ref.current?.play('pull') as Promise<void>))

    expect(events).toEqual(RUN_PULL)
    // One life on the counter, as many as the reform costs, and quietly.
    expect(count(events, 'impact')).toBe(EDUCATION.trackB.length)
    expect(impacts).toEqual([{ kind: 'person', how: 'flatline' }])
    expect(root.dataset.state).toBe('done')
    expect(part('signature')?.getAttribute('stroke-dashoffset')).toBe('0')
    expect(part('seal')?.getAttribute('opacity')).toBe('1')
    expect(part('lock')?.getAttribute('opacity')).toBe('0')
    expect(all('gate', 'transform')).toEqual(['scale(0.15 1)', 'scale(0.15 1)'])
    expect(all('window-light', 'opacity').every((opacity) => opacity === '1')).toBe(true)
    expect(all('window-light', 'opacity')).toHaveLength(10)
    expect(part('pupils')?.getAttribute('opacity')).toBe('1')
    expect(all('student', 'opacity')).toEqual(['0', '0', '0', '0', '0'])
    // The chart's last point has crept up, and the one it foresaw is lost.
    expect(part('chart-dot')?.getAttribute('cy')).toBe('-136')
    expect(dimmed(container, '[data-part="unknown"]')).toBe(1)
    expect(dimmed(container)).toBe(1)
    expect(part('stamp')?.getAttribute('opacity')).toBe('0')
  })

  it('shelves it: the stamp comes down, the school stays dark, the students drift off, and nobody is lost', async () => {
    const frames = manualFrames()
    const { root, ref, events, part, all, container } = renderScene()
    await frames.run(2000)

    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))

    expect(events).toEqual(['gavel'])
    expect(count(events, 'impact')).toBe(EDUCATION.trackA.length)
    expect(root.dataset.state).toBe('done')
    expect(part('stamp')?.getAttribute('opacity')).toBe('1')
    expect(part('seal')?.getAttribute('opacity')).toBe('0')
    expect(part('lock')?.getAttribute('opacity')).toBeNull()
    expect(all('gate', 'transform')).toEqual([null, null])
    expect(all('window-light', 'opacity').every((opacity) => opacity === '0')).toBe(true)
    expect(all('student', 'opacity')).toEqual(['0', '0', '0', '0', '0'])
    expect(part('chart-dot')?.getAttribute('cy')).toBe('-125')
    expect(dimmed(container)).toBe(0)
    // The one the statistics foresaw is still there, the question over them settled.
    expect(container.querySelector('[data-part="unknown"] [data-part="marker"]')?.getAttribute('opacity')).toBe('0')
  })

  it('plays the whole run at once for reduced motion', async () => {
    const { ref, events, root } = renderScene({ reducedMotion: true })
    // The arrival is over as soon as its promises settle.
    await settle()
    expect(root.dataset.state).toBe('waiting')
    await act(() => ref.current?.play('pull') as Promise<void>)
    expect(events).toEqual(RUN_PULL)
    expect(root.dataset.state).toBe('done')
  })

  it('opens either choice on its aftermath, without a sound', () => {
    const passed = renderScene({ settled: 'pull' })
    expect(passed.root.dataset.state).toBe('done')
    expect(passed.events).toEqual([])
    expect(passed.all('gate', 'transform')).toEqual(['scale(0.15 1)', 'scale(0.15 1)'])
    expect(passed.all('window-light', 'opacity').every((opacity) => opacity === '1')).toBe(true)
    expect(passed.part('seal')?.getAttribute('opacity')).toBe('1')
    expect(passed.part('chart-dot')?.getAttribute('cy')).toBe('-136')
    expect(passed.all('student', 'opacity')).toEqual(['0', '0', '0', '0', '0'])
    expect(dimmed(passed.container, '[data-part="unknown"]')).toBe(1)
    passed.unmount()

    const shelved = renderScene({ settled: 'stay' })
    expect(shelved.root.dataset.state).toBe('done')
    expect(shelved.events).toEqual([])
    expect(shelved.part('stamp')?.getAttribute('opacity')).toBe('1')
    expect(shelved.part('stamp')?.getAttribute('transform')).toBe('translate(652 396) rotate(-12) scale(0.5)')
    expect(shelved.all('window-light', 'opacity').every((opacity) => opacity === '0')).toBe(true)
    expect(shelved.all('gate', 'transform')).toEqual([null, null])
    expect(shelved.all('student', 'opacity')).toEqual(['0', '0', '0', '0', '0'])
    expect(dimmed(shelved.container)).toBe(0)
  })

  it('takes a click on the reform only while it waits', () => {
    manualFrames()
    const live = renderScene()
    fireEvent.click(live.container.querySelector('.atp-m-hotspot') as Element)
    expect(live.onLever).toHaveBeenCalledWith('pull')
    live.unmount()

    const idle = renderScene({ interactive: false })
    fireEvent.click(idle.container.querySelector('.atp-m-hotspot') as Element)
    expect(idle.onLever).not.toHaveBeenCalled()
  })

  it('lays itself out for a phone held upright, and plays it either way', async () => {
    const viewBox = (container: HTMLElement): number[] => (container.querySelector('svg')?.getAttribute('viewBox') ?? '').split(' ').map(Number)
    const wide = renderScene({ reducedMotion: true })
    const [, , wideW = 0, wideH = 1] = viewBox(wide.container)
    wide.unmount()

    const pulled = renderScene({ frame: 'tall', reducedMotion: true })
    const [, , tallW = 0, tallH = 1] = viewBox(pulled.container)
    // Narrower than the wide frame, and nearly as tall as it is wide.
    expect(tallW).toBeLessThan(wideW)
    expect(tallW / tallH).toBeLessThan(wideW / wideH)
    await settle()
    await act(() => pulled.ref.current?.play('pull') as Promise<void>)
    expect(count(pulled.events, 'impact')).toBe(EDUCATION.trackB.length)
    expect(pulled.root.dataset.state).toBe('done')
    pulled.unmount()

    const stayed = renderScene({ frame: 'tall', reducedMotion: true })
    await settle()
    await act(() => stayed.ref.current?.play('stay') as Promise<void>)
    expect(count(stayed.events, 'impact')).toBe(EDUCATION.trackA.length)
    stayed.unmount()

    const settled = renderScene({ frame: 'tall', settled: 'pull' })
    expect(settled.root.dataset.state).toBe('done')
  })

  it('goes quiet when it is taken off the stage mid-run', async () => {
    const frames = manualFrames()
    const { ref, events, unmount } = renderScene()
    await frames.run(2000)
    const run = ref.current?.play('pull') as Promise<void>
    await frames.run(1500)
    // Sealed and opening, but nobody is lost yet.
    expect(events).toEqual(['gavel', 'creak'])
    unmount()
    await run
    expect(events).toEqual(['gavel', 'creak'])
  })

  it('says what it shows', () => {
    const { container } = renderScene()
    expect(container.querySelector('svg')).toHaveAccessibleName(/school/)
    expect(container.querySelector('.atp-m-school-title')).toHaveTextContent('STATISTICS')
  })
})
