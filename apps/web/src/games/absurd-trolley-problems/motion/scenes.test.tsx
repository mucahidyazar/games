import { act, fireEvent, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualFrames } from '@/test/manualFrames'
import { FOOT_DILEMMAS } from '../content/foot'
import type { AnyDilemma, TrolleyChoice } from '../content/types'
import type { SceneEvent } from '../scene/TrolleyScene'
import type { StageHandle } from '../components/Stage'
import { CaveScene } from './CaveScene'
import { DriverScene } from './DriverScene'
import { DungeonScene } from './DungeonScene'
import { HomeScene } from './HomeScene'
import { JudgeScene } from './JudgeScene'
import { MotionStage } from './MotionStage'
import { PilotScene } from './PilotScene'
import { SchoolScene } from './SchoolScene'
import { SeaScene } from './SeaScene'
import { ShopScene } from './ShopScene'
import { TheatreScene } from './TheatreScene'
import type { Frame, MotionSceneHandle } from './scene'
import { WardScene } from './WardScene'

const CASES = Object.fromEntries(FOOT_DILEMMAS.map((dilemma) => [dilemma.id, dilemma])) as Record<string, AnyDilemma>
const DRIVER_CASE = CASES['foot-driver'] as AnyDilemma
const JUDGE_CASE = CASES['foot-judge'] as AnyDilemma
const caseOf = (id: string): AnyDilemma => CASES[id] as AnyDilemma

afterEach(() => {
  vi.unstubAllGlobals()
})

type SceneComponent = typeof DriverScene

function renderScene(Scene: SceneComponent, dilemma: AnyDilemma, { settled = null as TrolleyChoice | null, reducedMotion = false, interactive = true, frame = 'wide' as Frame } = {}) {
  const ref = createRef<MotionSceneHandle>()
  const events: SceneEvent[] = []
  const onLever = vi.fn()
  const view = render(
    <Scene ref={ref} frame={frame} dilemma={dilemma} lang="en" settled={settled} reducedMotion={reducedMotion} interactive={interactive} onLever={onLever} onEvent={(event) => events.push(event)} />,
  )
  const root = view.container.querySelector('.atp-m-scene') as SVGGElement
  const part = (name: string) => view.container.querySelector(`[data-part="${name}"]`)
  return { ...view, ref, events, onLever, root, part }
}

const count = (events: readonly SceneEvent[], event: SceneEvent): number => events.filter((seen) => seen === event).length
const bodyOf = (figure: Element | null | undefined) => figure?.querySelector('[data-part="body"]')

describe('the driver, in motion', () => {
  it('races in and stops time short of the fork', async () => {
    const frames = manualFrames()
    const { root, events, part } = renderScene(DriverScene, DRIVER_CASE)
    expect(root.dataset.state).toBe('arriving')

    await frames.run(2600)

    expect(root.dataset.state).toBe('waiting')
    expect(events).toEqual(['arrive', 'bell', 'brake'])
    expect(part('labels')?.getAttribute('opacity')).toBe('1')
    expect(part('sign')?.getAttribute('opacity')).toBe('1')
  })

  it('steers onto the branch: the one is hit, the five cheer', async () => {
    const frames = manualFrames()
    const { root, ref, events, part, container } = renderScene(DriverScene, DRIVER_CASE)
    await frames.run(2600)

    await act(() => frames.until(ref.current?.play('pull') as Promise<void>))

    expect(events).toEqual(['arrive', 'bell', 'brake', 'lever', 'depart', 'impact', 'stop', 'cheer'])
    expect(root.dataset.state).toBe('done')
    expect(part('blade')?.getAttribute('transform')).toContain('rotate(14)')
    expect(part('glow-pull')?.getAttribute('stroke-dashoffset')).toBe('0')
    const one = container.querySelector('[data-track="pull"]')
    expect(bodyOf(one)?.getAttribute('opacity')).toBe('0.5')
    expect(container.querySelectorAll('[data-track="stay"] [data-part="body"][opacity]')).toHaveLength(0)
  })

  it('keeps straight on: all five are hit', async () => {
    const frames = manualFrames()
    const { ref, events, container } = renderScene(DriverScene, DRIVER_CASE)
    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))

    expect(count(events, 'impact')).toBe(5)
    expect(events).not.toContain('lever')
    // Chosen while the tram was still coming in: no stop in time, no bell.
    expect(events).not.toContain('brake')
    expect(container.querySelectorAll('[data-track="stay"] [data-part="body"][opacity="0.5"]')).toHaveLength(5)
  })

  it('plays the whole run at once for reduced motion', async () => {
    const { ref, events } = renderScene(DriverScene, DRIVER_CASE, { reducedMotion: true })
    // The arrival is over as soon as its promises settle.
    await act(async () => {
      await Promise.resolve()
    })
    await act(() => ref.current?.play('pull') as Promise<void>)
    expect(events).toEqual(['arrive', 'bell', 'brake', 'lever', 'depart', 'impact', 'stop', 'cheer'])
  })

  it('opens a decided dilemma on its aftermath', () => {
    const { root, part, container, events } = renderScene(DriverScene, DRIVER_CASE, { settled: 'pull' })
    expect(root.dataset.state).toBe('done')
    expect(events).toEqual([])
    expect(part('tram')?.getAttribute('opacity')).toBe('0')
    expect(part('lamp')?.getAttribute('transform')).toContain('rotate(45)')
    expect(bodyOf(container.querySelector('[data-track="pull"]'))?.getAttribute('opacity')).toBe('0.5')
  })

  it('takes a click on the switch only while it waits', () => {
    manualFrames()
    const live = renderScene(DriverScene, DRIVER_CASE)
    fireEvent.click(live.container.querySelector('.atp-m-hotspot') as Element)
    expect(live.onLever).toHaveBeenCalledWith('pull')
    live.unmount()

    const idle = renderScene(DriverScene, DRIVER_CASE, { interactive: false })
    fireEvent.click(idle.container.querySelector('.atp-m-hotspot') as Element)
    expect(idle.onLever).not.toHaveBeenCalled()
  })

  it('goes quiet when it is taken off the stage mid-run', async () => {
    const frames = manualFrames()
    const { ref, events, unmount } = renderScene(DriverScene, DRIVER_CASE)
    const run = ref.current?.play('stay') as Promise<void>
    frames.step(16)
    const before = events.length
    unmount()
    await run
    expect(events).toHaveLength(before)
  })
})

describe('the judge, in motion', () => {
  it('brings the crowd and the innocent man in, then waits', async () => {
    const frames = manualFrames()
    const { root, events, part } = renderScene(JudgeScene, JUDGE_CASE)
    await frames.run(1800)
    expect(root.dataset.state).toBe('waiting')
    expect(events).toEqual(['roar'])
    expect(part('mob')?.getAttribute('transform')).toBe('translate(0 0)')
  })

  it('frames him: gavel, stamp, cell; the crowd lets the hostages go', async () => {
    const frames = manualFrames()
    const { root, ref, events, part, container } = renderScene(JudgeScene, JUDGE_CASE)
    await frames.run(1800)

    await act(() => frames.until(ref.current?.play('pull') as Promise<void>))

    expect(events).toEqual(['roar', 'gavel', 'impact', 'cheer'])
    expect(root.dataset.mood).toBe('satisfied')
    expect(part('stamp-pull')?.getAttribute('opacity')).toBe('1')
    expect(part('bars')?.getAttribute('transform')).toBe('translate(0 0)')
    expect(part('mob')?.getAttribute('transform')).toBe('translate(-640 0)')
    expect(bodyOf(container.querySelector('[data-role="innocent"]'))?.getAttribute('opacity')).toBe('0.5')
  })

  it('refuses: the man walks free, and the crowd turns on the hostages', async () => {
    const frames = manualFrames()
    const { root, ref, events, part, container } = renderScene(JudgeScene, JUDGE_CASE)
    await frames.run(1800)

    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))

    expect(events.slice(0, 3)).toEqual(['roar', 'cheer', 'roar'])
    expect(count(events, 'impact')).toBe(5)
    expect(root.dataset.mood).toBe('furious')
    expect(part('stamp-stay')?.getAttribute('opacity')).toBe('1')
    expect(container.querySelectorAll('[data-part="hostage"] [data-part="body"][opacity="0.5"]')).toHaveLength(5)
  })

  it('opens either verdict on its aftermath', () => {
    const framed = renderScene(JudgeScene, JUDGE_CASE, { settled: 'pull' })
    expect(framed.part('red-light')?.getAttribute('opacity')).toBe('1')
    expect(framed.part('mob')?.getAttribute('transform')).toBe('translate(-640 0)')
    framed.unmount()

    const refused = renderScene(JudgeScene, JUDGE_CASE, { settled: 'stay' })
    expect(refused.root.dataset.mood).toBe('furious')
    expect(refused.part('gavel')?.getAttribute('transform')).toContain('rotate(18)')
    expect(refused.container.querySelectorAll('[data-part="hostage"] [data-part="body"][opacity="0.5"]')).toHaveLength(5)
  })

  it('brings the gavel down when it is clicked', () => {
    manualFrames()
    const { container, onLever } = renderScene(JudgeScene, JUDGE_CASE)
    fireEvent.click(container.querySelector('.atp-m-hotspot') as Element)
    expect(onLever).toHaveBeenCalledWith('pull')
  })
})

const dimmed = (container: HTMLElement, selector: string): number => container.querySelectorAll(`${selector} [data-part="body"][opacity="0.5"]`).length

describe('the pilot, in motion', () => {
  it('flies in and stops time over the town', async () => {
    const frames = manualFrames()
    const { root, events, part } = renderScene(PilotScene, caseOf('foot-pilot'))
    await frames.run(2400)
    expect(root.dataset.state).toBe('waiting')
    expect(events).toEqual(['arrive', 'brake'])
    expect(part('sign')?.getAttribute('opacity')).toBe('1')
  })

  it('steers for the field: the farmer is lost, the town cheers, the pilot bails out', async () => {
    const frames = manualFrames()
    const { ref, events, part, container } = renderScene(PilotScene, caseOf('foot-pilot'))
    await frames.run(2400)
    await act(() => frames.until(ref.current?.play('pull') as Promise<void>))
    expect(events).toEqual(['arrive', 'brake', 'push', 'lever', 'depart', 'stop', 'boom', 'impact', 'cheer'])
    expect(part('plane')?.getAttribute('opacity')).toBe('0')
    expect(part('chute')?.getAttribute('opacity')).toBe('1')
    expect(dimmed(container, '[data-part="farmer"]')).toBe(1)
    expect(part('fire')?.getAttribute('opacity')).toBe('0')
  })

  it('holds course over the town: five are lost and the houses burn', async () => {
    const frames = manualFrames()
    const { ref, events, part, container } = renderScene(PilotScene, caseOf('foot-pilot'))
    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))
    expect(count(events, 'impact')).toBe(5)
    expect(dimmed(container, '[data-part="townsperson"]')).toBe(5)
    expect(part('fire')?.getAttribute('opacity')).toBe('1')
  })

  it('opens either crash on its aftermath', () => {
    const town = renderScene(PilotScene, caseOf('foot-pilot'), { settled: 'stay' })
    expect(town.part('fire')?.getAttribute('opacity')).toBe('1')
    expect(dimmed(town.container, '[data-part="townsperson"]')).toBe(5)
    town.unmount()
    const field = renderScene(PilotScene, caseOf('foot-pilot'), { settled: 'pull' })
    expect(dimmed(field.container, '[data-part="farmer"]')).toBe(1)
    expect(field.part('chute')?.getAttribute('opacity')).toBe('1')
  })
})

describe('the doctor, in motion', () => {
  const ecg = (container: HTMLElement) => Array.from(container.querySelectorAll('[data-part="ecg"]'), (line) => line.getAttribute('class')?.replace('atp-m-ecg is-', ''))

  it('shares the drug among the five, or gives it all to the one', async () => {
    const frames = manualFrames()
    const shared = renderScene(WardScene, caseOf('foot-drug'))
    await frames.run(1000)
    expect(shared.root.dataset.state).toBe('waiting')
    await act(() => frames.until(shared.ref.current?.play('pull') as Promise<void>))
    expect(ecg(shared.container)).toEqual(['flat', 'well', 'well', 'well', 'well', 'well'])
    expect(count(shared.events, 'heal')).toBe(5)
    expect(count(shared.events, 'impact')).toBe(1)
    shared.unmount()

    const one = renderScene(WardScene, caseOf('foot-drug'))
    await act(() => frames.until(one.ref.current?.play('stay') as Promise<void>))
    expect(ecg(one.container)).toEqual(['well', 'flat', 'flat', 'flat', 'flat', 'flat'])
    expect(count(one.events, 'impact')).toBe(5)
  })

  it('makes the serum from a healthy man, or sends him home', async () => {
    const frames = manualFrames()
    const made = renderScene(WardScene, caseOf('foot-serum'))
    await act(() => frames.until(made.ref.current?.play('pull') as Promise<void>))
    expect(ecg(made.container)).toEqual(['well', 'well', 'well', 'well', 'well'])
    expect(dimmed(made.container, '[data-part="single"]')).toBe(1)
    expect(made.part('vial-fill')?.getAttribute('transform')).toBe('translate(0 0) scale(1 1)')
    made.unmount()

    const refused = renderScene(WardScene, caseOf('foot-serum'))
    await act(() => frames.until(refused.ref.current?.play('stay') as Promise<void>))
    expect(ecg(refused.container)).toEqual(['flat', 'flat', 'flat', 'flat', 'flat'])
    expect(refused.part('single')?.getAttribute('transform')).toBe('translate(-120 404)')
  })

  it('makes the gas, whose fumes reach next door, or does not', async () => {
    const frames = manualFrames()
    const made = renderScene(WardScene, caseOf('foot-gas'))
    await act(() => frames.until(made.ref.current?.play('pull') as Promise<void>))
    expect(made.events).toContain('lever')
    expect(made.part('gas')?.getAttribute('opacity')).toBe('1')
    expect(made.part('fumes')?.getAttribute('opacity')).toBe('1')
    expect(ecg(made.container)).toEqual(['flat', 'well', 'well', 'well', 'well', 'well'])
    made.unmount()

    const refused = renderScene(WardScene, caseOf('foot-gas'))
    await act(() => frames.until(refused.ref.current?.play('stay') as Promise<void>))
    expect(ecg(refused.container)).toEqual(['weak', 'flat', 'flat', 'flat', 'flat', 'flat'])
  })

  it('turns the whole ward to the five crash victims, or stays with the one', async () => {
    const frames = manualFrames()
    const turned = renderScene(WardScene, caseOf('foot-crash'))
    await frames.run(1000)
    expect(turned.root.dataset.state).toBe('waiting')
    expect(turned.container.querySelectorAll('[data-part="bandage"]')).toHaveLength(5)
    await act(() => frames.until(turned.ref.current?.play('pull') as Promise<void>))
    expect(ecg(turned.container)).toEqual(['flat', 'well', 'well', 'well', 'well', 'well'])
    expect(count(turned.events, 'impact')).toBe(1)
    turned.unmount()

    const stayed = renderScene(WardScene, caseOf('foot-crash'))
    await act(() => frames.until(stayed.ref.current?.play('stay') as Promise<void>))
    expect(ecg(stayed.container)).toEqual(['well', 'flat', 'flat', 'flat', 'flat', 'flat'])
    expect(count(stayed.events, 'impact')).toBe(5)
    expect(Array.from(stayed.container.querySelectorAll('[data-part="bandage"]'), (bandage) => bandage.getAttribute('opacity'))).toEqual(['0.5', '0.5', '0.5', '0.5', '0.5'])
  })

  it('turns the beggar away for his body, or feeds him and loses the five', async () => {
    const frames = manualFrames()
    const turned = renderScene(WardScene, caseOf('foot-beggar'))
    await act(() => frames.until(turned.ref.current?.play('pull') as Promise<void>))
    expect(turned.events.filter((event) => event !== 'bell').slice(0, 2)).toEqual(['impact', 'push'])
    expect(count(turned.events, 'heal')).toBe(5)
    expect(dimmed(turned.container, '[data-part="single"]')).toBe(1)
    expect(turned.part('item')?.getAttribute('opacity')).toBe('0')
    expect(turned.part('vial')?.getAttribute('opacity')).toBe('1')
    expect(turned.part('vial-fill')?.getAttribute('transform')).toBe('translate(0 0) scale(1 1)')
    expect(ecg(turned.container)).toEqual(['well', 'well', 'well', 'well', 'well'])
    turned.unmount()

    const fed = renderScene(WardScene, caseOf('foot-beggar'))
    await act(() => frames.until(fed.ref.current?.play('stay') as Promise<void>))
    expect(fed.events.filter((event) => event !== 'bell').slice(0, 2)).toEqual(['push', 'heal'])
    expect(count(fed.events, 'impact')).toBe(5)
    expect(dimmed(fed.container, '[data-part="single"]')).toBe(0)
    expect(fed.part('single')?.getAttribute('transform')).toBe('translate(-120 404)')
    expect(ecg(fed.container)).toEqual(['flat', 'flat', 'flat', 'flat', 'flat'])
  })

  it('opens every variant on its aftermath', () => {
    for (const [id, choice, lines] of [
      ['foot-drug', 'pull', ['flat', 'well', 'well', 'well', 'well', 'well']],
      ['foot-drug', 'stay', ['well', 'flat', 'flat', 'flat', 'flat', 'flat']],
      ['foot-crash', 'pull', ['flat', 'well', 'well', 'well', 'well', 'well']],
      ['foot-crash', 'stay', ['well', 'flat', 'flat', 'flat', 'flat', 'flat']],
      ['foot-serum', 'pull', ['well', 'well', 'well', 'well', 'well']],
      ['foot-serum', 'stay', ['flat', 'flat', 'flat', 'flat', 'flat']],
      ['foot-beggar', 'pull', ['well', 'well', 'well', 'well', 'well']],
      ['foot-beggar', 'stay', ['flat', 'flat', 'flat', 'flat', 'flat']],
      ['foot-gas', 'pull', ['flat', 'well', 'well', 'well', 'well', 'well']],
      ['foot-gas', 'stay', ['well', 'flat', 'flat', 'flat', 'flat', 'flat']],
    ] as const) {
      const view = renderScene(WardScene, caseOf(id), { settled: choice })
      expect(ecg(view.container)).toEqual(lines)
      view.unmount()
    }
  })

  it('takes a click on what the doctor holds', () => {
    manualFrames()
    const { container, onLever } = renderScene(WardScene, caseOf('foot-gas'))
    fireEvent.click(container.querySelector('.atp-m-hotspot') as Element)
    expect(onLever).toHaveBeenCalledWith('pull')
  })
})

describe('the dungeon, in motion', () => {
  it('opens one cell: the five go free, the one is left to the torturers', async () => {
    const frames = manualFrames()
    const { root, ref, events, part, container } = renderScene(DungeonScene, caseOf('foot-rescue'))
    await frames.run(800)
    expect(root.dataset.state).toBe('waiting')
    await act(() => frames.until(ref.current?.play('pull') as Promise<void>))
    expect(events).toEqual(['creak', 'creak', 'cheer', 'zap', 'impact'])
    expect(part('door-left')?.getAttribute('transform')).toBe('scale(0.15 1)')
    expect(container.querySelectorAll('[data-part="right-prisoner"] [data-part="body"][opacity="0.55"]')).toHaveLength(1)
  })

  it('does as the tyrant says, or refuses and he does it himself', async () => {
    const frames = manualFrames()
    const comply = renderScene(DungeonScene, caseOf('foot-tyrant'))
    await act(() => frames.until(comply.ref.current?.play('pull') as Promise<void>))
    expect(comply.events).toEqual(['creak', 'lever', 'zap', 'impact'])
    expect(comply.part('handle')?.getAttribute('transform')).toBe('rotate(35)')
    comply.unmount()

    const refuse = renderScene(DungeonScene, caseOf('foot-tyrant'))
    await act(() => frames.until(refuse.ref.current?.play('stay') as Promise<void>))
    expect(refuse.events).toEqual(['creak', 'roar', 'zap', 'impact', 'impact', 'impact', 'impact', 'impact'])
    expect(refuse.container.querySelectorAll('[data-part="left-prisoner"] [data-part="body"][opacity="0.55"]')).toHaveLength(5)
  })

  it('makes the killer’s choice deadly', async () => {
    const frames = manualFrames()
    const refuse = renderScene(DungeonScene, caseOf('foot-madman'))
    await act(() => frames.until(refuse.ref.current?.play('stay') as Promise<void>))
    expect(count(refuse.events, 'impact')).toBe(2)
    expect(dimmed(refuse.container, '[data-part="left-prisoner"]')).toBe(2)
  })

  it('opens each variant on its aftermath', () => {
    const rescued = renderScene(DungeonScene, caseOf('foot-rescue'), { settled: 'stay' })
    expect(rescued.part('door-right')?.getAttribute('transform')).toBe('scale(0.15 1)')
    rescued.unmount()
    const complied = renderScene(DungeonScene, caseOf('foot-tyrant'), { settled: 'pull' })
    expect(complied.part('handle')?.getAttribute('transform')).toBe('rotate(35)')
    complied.unmount()
    const killed = renderScene(DungeonScene, caseOf('foot-madman'), { settled: 'pull' })
    expect(dimmed(killed.container, '[data-part="right-prisoner"]')).toBe(1)
  })

  it('takes a click on the lever, or the key', () => {
    manualFrames()
    const { container, onLever } = renderScene(DungeonScene, caseOf('foot-rescue'))
    fireEvent.click(container.querySelector('.atp-m-hotspot') as Element)
    expect(onLever).toHaveBeenCalledWith('pull')
  })
})

describe('the cave, in motion', () => {
  it('blasts the way open: the stuck man is lost, everyone else climbs out', async () => {
    const frames = manualFrames()
    const { root, ref, events, part, container } = renderScene(CaveScene, caseOf('foot-cave'))
    await frames.run(1400)
    expect(root.dataset.state).toBe('waiting')
    await act(() => frames.until(ref.current?.play('pull') as Promise<void>))
    expect(events).toEqual(['splash', 'zap', 'boom', 'impact', 'cheer'])
    expect(part('wide')?.getAttribute('opacity')).toBe('1')
    expect(dimmed(container, '[data-part="stuck"]')).toBe(1)
    expect(Array.from(container.querySelectorAll('[data-part="caver"]'), (caver) => caver.getAttribute('opacity'))).toEqual(['0', '0', '0', '0', '0'])
  })

  it('waits: the tide rises over the five', async () => {
    const frames = manualFrames()
    const { ref, events, part, container } = renderScene(CaveScene, caseOf('foot-cave'))
    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))
    expect(count(events, 'impact')).toBe(5)
    expect(part('water')?.getAttribute('transform')).toBe('translate(0 300)')
    expect(dimmed(container, '[data-part="caver"]')).toBe(5)
  })

  it('opens either choice on its aftermath', () => {
    const blasted = renderScene(CaveScene, caseOf('foot-cave'), { settled: 'pull' })
    expect(blasted.part('held')?.getAttribute('opacity')).toBe('0')
    expect(blasted.part('water')?.getAttribute('transform')).toBe('translate(0 372)')
    blasted.unmount()
    const waited = renderScene(CaveScene, caseOf('foot-cave'), { settled: 'stay' })
    expect(dimmed(waited.container, '[data-part="caver"]')).toBe(5)
  })

  it('takes a click on the dynamite', () => {
    manualFrames()
    const { container, onLever } = renderScene(CaveScene, caseOf('foot-cave'))
    fireEvent.click(container.querySelector('.atp-m-hotspot') as Element)
    expect(onLever).toHaveBeenCalledWith('pull')
  })

  it('with his head inside, lays him down the tunnel, and waiting drowns him too', async () => {
    const frames = manualFrames()
    const waited = renderScene(CaveScene, caseOf('foot-cave-inside'))
    expect(waited.part('stuck')?.getAttribute('transform')).toContain('rotate(242)')
    await act(() => frames.until(waited.ref.current?.play('stay') as Promise<void>))
    expect(count(waited.events, 'impact')).toBe(6)
    expect(waited.part('water')?.getAttribute('transform')).toBe('translate(0 192)')
    expect(dimmed(waited.container, '[data-part="caver"]')).toBe(5)
    expect(dimmed(waited.container, '[data-part="stuck"]')).toBe(1)
    waited.unmount()

    const blasted = renderScene(CaveScene, caseOf('foot-cave-inside'))
    await act(() => frames.until(blasted.ref.current?.play('pull') as Promise<void>))
    expect(count(blasted.events, 'impact')).toBe(1)
    expect(dimmed(blasted.container, '[data-part="stuck"]')).toBe(1)
    blasted.unmount()

    const settled = renderScene(CaveScene, caseOf('foot-cave-inside'), { settled: 'stay' })
    expect(settled.part('water')?.getAttribute('transform')).toBe('translate(0 192)')
    expect(dimmed(settled.container, '[data-part="stuck"]')).toBe(1)
    expect(settled.events).toEqual([])
  })
})

describe('the operating theatre, in motion', () => {
  const lines = (container: HTMLElement) => ({
    mother: container.querySelector('[data-part="mother"] [data-part="ecg"]')?.getAttribute('class')?.replace('atp-m-ecg is-', ''),
    baby: container.querySelector('[data-part="fetal"]')?.getAttribute('class')?.replace('atp-m-ecg is-', ''),
  })
  const cot = (container: HTMLElement) => container.querySelector('[data-part="baby"]')?.getAttribute('opacity')
  const soul = (container: HTMLElement) => container.querySelector('[data-part="mother"] [data-part="soul"]')?.getAttribute('opacity')

  it('operates behind the curtain: the mother lives, the baby’s line goes flat, and nobody is counted', async () => {
    const frames = manualFrames()
    const { root, ref, events, part, container } = renderScene(TheatreScene, caseOf('foot-hysterectomy'))
    await frames.run(1000)
    expect(root.dataset.state).toBe('waiting')
    expect(part('labels')?.getAttribute('opacity')).toBe('1')
    expect(lines(container)).toEqual({ mother: 'weak', baby: 'weak' })

    await act(() => frames.until(ref.current?.play('pull') as Promise<void>))
    expect(events).toEqual(['creak'])
    expect(lines(container)).toEqual({ mother: 'well', baby: 'flat' })
    expect(cot(container)).toBe('0')
    // The curtain is gathered back, the surgeon back in place.
    expect(part('curtain')?.getAttribute('transform')).toBe('translate(382 0) scale(0.12 1)')
    expect(part('surgeon')?.getAttribute('transform')).toBe('translate(318 404)')
    expect(dimmed(container, '[data-part="mother"]')).toBe(0)
  })

  it('waits: the clock goes round and both lines go flat, without a soul rising or a victim counted', async () => {
    const frames = manualFrames()
    const { ref, events, part, container } = renderScene(TheatreScene, caseOf('foot-craniotomy'))
    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))
    expect(events).toEqual([])
    expect(lines(container)).toEqual({ mother: 'flat', baby: 'flat' })
    expect(part('hand')?.getAttribute('transform')).toBe('rotate(300)')
    expect(dimmed(container, '[data-part="mother"]')).toBe(1)
    expect(soul(container)).toBe('0')
  })

  it('saves the mother, or the baby, who is laid in the cot', async () => {
    const frames = manualFrames()
    const mother = renderScene(TheatreScene, caseOf('foot-mother-or-child'))
    await act(() => frames.until(mother.ref.current?.play('pull') as Promise<void>))
    expect(lines(mother.container)).toEqual({ mother: 'well', baby: 'flat' })
    expect(cot(mother.container)).toBe('0')
    mother.unmount()

    const baby = renderScene(TheatreScene, caseOf('foot-mother-or-child'))
    await act(() => frames.until(baby.ref.current?.play('stay') as Promise<void>))
    expect(baby.events).toEqual(['creak'])
    expect(lines(baby.container)).toEqual({ mother: 'flat', baby: 'well' })
    expect(cot(baby.container)).toBe('1')
    expect(dimmed(baby.container, '[data-part="mother"]')).toBe(1)
    expect(soul(baby.container)).toBe('0')
  })

  it('in the worst dilemma, does not operate: the mother is lost, then the baby is delivered', async () => {
    const frames = manualFrames()
    const { ref, events, part, container } = renderScene(TheatreScene, caseOf('foot-worst-dilemma'))
    await act(() => frames.until(ref.current?.play('stay') as Promise<void>))
    expect(events).toEqual(['creak'])
    expect(part('hand')?.getAttribute('transform')).toBe('rotate(300)')
    expect(lines(container)).toEqual({ mother: 'flat', baby: 'well' })
    expect(cot(container)).toBe('1')
  })

  it('opens every case on its aftermath, quietly', () => {
    for (const [id, choice, expected, born] of [
      ['foot-hysterectomy', 'pull', { mother: 'well', baby: 'flat' }, '0'],
      ['foot-hysterectomy', 'stay', { mother: 'flat', baby: 'flat' }, '0'],
      ['foot-craniotomy', 'pull', { mother: 'well', baby: 'flat' }, '0'],
      ['foot-mother-or-child', 'stay', { mother: 'flat', baby: 'well' }, '1'],
      ['foot-worst-dilemma', 'pull', { mother: 'well', baby: 'flat' }, '0'],
      ['foot-worst-dilemma', 'stay', { mother: 'flat', baby: 'well' }, '1'],
    ] as const) {
      const view = renderScene(TheatreScene, caseOf(id), { settled: choice })
      expect(view.root.dataset.state).toBe('done')
      expect(view.events).toEqual([])
      expect(lines(view.container)).toEqual(expected)
      expect(cot(view.container)).toBe(born)
      view.unmount()
    }
  })

  it('takes a click on the operating lamp only while it waits', () => {
    manualFrames()
    const live = renderScene(TheatreScene, caseOf('foot-hysterectomy'))
    fireEvent.click(live.container.querySelector('.atp-m-hotspot') as Element)
    expect(live.onLever).toHaveBeenCalledWith('pull')
    live.unmount()
    const idle = renderScene(TheatreScene, caseOf('foot-hysterectomy'), { interactive: false })
    fireEvent.click(idle.container.querySelector('.atp-m-hotspot') as Element)
    expect(idle.onLever).not.toHaveBeenCalled()
  })
})

describe('on a tall stage', () => {
  const SCENES = [
    ['foot-driver', DriverScene],
    ['foot-judge', JudgeScene],
    ['foot-pilot', PilotScene],
    ['foot-drug', WardScene],
    ['foot-crash', WardScene],
    ['foot-serum', WardScene],
    ['foot-beggar', WardScene],
    ['foot-gas', WardScene],
    ['foot-rescue', DungeonScene],
    ['foot-tyrant', DungeonScene],
    ['foot-madman', DungeonScene],
    ['foot-children', HomeScene],
    ['foot-oil', ShopScene],
    ['foot-education', SchoolScene],
    ['foot-cave', CaveScene],
    ['foot-cave-inside', CaveScene],
    ['foot-lifeboat', SeaScene],
    ['foot-hysterectomy', TheatreScene],
    ['foot-craniotomy', TheatreScene],
    ['foot-mother-or-child', TheatreScene],
    ['foot-worst-dilemma', TheatreScene],
  ] as const
  const viewBox = (container: HTMLElement): number[] => (container.querySelector('svg')?.getAttribute('viewBox') ?? '').split(' ').map(Number)
  const settle = () =>
    act(async () => {
      await Promise.resolve()
    })

  it.each(SCENES)('lays %s out for a phone held upright, and plays it either way', async (id, Scene) => {
    const dilemma = caseOf(id)
    const wide = renderScene(Scene, dilemma, { reducedMotion: true })
    const [, , wideW = 0, wideH = 1] = viewBox(wide.container)
    wide.unmount()

    const pulled = renderScene(Scene, dilemma, { frame: 'tall', reducedMotion: true })
    const [, , tallW = 0, tallH = 1] = viewBox(pulled.container)
    // Narrower than the wide frame, and nearly as tall as it is wide.
    expect(tallW).toBeLessThan(wideW)
    expect(tallW / tallH).toBeLessThan(wideW / wideH)
    await settle()
    await act(() => pulled.ref.current?.play('pull') as Promise<void>)
    expect(count(pulled.events, 'impact')).toBe(dilemma.trackB.length)
    expect(pulled.root.dataset.state).toBe('done')
    pulled.unmount()

    const stayed = renderScene(Scene, dilemma, { frame: 'tall', reducedMotion: true })
    await settle()
    await act(() => stayed.ref.current?.play('stay') as Promise<void>)
    expect(count(stayed.events, 'impact')).toBe(dilemma.trackA.length)
    stayed.unmount()

    const settled = renderScene(Scene, dilemma, { frame: 'tall', settled: 'pull' })
    expect(settled.root.dataset.state).toBe('done')
  })
})

describe('MotionStage', () => {
  /** Gives every element the size of a stage held upright on a phone (jsdom lays nothing out). */
  function uprightStage(): () => void {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 340 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 480 })
    return () => {
      // Back to Element's own (zero) sizes.
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
      Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
    }
  }

  it('turns its scene tall on a stage held upright', () => {
    const restore = uprightStage()
    try {
      const { container } = render(<MotionStage trackA={[]} settled={null} lang="en" reducedMotion onEvent={() => undefined} dilemma={DRIVER_CASE} />)
      expect(container.querySelector('.atp-stage')).toHaveAttribute('data-frame', 'tall')
      expect(container.querySelector('svg')).toHaveAttribute('viewBox', '200 80 500 620')
    } finally {
      restore()
    }
  })

  it('stays wide until it knows its size', () => {
    const { container } = render(<MotionStage trackA={[]} settled={null} lang="en" reducedMotion onEvent={() => undefined} dilemma={DRIVER_CASE} />)
    expect(container.querySelector('.atp-stage')).toHaveAttribute('data-frame', 'wide')
  })

  it.each([
    ['foot-pilot', /falling plane/],
    ['foot-drug', /hospital ward/],
    ['foot-crash', /hospital ward/],
    ['foot-serum', /hospital ward/],
    ['foot-beggar', /hospital ward/],
    ['foot-gas', /hospital ward/],
    ['foot-rescue', /dungeon/],
    ['foot-tyrant', /dungeon/],
    ['foot-madman', /dungeon/],
    ['foot-children', /poor home/],
    ['foot-oil', /grocer/],
    ['foot-education', /school/],
    ['foot-cave', /flooding cave/],
    ['foot-cave-inside', /flooding cave/],
    ['foot-lifeboat', /overloaded lifeboat/],
    ['foot-hysterectomy', /operating theatre/],
    ['foot-mother-or-child', /operating theatre/],
    ['foot-worst-dilemma', /operating theatre/],
  ])('draws %s in its own scene', (id, name) => {
    render(<MotionStage trackA={[]} settled={null} lang="en" reducedMotion onEvent={() => undefined} dilemma={caseOf(id)} />)
    expect(document.querySelector('svg.atp-motion')).toHaveAccessibleName(name)
  })

  it('starts a scene over when its choice is taken back', () => {
    const props = { trackA: [], lang: 'en' as const, reducedMotion: true, onEvent: () => undefined, dilemma: DRIVER_CASE }
    const { container, rerender } = render(<MotionStage {...props} settled="pull" />)
    expect(container.querySelector('.atp-m-scene')).toHaveAttribute('data-state', 'done')
    rerender(<MotionStage {...props} settled={null} />)
    expect(container.querySelector('.atp-m-scene')).not.toHaveAttribute('data-state', 'done')
  })

  it('picks the scene for the case, and plays through it', async () => {
    const ref = createRef<StageHandle>()
    const events: SceneEvent[] = []
    const props = { ref, trackA: [], settled: null, lang: 'en' as const, reducedMotion: true, onEvent: (event: SceneEvent) => events.push(event) }
    const { container, rerender } = render(<MotionStage {...props} dilemma={DRIVER_CASE} />)
    expect(container.querySelector('.atp-stage.is-motion')).toHaveAttribute('data-status', 'ready')
    expect(container.querySelector('svg')).toHaveAccessibleName(/the tram/)
    await act(() => ref.current?.play('pull') as Promise<void>)
    expect(events).toContain('impact')

    rerender(<MotionStage {...props} dilemma={JUDGE_CASE} />)
    expect(container.querySelector('svg')).toHaveAccessibleName(/courthouse/)
    rerender(<MotionStage {...props} dilemma={null} />)
    expect(container.querySelector('svg')).toBeNull()
    await expect(ref.current?.play('pull')).resolves.toBeUndefined()
  })
})
