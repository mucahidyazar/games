import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FOOT_UI, UI } from '../content/strings'
import type { PersonActor, TrolleyChoice } from '../content/types'
import { alarm, calm, cheer, fade, lose, lost, part, parts, pop, setArms, shake } from './acting'
import { easeInOutCubic, easeInQuad, easeOutBack, easeOutCubic, easeOutQuad, linear, round2, setAttr, Timeline, transform } from './animate'
import { Pill, Stars } from './Backdrop'
import { Figure } from './figures'
import { FIGURE, type Point } from './geometry'
import { emitter, isPerson, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * Philippa Foot's shipwrecked mariners, in motion: an overloaded lifeboat
 * riding low in a storm at night. Throw one of them overboard and the boat
 * rides the storm out; wait, and a wave swamps it and takes everyone down.
 */

/**
 * The boat is drawn in its own frame: everyone aboard stands with their feet
 * on y 0, the hull hides their legs, and the sea comes up to WATERLINE, just
 * under the gunwale.
 */
const HULL = 'M-160 -46Q0 -14 160 -46C164 -12 132 14 92 20Q0 30 -92 20C-132 14 -164 -12 -160 -46Z'
const GUNWALE = 'M-160 -46Q0 -14 160 -46'
const WATERLINE = -22
/** Where the five stand, you first, beside the one at the stern. */
const SEATS = [57, 19, -19, -57, -95] as const
const ONE_X = 95
/** Where the one hits the sea, bobs up, and goes under. */
const OVERBOARD = { x: 232, plunge: 50, float: 22, under: 70 } as const
/** How far the boat rides up once it is lighter. */
const LIGHTER = 18
/** How far down, and over, the boat goes when it is swamped. */
const SUNK = { drop: 80, tilt: -12 } as const

/** The wave that swamps the boat, its foot on the sea at (0, 0), curling to the right. */
const BREAKER = 'M-170 24C-128 8 -64 -128 18 -174C82 -206 152 -168 162 -110C168 -78 142 -58 118 -70C100 -80 104 -104 84 -110C52 -118 34 -44 80 24Z'
const BREAKER_FACE = 'M84 -110C52 -118 34 -44 80 24H40C14 -40 40 -104 84 -110Z'
const BREAKER_FOAM = 'M18 -174C82 -206 152 -168 162 -110C168 -78 142 -58 118 -70'

/** Bubbles rising from below, around (0, 0) on the surface. */
const BUBBLES: readonly (readonly [number, number, number])[] = [
  [-6, 40, 3.2], [8, 30, 2.4], [-12, 20, 2.8], [4, 12, 2], [14, 46, 2.2], [-2, 4, 2.6],
]

/** Where the sea, the sky and the boat are, on a wide stage or a tall one. */
interface Layout {
  readonly viewBox: string
  readonly horizon: number
  /** The middle of the boat, at the feet of those aboard, and how big it is drawn. */
  readonly boat: Point & { readonly scale: number }
  /** The underside of the storm clouds. */
  readonly cloudBase: number
  /** Where the lightning comes out of the clouds. */
  readonly bolt: Point
  readonly moon: Point
  readonly sign: Point
  readonly labels: Readonly<Record<TrolleyChoice, Point>>
}

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: {
    viewBox: '40 40 920 480',
    horizon: 286,
    boat: { x: 470, y: 392, scale: 1 },
    cloudBase: 150,
    bolt: { x: 800, y: 150 },
    moon: { x: 838, y: 140 },
    sign: { x: 180, y: 232 },
    labels: { stay: { x: 400, y: 254 }, pull: { x: 690, y: 286 } },
  },
  tall: {
    viewBox: '150 60 500 640',
    horizon: 392,
    boat: { x: 382, y: 512, scale: 1 },
    cloudBase: 214,
    bolt: { x: 590, y: 214 },
    moon: { x: 430, y: 238 },
    sign: { x: 258, y: 272 },
    labels: { stay: { x: 320, y: 380 }, pull: { x: 552, y: 384 } },
  },
}

interface Nodes {
  readonly root: SVGGElement
  readonly camera: SVGGElement | null
  readonly boat: SVGGElement | null
  readonly one: SVGGElement | null
  readonly five: readonly SVGGElement[]
  readonly sign: SVGGElement | null
  readonly labels: SVGGElement | null
  readonly rain: readonly SVGGElement[]
  readonly clouds: SVGGElement | null
  readonly clear: SVGGElement | null
  readonly swells: readonly SVGGElement[]
  readonly splash: SVGGElement | null
  readonly spray: SVGGElement | null
  readonly breaker: SVGGElement | null
  readonly bubbles: SVGGElement | null
  readonly debris: SVGGElement | null
  readonly flash: SVGGElement | null
}

function gather(root: SVGGElement): Nodes {
  return {
    root,
    camera: part(root, 'camera'),
    boat: part(root, 'boat'),
    one: part(root, 'one'),
    five: parts(root, 'castaway'),
    sign: part(root, 'sign'),
    labels: part(root, 'labels'),
    rain: parts(root, 'rain'),
    clouds: part(root, 'clouds'),
    clear: part(root, 'clear'),
    swells: parts(root, 'swell'),
    splash: part(root, 'splash'),
    spray: part(root, 'spray'),
    breaker: part(root, 'breaker'),
    bubbles: part(root, 'bubbles'),
    debris: part(root, 'debris'),
    flash: part(root, 'flash'),
  }
}

const figureOf = (holder: Element | null | undefined): Element | null => holder?.querySelector('.atp-m-figure') ?? null
const seaLevel = (L: Layout): number => L.boat.y + WATERLINE * L.boat.scale
/** Where a point in the boat's own frame is on the stage, the boat at rest. */
const onBoat = (L: Layout, x: number, y: number): Point => ({ x: L.boat.x + x * L.boat.scale, y: L.boat.y + y * L.boat.scale })
const signBase = (L: Layout): string => `translate(${L.sign.x} ${L.sign.y})`

/** Where the boat is: `drop` down (up, when less than 0) in its own units, tipped `tilt` degrees, bow first. */
function boatPose(L: Layout, drop: number, tilt = 0): string {
  const { x, y, scale } = L.boat
  return `translate(${x} ${round2(y + drop * scale)}) rotate(${round2(tilt)}) scale(${scale})`
}

/** Where the one is, in the boat's frame, turned `spin` degrees about his middle. */
const onePose = (x: number, y: number, spin = 0): string => `translate(${round2(x)} ${round2(y)}) rotate(${Math.round(spin)} 0 -40)`

/** Whether someone standing `x` along the boat has gone under, with the boat `drop` down and tipped `tilt` degrees. */
function underwater(x: number, drop: number, tilt: number): boolean {
  const angle = (tilt * Math.PI) / 180
  return drop + x * Math.sin(angle) + FIGURE.headY * Math.cos(angle) > WATERLINE + 4
}

/** The wave that swamps the boat: rising off its bow (`rise` 0 to 1), then breaking over it (`crash` 0 to 1). */
function breakerPose(L: Layout, rise: number, crash: number): string {
  const { x, scale } = L.boat
  const bx = x + (-210 + 140 * crash) * scale
  const by = seaLevel(L) + (150 * (1 - rise) + 36 * crash) * scale
  return `translate(${round2(bx)} ${round2(by)}) rotate(${round2(24 * crash)}) scale(${round2(scale * (0.6 + 0.4 * rise))})`
}

/** Where the bubbles come up: over the one, or over the sunken boat. */
function bubblesAt(L: Layout, choice: TrolleyChoice): string {
  const at = onBoat(L, choice === 'pull' ? OVERBOARD.x : -20, WATERLINE)
  return `translate(${round2(at.x)} ${round2(at.y)}) scale(${L.boat.scale})`
}

/** Water thrown up and out, then gone. */
function burst(timeline: Timeline, node: Element | null, duration: number): Promise<void> {
  return timeline.tween(
    duration,
    (v) => {
      setAttr(node, 'opacity', round2(v < 0.12 ? v / 0.12 : (1 - v) / 0.88))
      setAttr(node, 'transform', `scale(${round2(0.4 + 0.8 * v)})`)
    },
    easeOutQuad,
  )
}

/** The storm blowing over, `v` of the way: the rain stops, the clouds lift and thin, the moon comes out, the sea calms. */
function clearUp(n: Nodes, v: number): void {
  for (const rain of n.rain) setAttr(rain, 'opacity', round2(1 - v))
  setAttr(n.clear, 'opacity', round2(v))
  setAttr(n.clouds, 'opacity', round2(1 - 0.55 * v))
  setAttr(n.clouds, 'transform', `translate(0 ${Math.round(-54 * v)})`)
  for (const swell of n.swells) setAttr(swell, 'transform', `scale(1 ${round2(1 - 0.5 * v)})`)
}

async function arrive(n: Nodes, L: Layout, timeline: Timeline, emit: Emit, turn: Turn): Promise<void> {
  const mine = turn.current
  n.root.dataset.state = 'arriving'
  emit('creak')
  // The boat comes down off a swell, groaning under its load.
  await timeline.tween(1000, (v) => setAttr(n.boat, 'transform', boatPose(L, -34 * (1 - v))), easeOutBack)
  if (turn.current !== mine || timeline.finished) return
  n.root.dataset.state = 'waiting'
  void fade(timeline, n.labels, 1, 400)
  await pop(timeline, n.sign, signBase(L), 360)
}

/** Over the side with the one at the stern: he goes under, the boat rides higher, the storm blows over. */
async function overboard(n: Nodes, L: Layout, timeline: Timeline, emit: Emit): Promise<void> {
  const one = figureOf(n.one)
  const you = figureOf(n.five[0])
  emit('push')
  if (one) alarm(timeline, one)
  if (you) void timeline.tween(800, (v) => setArms(you, FIGURE.armRest + 120 * Math.sin(Math.PI * Math.min(1, v * 1.4))), linear)
  await timeline.wait(300)
  // Heaved over the stern, tumbling, into the sea; he comes up flailing.
  if (one) calm(one)
  await timeline.tween(
    900,
    (v) => {
      const x = ONE_X + (OVERBOARD.x - ONE_X) * v
      const y = OVERBOARD.plunge * v - 110 * 4 * v * (1 - v)
      setAttr(n.one, 'transform', onePose(x, y, 360 * v))
    },
    linear,
  )
  emit('splash')
  void burst(timeline, n.splash, 700)
  if (one) alarm(timeline, one)
  await timeline.tween(320, (v) => setAttr(n.one, 'transform', onePose(OVERBOARD.x, OVERBOARD.plunge + (OVERBOARD.float - OVERBOARD.plunge) * v)), easeOutQuad)
  await timeline.wait(280)
  // He goes under.
  await timeline.tween(700, (v) => setAttr(n.one, 'transform', onePose(OVERBOARD.x, OVERBOARD.float + (OVERBOARD.under - OVERBOARD.float) * v)), easeInQuad)
  emit('impact', { kind: 'person', how: 'drown' })
  const losing = one ? lose(timeline, one) : Promise.resolve()
  setAttr(n.bubbles, 'transform', bubblesAt(L, 'pull'))
  const bubbling = fade(timeline, n.bubbles, 1, 500)
  // Lighter now, the boat rides higher (he stays where he went under), and the storm blows over.
  const rising = timeline.tween(
    1100,
    (v) => {
      setAttr(n.boat, 'transform', boatPose(L, -LIGHTER * v))
      setAttr(n.one, 'transform', onePose(OVERBOARD.x, OVERBOARD.under + LIGHTER * v))
    },
    easeOutCubic,
  )
  const clearing = timeline.tween(1800, (v) => clearUp(n, v), easeInOutCubic)
  await timeline.wait(500)
  // The others cheer; you, who did it, do not.
  emit('cheer')
  if (you) calm(you)
  const cheering = n.five.slice(1).map((castaway, index) => {
    const figure = figureOf(castaway)
    return figure ? timeline.wait(index * 90).then(() => cheer(timeline, figure)) : Promise.resolve()
  })
  await Promise.all([losing, bubbling, rising, clearing, ...cheering])
}

/** Waiting: a wave breaks over the boat, it fills and goes down bow first, and everyone aboard goes under. */
async function swamped(n: Nodes, L: Layout, timeline: Timeline, emit: Emit): Promise<void> {
  const aboard = [...n.five.map((holder, index) => ({ holder, x: SEATS[index] as number })), ...(n.one ? [{ holder: n.one, x: ONE_X }] : [])]
  for (const { holder } of aboard) {
    const figure = figureOf(holder)
    if (figure) alarm(timeline, figure)
  }
  // The wave rises off the bow...
  await timeline.tween(
    800,
    (v) => {
      setAttr(n.breaker, 'opacity', round2(Math.min(1, v * 2.5)))
      setAttr(n.breaker, 'transform', breakerPose(L, v, 0))
    },
    easeOutCubic,
  )
  // ...and breaks over the boat.
  await timeline.tween(420, (v) => setAttr(n.breaker, 'transform', breakerPose(L, 1, v)), easeInQuad)
  emit('splash')
  void shake(timeline, n.camera, 10)
  void timeline.tween(450, (v) => setAttr(n.flash, 'opacity', round2(0.3 * (1 - v))), easeOutQuad)
  void fade(timeline, n.breaker, 0, 260)
  void burst(timeline, n.spray, 800)
  emit('creak')
  // Full of water, it goes down; one after another, they go under.
  const gone = aboard.map(() => false)
  const losses: Promise<void>[] = []
  await timeline.tween(
    2400,
    (v) => {
      const drop = SUNK.drop * v
      const tilt = SUNK.tilt * v
      setAttr(n.boat, 'transform', boatPose(L, drop, tilt))
      for (const [index, { holder, x }] of aboard.entries()) {
        if (gone[index] || (v < 1 && !underwater(x, drop, tilt))) continue
        gone[index] = true
        emit('impact', { kind: 'person', how: 'drown' })
        const figure = figureOf(holder)
        if (figure) losses.push(lose(timeline, figure))
      }
    },
    easeInOutCubic,
  )
  setAttr(n.bubbles, 'transform', bubblesAt(L, 'stay'))
  await Promise.all([...losses, fade(timeline, n.bubbles, 1, 600), fade(timeline, n.debris, 1, 600)])
}

async function run(n: Nodes, L: Layout, timeline: Timeline, choice: TrolleyChoice, emit: Emit, turn: Turn): Promise<void> {
  turn.current += 1
  timeline.skip()
  n.root.dataset.state = 'running'
  void fade(timeline, n.labels, 0, 200)
  void fade(timeline, n.sign, 0, 200)
  if (choice === 'pull') await overboard(n, L, timeline, emit)
  else await swamped(n, L, timeline, emit)
  n.root.dataset.state = 'done'
}

function aftermath(n: Nodes, L: Layout, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  setAttr(n.bubbles, 'transform', bubblesAt(L, choice))
  setAttr(n.bubbles, 'opacity', 1)
  const one = figureOf(n.one)
  if (choice === 'pull') {
    setAttr(n.boat, 'transform', boatPose(L, -LIGHTER))
    setAttr(n.one, 'transform', onePose(OVERBOARD.x, OVERBOARD.under + LIGHTER))
    if (one) lost(one)
    for (const castaway of n.five) {
      const figure = figureOf(castaway)
      if (figure) calm(figure)
    }
    clearUp(n, 1)
  } else {
    setAttr(n.boat, 'transform', boatPose(L, SUNK.drop, SUNK.tilt))
    setAttr(n.debris, 'opacity', 1)
    if (one) lost(one)
    for (const castaway of n.five) {
      const figure = figureOf(castaway)
      if (figure) lost(figure)
    }
  }
}

/**
 * A band of sea with a wave every 80 (as far as atp-m-wave carries it, so it
 * loops without a seam), crests `height` tall: rounded, or `sharp` like a
 * storm's. Drawn `sx` times wider by its group, so it reaches past any stage.
 */
function wavePath(sx: number, height: number, sharp: boolean): string {
  const from = Math.floor(-2000 / sx / 80) * 80 - 80
  const to = Math.ceil(3000 / sx / 80) * 80
  const h = round2(height)
  const wave = sharp ? `c20 0 34 ${round2(-h * 0.55)} 40 ${-h}c6 ${round2(h * 0.45)} 20 ${h} 40 ${h}` : `c14 0 26 ${-h} 40 ${-h}s26 ${h} 40 ${h}`
  return `M${from} 0${wave.repeat((to - from) / 80)}V900H${from}Z`
}

type SwellProps = {
  readonly y: number
  /** How far apart the crests are: a multiple of 80. */
  readonly length: number
  readonly height: number
  readonly fill: string
  readonly opacity?: number
  readonly sharp?: boolean
  /** Rolls the other way, more slowly. */
  readonly back?: boolean
  /** A line of foam along the top. */
  readonly crest?: string
}

/** A band of sea from `y` down, rolling sideways; data-part="swell" flattens when the storm blows over. */
function Swell({ y, length, height, fill, opacity = 1, sharp = false, back = false, crest }: SwellProps) {
  const sx = length / 80
  return (
    <g transform={`translate(0 ${round2(y)})`}>
      <g data-part="swell">
        <g transform={`scale(${sx} 1)`}>
          <path
            className={back ? 'atp-m-wave is-back' : 'atp-m-wave'}
            d={wavePath(sx, height, sharp)}
            fill={fill}
            opacity={opacity}
            stroke={crest ?? 'none'}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
    </g>
  )
}

/** A bank of cloud over everything above `y`, its underside billowing down in rounded lumps about `step` wide. */
function cloudBank(y: number, step: number, phase: number): string {
  let d = `M3000 -2000V${y}H1600`
  for (let x = 1600, i = 0; x > -600; i++) {
    const width = Math.round(step * (0.6 + 0.7 * Math.abs(Math.sin(i * 1.9 + phase))))
    const sag = Math.round((width / 2) * (0.35 + 0.35 * Math.abs(Math.sin(i * 2.7 + phase))))
    d += `A${width / 2} ${sag} 0 0 1 ${x - width} ${y}`
    x -= width
  }
  return `${d}H-2000V-2000Z`
}

/** Low, ragged scraps of cloud under the storm, at [x, how far under the clouds' base]. */
const SCUD: readonly (readonly [number, number])[] = [
  [-180, 70], [150, 96], [500, 64], [830, 92], [1180, 72],
]

/**
 * Storm clouds over everything above `base`: banks hanging one in front of
 * the other, the nearest highest and darkest, their undersides catching a
 * little light; and scud below them.
 */
function Clouds({ base }: { readonly base: number }) {
  const banks = [
    { y: base - 20, step: 120, phase: 3.1, fill: '#1c2846', rim: '#2c3c64', className: 'atp-m-cloud is-slow' },
    { y: base - 52, step: 96, phase: 1.9, fill: '#151f39', rim: '#23315a', className: 'atp-m-cloud' },
    { y: base - 86, step: 110, phase: 0.4, fill: '#0e1629', rim: '#1a2647', className: '' },
  ]
  return (
    <g>
      {banks.map((bank) => (
        <g key={bank.y} className={bank.className || undefined}>
          <path d={cloudBank(bank.y, bank.step, bank.phase)} fill={bank.rim} transform="translate(0 3)" />
          <path d={cloudBank(bank.y, bank.step, bank.phase)} fill={bank.fill} />
        </g>
      ))}
      <g className="atp-m-cloud is-slow" fill="#1a2644" opacity="0.85">
        {SCUD.map(([x, under]) => (
          <path key={x} d={`M${x} ${base + under}q14 -12 40 -8q20 -12 46 -2q22 -4 34 10z`} />
        ))}
      </g>
    </g>
  )
}

/** The lifeboat's hull, drawn over everyone aboard so it hides their legs. */
function Hull({ id }: { readonly id: string }) {
  return (
    <g>
      {/* An oar out past the bow, its blade in the sea. */}
      <path d="M-112 -30L-196 4" stroke="#c98b55" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="-198" cy="6" rx="16" ry="5" transform="rotate(-26 -198 6)" fill="#a8693f" />
      <path d={HULL} fill={`url(#${id}-wood)`} />
      <g clipPath={`url(#${id}-hull)`} fill="none">
        <path d="M-172 -34Q0 -4 172 -34" stroke="#d9473f" strokeWidth="5" />
        <path d="M-172 -16Q0 16 172 -16M-172 2Q0 30 172 2" stroke="#5a3720" strokeWidth="1.6" opacity="0.7" />
      </g>
      <path d={GUNWALE} fill="none" stroke="#e9dcc0" strokeWidth="5" strokeLinecap="round" />
      <path d="M-160 -46l-6 -8M160 -46l6 -8" stroke="#e9dcc0" strokeWidth="5" strokeLinecap="round" />
      {/* A lantern on a pole at the bow. */}
      <path d="M-166 -54L-170 -98h-12" fill="none" stroke="#6b4a2b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(-182 -84)">
        <path d="M0 -14v4" stroke="#2a3550" strokeWidth="1.5" />
        <rect x="-6" y="-9" width="12" height="15" rx="3" fill="#ffd36b" stroke="#2a3550" strokeWidth="2" />
        <rect x="-7.5" y="-11" width="15" height="3.5" rx="1.75" fill="#2a3550" />
      </g>
    </g>
  )
}

/** Water thrown up where something hits the sea, its foot on (0, 0). */
function Splash() {
  return (
    <g fill="#dff0ff">
      <path d="M-30 2Q-26 -26 -14 -40Q-16 -16 -6 2ZM30 2Q26 -26 14 -40Q16 -16 6 2ZM-8 2Q-4 -34 0 -56Q4 -34 8 2Z" opacity="0.85" />
      <circle cx="-34" cy="-34" r="3.5" />
      <circle cx="36" cy="-30" r="3" />
      <circle cx="-14" cy="-60" r="2.5" />
      <circle cx="18" cy="-64" r="3" />
      <ellipse cx="0" cy="2" rx="40" ry="6" fill="none" stroke="#dff0ff" strokeWidth="3" opacity="0.7" />
    </g>
  )
}

/** The blinking warning in the sky, like the tram's, with room for a short word beside its triangle. */
function StormSign({ warning }: { readonly warning: string }) {
  const width = Math.max(warning.length * 7.6, 60) + 44
  return (
    <g className="atp-m-blink">
      <rect x={-width / 2} y="-13" width={width} height="24" rx="8" fill="#d9473f" />
      <path d={`M${-width / 2 + 9} 5l7 -12l7 12z`} fill="#ffd36b" />
      <text x={-width / 2 + 16} y="4" textAnchor="middle" className="atp-m-badge-text" fill="#d9473f">
        !
      </text>
      <text x={9} y="3.5" textAnchor="middle" className="atp-m-sign-text" fill="#fff8e8">
        {warning}
      </text>
    </g>
  )
}

export function SeaScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, L })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)
  const one = useMemo(() => dilemma.trackB.find(isPerson), [dilemma])
  // Everyone else aboard; you are the first of them, beside the one.
  const five = useMemo(
    () =>
      dilemma.trackA
        .filter(isPerson)
        .filter((actor) => actor !== one)
        .slice(0, SEATS.length)
        .map((actor, index): PersonActor => (index === 0 ? { ...actor, marker: 'you' } : actor)),
    [dilemma, one],
  )

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
  const { boat, bolt, moon } = L
  const sea = seaLevel(L)
  const s = boat.scale
  const hotspot = onBoat(L, ONE_X, -46)
  const splashAt = onBoat(L, OVERBOARD.x, WATERLINE)
  const sprayAt = onBoat(L, -40, -40)
  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.seaLabel[lang]}>
      <defs>
        <linearGradient id={`${id}-storm`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={L.horizon}>
          <stop offset="0" stopColor="#060b19" />
          <stop offset="1" stopColor="#15243f" />
        </linearGradient>
        <linearGradient id={`${id}-night`} gradientUnits="userSpaceOnUse" x1="0" y1="-120" x2="0" y2={L.horizon}>
          <stop offset="0" stopColor="#050c1f" />
          <stop offset="0.62" stopColor="#0c1c3f" />
          <stop offset="1" stopColor="#1d3768" />
        </linearGradient>
        <linearGradient id={`${id}-deep`} gradientUnits="userSpaceOnUse" x1="0" y1={L.horizon} x2="0" y2={L.horizon + 320}>
          <stop offset="0" stopColor="#13284c" />
          <stop offset="1" stopColor="#0a1730" />
        </linearGradient>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a56a3d" />
          <stop offset="1" stopColor="#62391f" />
        </linearGradient>
        <linearGradient id={`${id}-breaker`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb8ea" />
          <stop offset="0.55" stopColor="#3f86c9" />
          <stop offset="1" stopColor="#1f4f87" />
        </linearGradient>
        <radialGradient id={`${id}-lamp`}>
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.34" />
          <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-moon`}>
          <stop offset="0" stopColor="#fff3cf" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fff3cf" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-rain`} width="60" height="240" patternUnits="userSpaceOnUse">
          <path d="M14 8l-5 20M46 52l-5 20M26 104l-5 20M54 150l-5 20M8 196l-5 20" stroke="#a9c8f0" strokeWidth="1.5" strokeLinecap="round" />
        </pattern>
        <clipPath id={`${id}-hull`}>
          <path d={HULL} />
        </clipPath>
        <clipPath id={`${id}-air`}>
          <rect x="-2000" y="-2000" width="5000" height={2000 + sea + 10} />
        </clipPath>
      </defs>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          {/* The storm's sky; the clear night behind it, for when it blows over. */}
          <rect x="-2000" y="-2000" width="5000" height={2000 + L.horizon + 2} fill={`url(#${id}-storm)`} />
          <g data-part="clear" opacity="0">
            <rect x="-2000" y="-2000" width="5000" height={2000 + L.horizon + 2} fill={`url(#${id}-night)`} />
            <Stars />
            <circle cx={moon.x} cy={moon.y} r="84" fill={`url(#${id}-moon)`} />
            <circle cx={moon.x} cy={moon.y} r="26" fill="#fff3cf" />
            <circle cx={moon.x - 9} cy={moon.y - 7} r="4.5" fill="#f0dfae" />
            <circle cx={moon.x + 8} cy={moon.y + 8} r="3" fill="#f0dfae" />
          </g>
          <path
            className="atp-m-sea-lightning"
            opacity="0"
            d={`M${bolt.x} ${bolt.y}L${bolt.x - 14} ${bolt.y + 54}L${bolt.x + 6} ${bolt.y + 66}L${bolt.x - 10} ${bolt.y + 134}L${bolt.x + 12} ${bolt.y + 72}L${bolt.x - 6} ${bolt.y + 60}L${bolt.x + 10} ${bolt.y}Z`}
            fill="#e6f1ff"
            stroke="#8fc4ff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <g data-part="clouds">
            <Clouds base={L.cloudBase} />
          </g>

          {/* The sea, far off to close by, with the rain falling into it. */}
          <rect x="-2000" y={L.horizon} width="5000" height="3000" fill={`url(#${id}-deep)`} />
          <rect x="-2000" y={L.horizon - 1} width="5000" height="2" fill="#2c4c7c" opacity="0.6" />
          <g data-part="rain">
            <g transform="scale(0.7)">
              <rect className="atp-m-sea-rain is-far" x="-600" y="-900" width="2600" height="2600" fill={`url(#${id}-rain)`} opacity="0.32" />
            </g>
          </g>
          <Swell y={L.horizon + (sea - L.horizon) * 0.4} length={240} height={10 * s} fill="#10244a" sharp back />
          <Swell y={sea - 16 * s} length={200} height={16 * s} fill="#183a68" sharp crest="#3c6aa0" />

          {/* The lifeboat, low in the water: the five and the one at the stern, the hull over their legs. */}
          <g data-part="boat" transform={boatPose(L, 0)}>
            <g className="atp-m-sea-rock">
              <circle cx="-182" cy="-82" r="84" fill={`url(#${id}-lamp)`} />
              {five.map((actor, index) => (
                <g key={SEATS[index]} data-part="castaway" transform={transform(SEATS[index] as number, 0)}>
                  <Figure actor={actor} youLabel={you} delay={index * 0.41} />
                </g>
              ))}
              {one && (
                <g data-part="one" transform={onePose(ONE_X, 0)}>
                  <Figure actor={one} youLabel={you} delay={1.7} />
                </g>
              )}
              <Hull id={id} />
            </g>
          </g>

          {/* The wave that swamps it, if you wait; its foot is lost in the sea. */}
          <g clipPath={`url(#${id}-air)`}>
            <g data-part="breaker" opacity="0" transform={breakerPose(L, 0, 0)}>
              <path d={BREAKER} fill={`url(#${id}-breaker)`} />
              <path d={BREAKER_FACE} fill="#8fc4ff" opacity="0.25" />
              <path d={BREAKER_FOAM} fill="none" stroke="#eaf6ff" strokeWidth="6" strokeLinecap="round" />
              <circle cx="132" cy="-58" r="4" fill="#eaf6ff" />
              <circle cx="146" cy="-44" r="3" fill="#eaf6ff" />
            </g>
          </g>

          <Swell y={sea} length={160} height={7 * s} fill="#1f4f87" opacity={0.82} crest="#8fc4ff" />
          <Swell y={sea + 30 * s} length={240} height={12 * s} fill="#2b6aa8" opacity={0.24} sharp back />
          <Swell y={sea + 74 * s} length={320} height={18 * s} fill="#163763" opacity={0.92} sharp crest="#5a8fc6" />

          {/* What is left on the surface when the boat goes down, and what comes up from below. */}
          <g data-part="debris" opacity="0">
            <g transform={`translate(${round2(boat.x + 226 * s)} ${round2(sea)}) rotate(-8) scale(${s})`}>
              <rect x="-30" y="-5" width="60" height="9" rx="4" fill="#8b5a36" />
              <path d="M-24 -1h48" stroke="#5a3720" strokeWidth="1.5" />
            </g>
            <g transform={`translate(${round2(boat.x - 160 * s)} ${round2(sea + 2)}) rotate(10) scale(${s})`}>
              <rect x="-44" y="-2.5" width="64" height="5" rx="2.5" fill="#c98b55" />
              <path d="M20 -6q16 0 26 6q-10 6 -26 6z" fill="#a8693f" />
            </g>
          </g>
          <g data-part="bubbles" opacity="0" transform={bubblesAt(L, 'stay')}>
            {BUBBLES.map(([x, y, r], index) => (
              <circle key={`${x},${y}`} className="atp-m-sea-bubble" cx={x} cy={y} r={r} fill="#dff0ff" fillOpacity="0.2" stroke="#dff0ff" strokeWidth="1.2" style={{ animationDelay: `${-index * 0.41}s` }} />
            ))}
          </g>
          <g transform={`translate(${round2(splashAt.x)} ${round2(splashAt.y)}) scale(${s})`}>
            <g data-part="splash" opacity="0">
              <Splash />
            </g>
          </g>
          <g transform={`translate(${round2(sprayAt.x)} ${round2(sprayAt.y)}) scale(${round2(1.7 * s)})`}>
            <g data-part="spray" opacity="0">
              <Splash />
            </g>
          </g>

          <g data-part="rain">
            <rect className="atp-m-sea-rain" x="-400" y="-700" width="1900" height="1900" fill={`url(#${id}-rain)`} opacity="0.3" />
          </g>

          <g data-part="sign" transform={signBase(L)} opacity="0">
            <StormSign warning={FOOT_UI.storm[lang]} />
          </g>

          <g data-part="labels" opacity="0">
            <Pill x={L.labels.pull.x} y={L.labels.pull.y} text={`${dilemma.verbs?.pull[lang] ?? UI.pull[lang]} ↘`} tone="pull" />
            <Pill x={L.labels.stay.x} y={L.labels.stay.y} text={dilemma.verbs?.stay?.[lang] ?? UI.stay[lang]} tone="stay" />
          </g>

          <circle className="atp-m-hint" cx={hotspot.x} cy={hotspot.y} r="28" />
          <circle
            className="atp-m-hotspot"
            cx={hotspot.x}
            cy={hotspot.y}
            r="42"
            aria-hidden="true"
            onClick={() => {
              if (interactive) onLever?.('pull')
            }}
          />
        </g>
        {/* Lightning now and then while you decide, and the flash of the wave breaking. */}
        <g opacity="0.16" pointerEvents="none">
          <rect className="atp-m-sea-lightning" x="-2000" y="-2000" width="5000" height="5000" fill="#e3edff" opacity="0" />
        </g>
        <rect data-part="flash" x="-2000" y="-2000" width="5000" height="5000" fill="#ffffff" opacity="0" pointerEvents="none" />
      </g>
    </svg>
  )
}
