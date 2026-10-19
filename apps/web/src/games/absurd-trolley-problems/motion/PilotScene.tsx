import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FOOT_UI, UI } from '../content/strings'
import type { TrolleyChoice } from '../content/types'
import { alternate, calm, cheer, fade, fall, fallenPose, lieDown, part, parts, pop, shake } from './acting'
import { easeInQuad, easeOutCubic, easeOutQuad, linear, round2, setAttr, Timeline, transform } from './animate'
import { Backdrop, Pill, Stars } from './Backdrop'
import { Figure, MarkerBadge } from './figures'
import { cubicPoint, type Point } from './geometry'
import { emitter, isPerson, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * Philippa Foot's pilot, in motion: the engine is on fire and the plane is
 * going down. Hold course over the town, or steer for the field where one
 * farmer is working. Either way the pilot bails out.
 */

const SIGN_BASE = 'translate(4 -70)'

interface House {
  readonly x: number
  readonly w: number
  readonly h: number
  readonly roof: string
  readonly wall: string
}

/** Where the town, the field and the plane are, on a wide stage or a tall one. */
interface Layout {
  readonly viewBox: string
  readonly horizon: number
  readonly ground: number
  /** Where the plane hangs while you decide, and where it flies in from. */
  readonly wait: Point
  readonly start: Point
  /** Where the plane comes down, and how it gets there. */
  readonly dives: Readonly<Record<TrolleyChoice, readonly [Point, Point, Point]>>
  readonly townXs: readonly number[]
  readonly farmerX: number
  readonly landing: Point
  readonly houses: readonly House[]
  readonly road: { readonly x: number; readonly w: number }
  readonly field: { readonly from: number; readonly to: number }
  readonly hayX: number
  readonly fireXs: readonly number[]
  readonly labels: Readonly<Record<TrolleyChoice, Point>>
  /** Which way the first of those hit falls (the rest alternate), so nobody falls out of the frame. */
  readonly fallFirst: 1 | -1
}

const COLOURS = [
  { roof: '#8c3b3b', wall: '#3a4562' },
  { roof: '#5b4a7a', wall: '#2f3a57' },
  { roof: '#a0522d', wall: '#40496a' },
  { roof: '#3f6b5a', wall: '#333d5c' },
  { roof: '#8c3b3b', wall: '#3b4566' },
] as const

const houses = (sizes: readonly (readonly [number, number, number])[]): House[] => sizes.map(([x, w, h], index) => ({ x, w, h, ...(COLOURS[index % COLOURS.length] as (typeof COLOURS)[number]) }))

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: {
    viewBox: '40 40 920 480',
    horizon: 300,
    ground: 432,
    wait: { x: 300, y: 140 },
    start: { x: -200, y: 40 },
    dives: {
      stay: [
        { x: 340, y: 200 },
        { x: 300, y: 330 },
        { x: 250, y: 426 },
      ],
      pull: [
        { x: 480, y: 120 },
        { x: 720, y: 260 },
        { x: 800, y: 426 },
      ],
    },
    townXs: [150, 200, 250, 300, 350],
    farmerX: 800,
    landing: { x: 470, y: 412 },
    houses: houses([
      [112, 58, 74],
      [172, 46, 98],
      [220, 64, 62],
      [286, 50, 88],
      [338, 62, 70],
    ]),
    road: { x: 92, w: 328 },
    field: { from: 640, to: 1000 },
    hayX: 900,
    fireXs: [200, 250, 300],
    labels: { stay: { x: 255, y: 290 }, pull: { x: 800, y: 290 } },
    fallFirst: -1,
  },
  tall: {
    viewBox: '140 40 500 640',
    horizon: 420,
    ground: 590,
    wait: { x: 330, y: 170 },
    start: { x: -200, y: 60 },
    dives: {
      stay: [
        { x: 370, y: 260 },
        { x: 320, y: 460 },
        { x: 272, y: 584 },
      ],
      pull: [
        { x: 440, y: 210 },
        { x: 540, y: 430 },
        { x: 560, y: 584 },
      ],
    },
    townXs: [192, 232, 272, 312, 352],
    farmerX: 560,
    landing: { x: 432, y: 572 },
    houses: houses([
      [160, 46, 70],
      [208, 40, 92],
      [250, 52, 60],
      [304, 42, 84],
      [348, 50, 66],
    ]),
    road: { x: 150, w: 262 },
    field: { from: 440, to: 720 },
    hayX: 600,
    fireXs: [230, 270, 310],
    labels: { stay: { x: 276, y: 470 }, pull: { x: 548, y: 470 } },
    fallFirst: 1,
  },
}

interface Nodes {
  readonly root: SVGGElement
  readonly camera: SVGGElement | null
  readonly plane: SVGGElement | null
  readonly sign: SVGGElement | null
  readonly chute: SVGGElement | null
  readonly blast: SVGGElement | null
  readonly smoke: SVGGElement | null
  readonly fire: SVGGElement | null
  readonly labels: SVGGElement | null
  readonly flash: SVGGElement | null
  readonly vignette: SVGGElement | null
  readonly people: Readonly<Record<TrolleyChoice, readonly SVGGElement[]>>
}

function gather(root: SVGGElement): Nodes {
  return {
    root,
    camera: part(root, 'camera'),
    plane: part(root, 'plane'),
    sign: part(root, 'sign'),
    chute: part(root, 'chute'),
    blast: part(root, 'blast'),
    smoke: part(root, 'smoke'),
    fire: part(root, 'fire'),
    labels: part(root, 'labels'),
    flash: part(root, 'flash'),
    vignette: part(root, 'vignette'),
    people: { stay: parts(root, 'townsperson'), pull: parts(root, 'farmer') },
  }
}

/** Where the plane is along its dive, nose following the way down. */
function divePose(L: Layout, choice: TrolleyChoice, v: number): string {
  const [c1, c2, end] = L.dives[choice]
  const at = cubicPoint(L.wait, c1, c2, end, v)
  const ahead = cubicPoint(L.wait, c1, c2, end, Math.min(1, v + 0.02))
  const angle = v >= 1 ? 40 : (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI
  return transform(at.x, at.y, angle)
}

async function arrive(n: Nodes, L: Layout, timeline: Timeline, emit: Emit, turn: Turn): Promise<void> {
  const { start, wait } = L
  const mine = turn.current
  n.root.dataset.state = 'arriving'
  emit('arrive')
  await timeline.tween(
    1600,
    (v) => setAttr(n.plane, 'transform', transform(start.x + (wait.x - start.x) * v, start.y + (wait.y - start.y) * v, 12 * v)),
    easeOutCubic,
  )
  if (turn.current !== mine || timeline.finished) return
  // Time stops, the plane hanging in the air, while you decide.
  n.root.dataset.state = 'waiting'
  emit('brake')
  void timeline.tween(420, (v) => setAttr(n.flash, 'opacity', round2(0.38 * (1 - v))), easeOutQuad)
  void fade(timeline, n.vignette, 1, 500)
  void fade(timeline, n.labels, 1, 400)
  await pop(timeline, n.sign, SIGN_BASE, 360)
}

/** The pilot's parachute opens and drifts down to a field nearby. */
function bailOut(n: Nodes, L: Layout, timeline: Timeline): Promise<void> {
  const { wait, landing } = L
  setAttr(n.chute, 'opacity', 1)
  return timeline.tween(
    2600,
    (v) => {
      const x = wait.x + (landing.x - wait.x) * v
      const y = wait.y - 40 * Math.sin(Math.min(1, v * 3) * (Math.PI / 2)) + (landing.y - wait.y + 40) * Math.max(0, (v - 0.33) / 0.67)
      setAttr(n.chute, 'transform', transform(x + Math.sin(v * 9) * 6, y, Math.sin(v * 7) * 6))
    },
    linear,
  )
}

async function run(n: Nodes, L: Layout, timeline: Timeline, choice: TrolleyChoice, emit: Emit, turn: Turn): Promise<void> {
  turn.current += 1
  timeline.skip()
  n.root.dataset.state = 'running'
  const other: TrolleyChoice = choice === 'pull' ? 'stay' : 'pull'
  void fade(timeline, n.labels, 0, 200)
  void fade(timeline, n.sign, 0, 200)
  void fade(timeline, n.vignette, 0, 500)
  void timeline.tween(320, (v) => setAttr(n.flash, 'opacity', round2(0.3 * (1 - v))), easeOutQuad)
  emit('push')
  const landed = bailOut(n, L, timeline)
  if (choice === 'pull') emit('lever')
  await timeline.wait(240)
  emit('depart')
  await timeline.tween(1500, (v) => setAttr(n.plane, 'transform', divePose(L, choice, v)), easeInQuad)

  // The crash.
  const end = L.dives[choice][2]
  emit('stop')
  emit('boom')
  setAttr(n.plane, 'opacity', 0)
  void shake(timeline, n.camera, 10)
  setAttr(n.blast, 'transform', `translate(${end.x} ${end.y})`)
  setAttr(n.smoke, 'transform', `translate(${end.x} ${end.y})`)
  if (choice === 'stay') void fade(timeline, n.fire, 1, 400)
  void timeline.tween(
    700,
    (v) => {
      setAttr(n.blast, 'opacity', round2(1 - v))
      setAttr(n.blast, 'transform', `translate(${end.x} ${end.y}) scale(${round2(0.3 + 1.7 * v)})`)
    },
    easeOutQuad,
  )
  void timeline.tween(
    1200,
    (v) => {
      setAttr(n.smoke, 'opacity', round2(0.85 * Math.min(1, v * 3)))
      setAttr(n.smoke, 'transform', `translate(${end.x} ${end.y - 30 * v}) scale(${round2(0.5 + 0.7 * v)})`)
    },
    easeOutCubic,
  )
  const falls = n.people[choice].map((figure, index) => {
    emit('impact', { kind: 'person', how: 'blast' })
    return fall(timeline, figure, alternate(L.fallFirst, index))
  })
  await timeline.wait(300)
  if (n.people[other].length > 0) emit('cheer')
  await Promise.all([...falls, ...n.people[other].map((figure) => cheer(timeline, figure)), landed])
  n.root.dataset.state = 'done'
}

function aftermath(n: Nodes, L: Layout, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  const end = L.dives[choice][2]
  setAttr(n.plane, 'opacity', 0)
  setAttr(n.chute, 'opacity', 1)
  setAttr(n.chute, 'transform', transform(L.landing.x, L.landing.y))
  setAttr(n.smoke, 'opacity', 0.85)
  setAttr(n.smoke, 'transform', `translate(${end.x} ${end.y - 30}) scale(1.2)`)
  if (choice === 'stay') setAttr(n.fire, 'opacity', 1)
  for (const [index, figure] of n.people[choice].entries()) lieDown(figure, fallenPose(alternate(L.fallFirst, index)))
  for (const figure of n.people[choice === 'pull' ? 'stay' : 'pull']) calm(figure)
}

/** A small propeller plane, side on and heading right, centred on (0, 0). */
function Plane({ youLabel, warning }: { readonly youLabel: string; readonly warning: string }) {
  const width = warning.length * 7.6 + 34
  return (
    <g className="atp-m-plane">
      <g className="atp-m-smoke-trail" fill="#5b6478">
        {[0, 1, 2, 3, 4].map((index) => (
          <circle key={index} className="atp-m-puff" cx={-60 - index * 4} cy={-6} r={9 + index * 2} style={{ animationDelay: `${-index * 0.24}s` }} />
        ))}
      </g>
      <path d="M-58 -4Q-60 -14 -50 -16H34Q56 -16 60 -2Q56 10 34 10H-48Q-58 8 -58 -4Z" fill="#e9dcc0" />
      <path d="M-58 -4H58" stroke="#d9473f" strokeWidth="4" />
      <path d="M-50 -16L-62 -38H-44L-28 -16Z" fill="#d9473f" />
      <path d="M-8 2L-26 26H2L16 2Z" fill="#c9bb98" />
      <path d="M14 -16Q18 -28 32 -28Q40 -26 42 -16Z" fill="#1b2d55" />
      <circle cx="28" cy="-21" r="4.5" fill="#f0c39c" />
      <path d="M23.5 -24a4.5 4.5 0 0 1 9 0z" fill="#1d1a1f" />
      <rect x="58" y="-8" width="6" height="12" rx="2" fill="#2a3550" />
      <ellipse className="atp-m-prop" cx="66" cy="-2" rx="3" ry="20" fill="#c8d1df" opacity="0.7" />
      <g className="atp-m-fire-nose">
        <path className="atp-m-flame" d="M40 -14c6 -10 14 -12 12 -24c8 8 10 18 2 26z" fill="#ffb347" />
        <path className="atp-m-flame is-core" d="M44 -16c3 -5 7 -6 6 -12c4 4 5 9 1 13z" fill="#fff1b0" />
      </g>
      <g transform="translate(-10 -40)">
        <MarkerBadge marker="you" youLabel={youLabel} />
      </g>
      <g data-part="sign" transform={SIGN_BASE} opacity="0">
        <g className="atp-m-blink">
          <rect x={-width / 2} y="-13" width={width} height="24" rx="8" fill="#d9473f" />
          <text y="3.5" textAnchor="middle" className="atp-m-sign-text" fill="#fff8e8">
            {warning}
          </text>
        </g>
      </g>
    </g>
  )
}

export function PilotScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const { ground, wait } = L
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, L })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)
  const town = useMemo(() => dilemma.trackA.filter(isPerson).slice(0, L.townXs.length), [dilemma, L])
  const farmer = useMemo(() => dilemma.trackB.find(isPerson), [dilemma])

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
        return run(gather(root), latest.current.L, timeline, choice, emitter(timeline, latest), turn)
      },
    }),
    [],
  )

  const you = FOOT_UI.you[lang]
  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.pilotLabel[lang]}>
      <defs>
        <radialGradient id={`${id}-blast`}>
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.45" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff5b4d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          <Backdrop id={id} horizon={L.horizon} />
          <Stars />
          <g className="atp-m-clouds" fill="#1d3466" opacity="0.8">
            <path className="atp-m-cloud" d="M120 120q10 -22 34 -16q12 -16 34 -4q26 -2 26 20z" />
            <path className="atp-m-cloud is-slow" d="M600 92q10 -22 34 -16q12 -16 34 -4q26 -2 26 20z" />
          </g>

          {/* The town, packed with people, and the field with its one farmer. */}
          {L.houses.map((house) => (
            <g key={house.x}>
              <rect x={house.x} y={ground - 28 - house.h} width={house.w} height={house.h} fill={house.wall} />
              <path d={`M${house.x - 4} ${ground - 28 - house.h}L${house.x + house.w / 2} ${ground - 52 - house.h}L${house.x + house.w + 4} ${ground - 28 - house.h}Z`} fill={house.roof} />
              {[0.25, 0.62].map((fx) =>
                [0.28, 0.6].map((fy) => (
                  <rect key={`${fx}-${fy}`} x={house.x + house.w * fx - 5} y={ground - 28 - house.h + house.h * fy} width="10" height="11" rx="1.5" fill="#ffd36b" opacity="0.9" />
                )),
              )}
            </g>
          ))}
          <rect x={L.road.x} y={ground - 28} width={L.road.w} height="40" rx="6" fill="#26333f" />
          <g className="atp-m-field" stroke="#3f6b46" strokeWidth="4" strokeLinecap="round">
            {[0, 1, 2, 3, 4].map((row) => (
              <path key={row} d={`M${L.field.from + row * 6} ${ground - 26 + row * 12}H${L.field.to - row * 6}`} strokeOpacity={0.5 + row * 0.1} />
            ))}
          </g>
          <path d={`M${L.hayX} ${ground - 20}q22 -38 44 0z`} fill="#c9a36b" />
          <path d={`M${L.hayX} ${ground - 20}q22 -38 44 0`} fill="none" stroke="#a8844f" strokeWidth="2" />

          <g data-part="fire" opacity="0">
            {L.fireXs.map((x) => (
              <path key={x} className="atp-m-flame" d={`M${x} ${ground - 100}c10 12 12 24 4 34c-4 4 -10 4 -14 0c-8 -10 -4 -22 10 -34z`} fill="#ff8a3d" />
            ))}
          </g>

          <g data-part="labels" opacity="0">
            <Pill x={L.labels.stay.x} y={L.labels.stay.y} text={`${dilemma.verbs?.stay?.[lang] ?? UI.stay[lang]} ↓`} tone="stay" />
            <Pill x={L.labels.pull.x} y={L.labels.pull.y} text={`↘ ${dilemma.verbs?.pull[lang] ?? UI.pull[lang]}`} tone="pull" />
          </g>

          {town.map((actor, index) => (
            <g key={L.townXs[index]} data-part="townsperson" transform={transform(L.townXs[index] as number, ground)}>
              <Figure actor={actor} youLabel={you} delay={index * 0.47} />
            </g>
          ))}
          {farmer && (
            <g data-part="farmer" transform={transform(L.farmerX, ground)}>
              <Figure actor={farmer} youLabel={you} delay={1.1} />
            </g>
          )}

          <g data-part="smoke" opacity="0" fill="#3d4459">
            <circle cx="-26" cy="-40" r="34" />
            <circle cx="16" cy="-56" r="40" />
            <circle cx="40" cy="-30" r="28" />
            <circle cx="-4" cy="-22" r="30" />
          </g>
          <g data-part="blast" opacity="0">
            <circle r="80" fill={`url(#${id}-blast)`} />
          </g>

          <g data-part="chute" opacity="0" transform={transform(wait.x, wait.y)}>
            <path d="M-34 -60Q0 -96 34 -60Z" fill="#7fe3b8" />
            <path d="M-34 -60Q-12 -70 0 -60Q12 -70 34 -60" fill="none" stroke="#3f8f72" strokeWidth="2" />
            <path d="M-32 -60L-4 -16M32 -60L4 -16M0 -62V-16" stroke="#c8d1df" strokeWidth="1.2" />
            <circle cx="0" cy="-12" r="5" fill="#f0c39c" />
            <rect x="-5" y="-7" width="10" height="13" rx="3" fill="#7fe3b8" />
          </g>

          <g data-part="plane" transform={transform(L.start.x, L.start.y)}>
            <Plane youLabel={you} warning={FOOT_UI.engineFire[lang]} />
          </g>

          <circle
            className="atp-m-hotspot"
            cx={wait.x}
            cy={wait.y}
            r="70"
            aria-hidden="true"
            onClick={() => {
              if (interactive) onLever?.('pull')
            }}
          />
          <circle className="atp-m-hint" cx={wait.x} cy={wait.y} r="48" />
        </g>
        <rect data-part="vignette" x="-2000" y="-2000" width="5000" height="5000" fill={`url(#${id}-vignette)`} opacity="0" pointerEvents="none" />
        <rect data-part="flash" x="-2000" y="-2000" width="5000" height="5000" fill="#ffffff" opacity="0" pointerEvents="none" />
      </g>
    </svg>
  )
}
