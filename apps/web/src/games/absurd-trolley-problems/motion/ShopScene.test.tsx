import { act, fireEvent, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualFrames } from '@/test/manualFrames'
import { FOOT_DILEMMAS } from '../content/foot'
import type { AnyDilemma, Lang, TrolleyChoice } from '../content/types'
import type { SceneEvent, SceneEventDetail } from '../scene/TrolleyScene'
import type { Frame, MotionSceneHandle } from './scene'
import { ShopScene } from './ShopScene'

const OIL = FOOT_DILEMMAS.find((dilemma) => dilemma.id === 'foot-oil') as AnyDilemma

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderScene({ settled = null as TrolleyChoice | null, reducedMotion = false, interactive = true, frame = 'wide' as Frame, lang = 'en' as Lang } = {}) {
  const ref = createRef<MotionSceneHandle>()
  const events: SceneEvent[] = []
  const details: (SceneEventDetail | undefined)[] = []
  const onLever = vi.fn()
  const view = render(
    <ShopScene
      ref={ref}
      frame={frame}
      dilemma={OIL}
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
  const all = (name: string) => Array.from(view.container.querySelectorAll(`[data-part="${name}"]`))
  return { ...view, ref, events, details, onLever, root, part, all }
}

const count = (events: readonly SceneEvent[], event: SceneEvent): number => events.filter((seen) => seen === event).length
const dimmed = (container: HTMLElement): number => container.querySelectorAll('[data-part="customer"] [data-part="body"][opacity="0.5"]').length
const opacities = (nodes: readonly Element[]): (string | null)[] => nodes.map((node) => node.getAttribute('opacity'))

describe('the poisoned oil, in motion', () => {
  it('opens the shop with the bell, lets the queue shuffle up, then waits', async () => {
    const frames = manualFrames()
    const { root, events, part, all } = renderScene()
    expect(root.dataset.state).toBe('arriving')

    await frames.run(1600)

    expect(root.dataset.state).toBe('waiting')
    expect(events).toEqual(['bell'])
    expect(part('labels')?.getAttribute('opacity')).toBe('1')
    expect(all('customer').map((customer) => customer.getAttribute('transform'))).toEqual([
      'translate(668 464)',
      'translate(724 464)',
      'translate(780 464)',
      'translate(836 464)',
      'translate(892 464)',
    ])
    expect(part('sign-open')?.getAttribute('opacity')).toBeNull()
  })

  it('sells it: a bottle for each of the five, home they go, and one by one they are lost', async () => {
    const frames = manualFrames()
    const { root, ref, events, details, container, part, all } = renderScene()
    await frames.run(1600)

    await act(() => frames.until(ref.current?.play('pull') as Promise<void>))

    expect(events).toEqual(['bell', 'push', 'push', 'push', 'push', 'push', 'impact', 'impact', 'impact', 'impact', 'impact'])
    expect(details.filter((_, index) => events[index] === 'impact')).toEqual(Array.from({ length: 5 }, () => ({ kind: 'person', how: 'flatline' })))
    expect(count(events, 'impact')).toBe(OIL.trackB.length)
    expect(root.dataset.state).toBe('done')
    expect(dimmed(container)).toBe(5)
    // Each took a bottle home, up the steps; every house has gone dark.
    expect(opacities(all('bought'))).toEqual(['1', '1', '1', '1', '1'])
    expect(all('customer')[0]?.getAttribute('transform')).toBe('translate(924 346) scale(0.64)')
    expect(opacities(all('home-light'))).toEqual(['0', '0', '0', '0', '0'])
    // The shop stays open.
    expect(part('sign-closed')?.getAttribute('opacity')).toBe('0')
    expect(part('labels')?.getAttribute('opacity')).toBe('0')
  })

  it('pours it away: over goes the barrel, the oil runs to the drain, nobody is hurt, and the shop shuts', async () => {
    const frames = manualFrames()
    const { root, ref, events, container, part, all } = renderScene()
    await frames.run(1600)

    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))

    expect(events).toEqual(['bell', 'push', 'splash', 'creak'])
    expect(count(events, 'impact')).toBe(OIL.trackA.length)
    expect(root.dataset.state).toBe('done')
    expect(part('barrel')?.getAttribute('transform')).toBe('rotate(-46 154 404)')
    expect(all('pour').map((stream) => stream.getAttribute('stroke-dashoffset'))).toEqual(['0', '0'])
    expect(all('puddle').map((puddle) => puddle.getAttribute('transform'))).toEqual(['scale(1)', 'scale(1)'])
    expect(part('sign-open')?.getAttribute('opacity')).toBe('0')
    expect(part('sign-closed')?.getAttribute('opacity')).toBe('1')
    expect(part('dim')?.getAttribute('opacity')).toBe('0.62')
    // Home, unharmed, indoors with the lights on.
    expect(dimmed(container)).toBe(0)
    expect(container.querySelectorAll('[data-part="body"][opacity]')).toHaveLength(0)
    expect(opacities(all('customer'))).toEqual(['0', '0', '0', '0', '0'])
    expect(opacities(all('home-light'))).toEqual([null, null, null, null, null])
  })

  it('plays the whole run at once for reduced motion', async () => {
    const { ref, events } = renderScene({ reducedMotion: true })
    // The arrival is over as soon as its promises settle.
    await act(async () => {
      await Promise.resolve()
    })
    await act(() => ref.current?.play('pull') as Promise<void>)
    expect(events).toEqual(['bell', 'push', 'push', 'push', 'push', 'push', 'impact', 'impact', 'impact', 'impact', 'impact'])
  })

  it('opens either choice on its aftermath, without a sound', () => {
    const sold = renderScene({ settled: 'pull' })
    expect(sold.root.dataset.state).toBe('done')
    expect(sold.events).toEqual([])
    expect(dimmed(sold.container)).toBe(5)
    expect(opacities(sold.all('home-light'))).toEqual(['0', '0', '0', '0', '0'])
    expect(sold.part('sign-closed')?.getAttribute('opacity')).toBe('0')
    expect(sold.all('customer')[4]?.getAttribute('transform')).toBe('translate(684 346) scale(0.64)')
    sold.unmount()

    const poured = renderScene({ settled: 'stay' })
    expect(poured.root.dataset.state).toBe('done')
    expect(poured.events).toEqual([])
    expect(dimmed(poured.container)).toBe(0)
    expect(poured.part('sign-closed')?.getAttribute('opacity')).toBe('1')
    expect(poured.part('sign-open')?.getAttribute('opacity')).toBe('0')
    expect(poured.part('barrel')?.getAttribute('transform')).toBe('rotate(-46 154 404)')
    expect(poured.part('merchant')?.getAttribute('transform')).toBe('translate(220 404)')
    expect(poured.part('flow')?.getAttribute('opacity')).toBe('1')
    expect(poured.part('dim')?.getAttribute('opacity')).toBe('0.62')
    expect(opacities(poured.all('customer'))).toEqual(['0', '0', '0', '0', '0'])
  })

  it('takes a click on the oil can only while it is live', () => {
    manualFrames()
    const live = renderScene()
    fireEvent.click(live.container.querySelector('.atp-m-hotspot') as Element)
    expect(live.onLever).toHaveBeenCalledWith('pull')
    live.unmount()

    const idle = renderScene({ interactive: false })
    fireEvent.click(idle.container.querySelector('.atp-m-hotspot') as Element)
    expect(idle.onLever).not.toHaveBeenCalled()
  })

  it('says what it shows, and writes the poison, the sign and the choices in Turkish too', () => {
    manualFrames()
    const { container } = renderScene({ lang: 'tr' })
    expect(container.querySelector('svg')).toHaveAccessibleName(/bakkal dükkânı/)
    const text = Array.from(container.querySelectorAll('text'), (node) => node.textContent)
    expect(text).toEqual(expect.arrayContaining(['ZEHİRLİ', 'AÇIK', 'KAPANDI', 'Sat', 'Dök', 'SEN']))
  })

  it('lays the shop out for a phone held upright, and plays it either way', async () => {
    const viewBox = (container: HTMLElement): number[] => (container.querySelector('svg')?.getAttribute('viewBox') ?? '').split(' ').map(Number)
    const settle = () =>
      act(async () => {
        await Promise.resolve()
      })
    const wide = renderScene({ reducedMotion: true })
    const [, , wideW = 0, wideH = 1] = viewBox(wide.container)
    wide.unmount()

    const sold = renderScene({ frame: 'tall', reducedMotion: true })
    const [, , tallW = 0, tallH = 1] = viewBox(sold.container)
    expect(tallW).toBeLessThan(wideW)
    expect(tallW / tallH).toBeLessThan(wideW / wideH)
    await settle()
    await act(() => sold.ref.current?.play('pull') as Promise<void>)
    expect(count(sold.events, 'impact')).toBe(5)
    expect(dimmed(sold.container)).toBe(5)
    expect(sold.root.dataset.state).toBe('done')
    sold.unmount()

    const poured = renderScene({ frame: 'tall', reducedMotion: true })
    await settle()
    await act(() => poured.ref.current?.play('stay') as Promise<void>)
    expect(count(poured.events, 'impact')).toBe(0)
    expect(poured.part('sign-closed')?.getAttribute('opacity')).toBe('1')
    poured.unmount()

    const settled = renderScene({ frame: 'tall', settled: 'pull' })
    expect(settled.root.dataset.state).toBe('done')
    expect(dimmed(settled.container)).toBe(5)
  })

  it('goes quiet when it is taken off the stage mid-run', async () => {
    const frames = manualFrames()
    const { ref, events, unmount } = renderScene()
    await frames.run(1600)
    const run = ref.current?.play('pull') as Promise<void>
    frames.step(16)
    const before = events.length
    unmount()
    await run
    expect(events).toHaveLength(before)
    expect(count(events, 'impact')).toBe(0)
  })
})
