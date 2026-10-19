import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FOOT_UI, UI } from '../content/strings'
import type { TrolleyChoice } from '../content/types'
import { alarm, cheer, fade, knock, knockedPose, lieDown, part, pop, shake } from './acting'
import { easeInQuad, easeOutBack, easeOutCubic, easeOutQuad, round2, setAttr, Timeline, transform } from './animate'
import { Backdrop, Pill, Stars } from './Backdrop'
import { Figure, Tram } from './figures'
import { DRIVER, DRIVER_TALL, depthScale, driverSpots, lerp, railPaths, sleepers, type DriverGeometry, type Point, type Route } from './geometry'
import { emitter, isPerson, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * Philippa Foot's driver, in motion: the tram races in, time stops a few
 * metres short of the fork while you decide, then it runs on down the way
 * you chose.
 */

const GAUGE = 16
const BLADE_PULL = 14

const drawTrack = (route: Route) => ({ bed: route.pathData(), rails: railPaths(route, GAUGE), sleepers: sleepers(route, 22) })
type Drawing = ReturnType<typeof drawTrack>

/** Everything that moves when the stage turns tall: the tracks, the switch, the signs and labels. */
interface Layout {
  readonly viewBox: string
  readonly geometry: DriverGeometry
  readonly tracks: Readonly<Record<'approach' | 'main' | 'side', Drawing>>
  readonly glow: Readonly<Record<TrolleyChoice, number>>
  readonly lamp: Point
  /** The warning sign's place over the tram, from its middle. */
  readonly sign: Point
  readonly labels: Readonly<Record<TrolleyChoice, Point>>
  /** How far the tram throws whoever it hits. */
  readonly throwDistance: number
}

function layout(geometry: DriverGeometry, viewBox: string, sign: Point, labels: Layout['labels'], throwDistance: number): Layout {
  return {
    viewBox,
    geometry,
    tracks: { approach: drawTrack(geometry.tracks.approach), main: drawTrack(geometry.tracks.main), side: drawTrack(geometry.tracks.side) },
    glow: { stay: geometry.tracks.main.length, pull: geometry.tracks.side.length },
    lamp: { x: geometry.fork.x - 40, y: geometry.fork.y + 44 },
    sign,
    labels,
    throwDistance,
  }
}

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: layout(DRIVER, '40 40 920 480', { x: -38, y: -126 }, { stay: { x: 500, y: 262 }, pull: { x: 236, y: 372 } }, 128),
  tall: layout(DRIVER_TALL, '200 80 500 620', { x: -10, y: -152 }, { stay: { x: 540, y: 196 }, pull: { x: 368, y: 500 } }, 30),
}

/** How far off the track the tram throws whoever it hits: toward the viewer from the branch, away on the main line. */
const THROW: Readonly<Record<TrolleyChoice, number>> = { pull: 26, stay: -16 }

const signBase = (L: Layout): string => `translate(${L.sign.x} ${L.sign.y})`
const bladeTransform = (L: Layout, angle: number): string => `translate(${L.geometry.fork.x - 54} ${L.geometry.fork.y}) rotate(${round2(angle)})`
const lampTransform = (L: Layout, angle: number): string => `translate(${L.lamp.x} ${L.lamp.y - 40}) rotate(${round2(angle)})`

/** Where the tram is drawn with its front `front` along a route: upright, leaning a little into curves. */
function tramTransform(L: Layout, route: Route, front: number): string {
  const centre = front - L.geometry.tram.length / 2
  const point = route.at(centre)
  const lean = ((route.angleAt(centre) * 180) / Math.PI) * 0.3
  return transform(point.x, point.y, lean, depthScale(point.y))
}

interface Nodes {
  readonly root: SVGGElement
  readonly camera: SVGGElement | null
  readonly tram: SVGGElement | null
  readonly speed: SVGGElement | null
  readonly sign: SVGGElement | null
  readonly blade: SVGGElement | null
  readonly lamp: SVGGElement | null
  readonly labels: SVGGElement | null
  readonly flash: SVGGElement | null
  readonly vignette: SVGGElement | null
  readonly glow: Readonly<Record<TrolleyChoice, SVGGElement | null>>
  readonly people: Readonly<Record<TrolleyChoice, readonly SVGGElement[]>>
}

function gather(root: SVGGElement): Nodes {
  const track = (choice: TrolleyChoice) => Array.from(root.querySelectorAll<SVGGElement>(`[data-track="${choice}"]`))
  return {
    root,
    camera: part(root, 'camera'),
    tram: part(root, 'tram'),
    speed: part(root, 'speed'),
    sign: part(root, 'sign'),
    blade: part(root, 'blade'),
    lamp: part(root, 'lamp'),
    labels: part(root, 'labels'),
    flash: part(root, 'flash'),
    vignette: part(root, 'vignette'),
    glow: { stay: part(root, 'glow-stay'), pull: part(root, 'glow-pull') },
    people: { stay: track('stay'), pull: track('pull') },
  }
}

async function arrive(n: Nodes, L: Layout, timeline: Timeline, emit: Emit, turn: Turn): Promise<void> {
  const mine = turn.current
  const { geometry } = L
  const route = geometry.routes.stay
  n.root.dataset.state = 'arriving'
  emit('arrive')
  const bell = timeline.wait(650).then(() => {
    if (turn.current === mine) emit('bell')
  })
  await timeline.tween(
    1600,
    (v) => {
      setAttr(n.tram, 'transform', tramTransform(L, route, lerp(geometry.tram.start, geometry.tram.stop, v)))
      setAttr(n.speed, 'opacity', round2(1 - v))
    },
    easeOutCubic,
  )
  await bell
  // Cut short by an early choice, or by the scene going away (React mounts it twice in development).
  if (turn.current !== mine || timeline.finished) return
  // Time stops, a few metres short of the fork, while you decide.
  n.root.dataset.state = 'waiting'
  emit('brake')
  void timeline.tween(420, (v) => setAttr(n.flash, 'opacity', round2(0.38 * (1 - v))), easeOutQuad)
  void fade(timeline, n.vignette, 1, 500)
  void fade(timeline, n.labels, 1, 400)
  await pop(timeline, n.sign, signBase(L), 360)
}

async function run(n: Nodes, L: Layout, timeline: Timeline, choice: TrolleyChoice, emit: Emit, spots: Readonly<Record<TrolleyChoice, readonly number[]>>, turn: Turn): Promise<void> {
  turn.current += 1
  timeline.skip()
  const { geometry } = L
  const route = geometry.routes[choice]
  const other: TrolleyChoice = choice === 'pull' ? 'stay' : 'pull'
  n.root.dataset.state = 'running'
  void fade(timeline, n.labels, 0, 200)
  void fade(timeline, n.sign, 0, 200)
  void fade(timeline, n.vignette, 0, 500)
  if (choice === 'pull') {
    emit('lever')
    void timeline.tween(320, (v) => setAttr(n.lamp, 'transform', lampTransform(L, 45 * v)), easeOutBack)
    await timeline.tween(300, (v) => setAttr(n.blade, 'transform', bladeTransform(L, BLADE_PULL * v)), easeOutBack)
  }
  // The way ahead lights up, and time starts again.
  void timeline.tween(700, (v) => setAttr(n.glow[choice], 'stroke-dashoffset', Math.round(L.glow[choice] * (1 - v))), easeOutCubic)
  void timeline.tween(320, (v) => setAttr(n.flash, 'opacity', round2(0.3 * (1 - v))), easeOutQuad)
  await timeline.wait(240)
  emit('depart')

  const victims = n.people[choice]
  const at = spots[choice]
  const blows: Promise<void>[] = []
  let warned = 0
  let hit = 0
  await timeline.tween(
    2700,
    (v) => {
      const front = lerp(geometry.tram.stop, route.length, v)
      setAttr(n.tram, 'transform', tramTransform(L, route, front))
      setAttr(n.speed, 'opacity', round2(Math.min(1, v * 1.8)))
      for (; warned < at.length && front >= (at[warned] as number) - 240; warned++) {
        const figure = victims[warned]
        if (figure) alarm(timeline, figure)
      }
      for (; hit < at.length && front >= (at[hit] as number) - 10; hit++) {
        const figure = victims[hit]
        if (!figure) continue
        blows.push(knock(timeline, figure, 1, THROW[choice], L.throwDistance))
        emit('impact', { kind: 'person' })
        void shake(timeline, n.camera, 6)
      }
    },
    easeInQuad,
  )
  emit('stop')
  if (n.people[other].length > 0) emit('cheer')
  await Promise.all([...n.people[other].map((figure) => cheer(timeline, figure)), ...blows])
  n.root.dataset.state = 'done'
}

/** How a run left the scene, for a dilemma that is already decided. */
function aftermath(n: Nodes, L: Layout, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  setAttr(n.tram, 'opacity', 0)
  if (choice === 'pull') {
    setAttr(n.blade, 'transform', bladeTransform(L, BLADE_PULL))
    setAttr(n.lamp, 'transform', lampTransform(L, 45))
  }
  setAttr(n.glow[choice], 'stroke-dashoffset', 0)
  for (const figure of n.people[choice]) lieDown(figure, knockedPose(1, THROW[choice], L.throwDistance))
}

function Track({ drawing }: { readonly drawing: Drawing }) {
  return (
    <g className="atp-m-track">
      <path d={drawing.bed} className="atp-m-bed" />
      {drawing.sleepers.map((sleeper) => (
        <rect key={`${sleeper.x},${sleeper.y}`} x="-3.5" y="-15" width="7" height="30" rx="1.5" transform={`translate(${sleeper.x} ${sleeper.y}) rotate(${sleeper.angle})`} className="atp-m-sleeper" />
      ))}
      {drawing.rails.map((rail) => (
        <g key={rail}>
          <path d={rail} className="atp-m-rail-shade" />
          <path d={rail} className="atp-m-rail" />
        </g>
      ))}
    </g>
  )
}

export function DriverScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const { geometry } = L
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, L })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)
  const stay = useMemo(() => dilemma.trackA.filter(isPerson), [dilemma])
  const pull = useMemo(() => dilemma.trackB.filter(isPerson), [dilemma])
  const spots = useMemo(() => ({ stay: driverSpots(geometry, 'stay', stay.length), pull: driverSpots(geometry, 'pull', pull.length) }), [geometry, stay.length, pull.length])

  useEffect(() => {
    latest.current = { onEvent, reducedMotion, L }
    timelineRef.current?.setInstant(reducedMotion)
  })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const timeline = new Timeline(latest.current.reducedMotion)
    timelineRef.current = timeline
    const nodes = gather(root)
    if (opening) aftermath(nodes, latest.current.L, opening)
    else void arrive(nodes, latest.current.L, timeline, emitter(timeline, latest), turn)
    return () => {
      timeline.finish()
      timelineRef.current = null
    }
  }, [opening])

  useImperativeHandle(
    ref,
    () => ({
      play(choice) {
        const root = rootRef.current
        const timeline = timelineRef.current
        if (!root || !timeline) return Promise.resolve()
        return run(gather(root), latest.current.L, timeline, choice, emitter(timeline, latest), spots, turn)
      },
    }),
    [spots],
  )

  const you = FOOT_UI.you[lang]
  const stayWord = dilemma.verbs?.stay?.[lang] ?? UI.stay[lang]
  const pullWord = dilemma.verbs?.pull[lang] ?? UI.pull[lang]

  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.sceneLabel[lang]}>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          <Backdrop id={id} horizon={208} />
          <Stars />
          <Track drawing={L.tracks.approach} />
          <Track drawing={L.tracks.main} />
          <Track drawing={L.tracks.side} />
          <path data-part="glow-stay" d={L.tracks.main.bed} className="atp-m-glow" strokeDasharray={L.glow.stay} strokeDashoffset={L.glow.stay} />
          <path data-part="glow-pull" d={L.tracks.side.bed} className="atp-m-glow" strokeDasharray={L.glow.pull} strokeDashoffset={L.glow.pull} />

          {/* The switch: the moving rail at the fork, and the stand whose lamp shows the way it is set. */}
          <g data-part="blade" transform={bladeTransform(L, 0)}>
            <rect x="0" y="-3.5" width="60" height="7" rx="3.5" className="atp-m-blade" />
            <circle cx="0" cy="0" r="4.5" className="atp-m-pivot" />
          </g>
          <g className="atp-m-stand">
            <rect x={L.lamp.x - 3} y={L.lamp.y - 36} width="6" height="36" rx="2" fill="#2a3550" />
            <ellipse cx={L.lamp.x} cy={L.lamp.y} rx="10" ry="3" className="atp-m-shadow" />
          </g>
          <g data-part="lamp" transform={lampTransform(L, 0)}>
            <circle r="10" className="atp-m-lamp" />
            <rect x="-6.5" y="-2" width="13" height="4" rx="2" fill="#fff8e8" />
          </g>
          <circle className="atp-m-hint" cx={geometry.fork.x - 20} cy={geometry.fork.y} r="34" />

          <g data-part="labels" opacity="0">
            <Pill x={L.labels.stay.x} y={L.labels.stay.y} text={`${stayWord} →`} tone="stay" />
            <Pill x={L.labels.pull.x} y={L.labels.pull.y} text={`↘ ${pullWord}`} tone="pull" />
          </g>

          {stay.map((actor, index) => {
            const point = geometry.routes.stay.at(spots.stay[index] as number)
            return (
              <g key={`stay-${index}`} data-track="stay" transform={transform(point.x, point.y, 0, depthScale(point.y))}>
                <Figure actor={actor} youLabel={you} delay={index * 0.41} />
              </g>
            )
          })}
          {pull.map((actor, index) => {
            const point = geometry.routes.pull.at(spots.pull[index] as number)
            return (
              <g key={`pull-${index}`} data-track="pull" transform={transform(point.x, point.y, 0, depthScale(point.y))}>
                <Figure actor={actor} youLabel={you} delay={1.3 + index * 0.41} />
              </g>
            )
          })}

          <g data-part="tram" transform={tramTransform(L, geometry.routes.stay, geometry.tram.start)}>
            <Tram id={id} youLabel={you} warning={FOOT_UI.noBrakes[lang]} sign={L.sign} />
          </g>

          <circle
            className="atp-m-hotspot"
            cx={geometry.fork.x - 24}
            cy={geometry.fork.y + 14}
            r="58"
            aria-hidden="true"
            onClick={() => {
              if (interactive) onLever?.('pull')
            }}
          />
        </g>
        <rect data-part="vignette" x="-2000" y="-2000" width="5000" height="5000" fill={`url(#${id}-vignette)`} opacity="0" pointerEvents="none" />
        <rect data-part="flash" x="-2000" y="-2000" width="5000" height="5000" fill="#ffffff" opacity="0" pointerEvents="none" />
      </g>
    </svg>
  )
}
