import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CLOTH, HAIR, person, SKIN } from '../content/cast'
import { FOOT_UI, UI } from '../content/strings'
import type { PersonActor, TrolleyChoice } from '../content/types'
import { calm, cheer, fade, lose, lost, part, parts, pop, shake, walk } from './acting'
import { easeInOutCubic, easeInQuad, easeOutBack, easeOutQuad, linear, round2, setAttr, Timeline, transform } from './animate'
import { Pill, Stars } from './Backdrop'
import { Figure } from './figures'
import type { Point } from './geometry'
import { emitter, isPerson, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * The example Philippa Foot's essay opens with, in motion: a school on the
 * town square at night, its gate locked, its students waiting outside. Pass
 * the reform and the school fills, while the statistics take the small rise
 * they foresaw; shelve it, and nothing changes, not the statistics, nor the
 * school.
 */

const MINISTER = person({ top: CLOTH.navy, bottom: CLOTH.charcoal, skin: SKIN.tan, hair: 'short', hairColor: HAIR.black, accessories: ['tie'], marker: 'you', shoes: CLOTH.black })

/** The students at the gate (extras: the choice is not about their lives), each with a backpack and its straps. */
const STUDENTS: readonly { readonly look: PersonActor; readonly pack: string; readonly strap: string }[] = [
  { look: person({ top: CLOTH.yellow, bottom: CLOTH.denim, hair: 'bun', hairColor: HAIR.chestnut, skin: SKIN.light }), pack: CLOTH.red, strap: '#a3253a' },
  { look: person({ top: CLOTH.teal, bottom: CLOTH.navy, hair: 'messy', hairColor: HAIR.black, skin: SKIN.deep }), pack: CLOTH.orange, strap: '#b5612a' },
  { look: person({ top: CLOTH.pink, bottom: CLOTH.jeans, hair: 'long', hairColor: HAIR.blonde, skin: SKIN.fair }), pack: CLOTH.blue, strap: '#274f9e' },
  { look: person({ top: CLOTH.white, bottom: CLOTH.charcoal, hair: 'short', hairColor: HAIR.brown, skin: SKIN.medium, accessories: ['glasses'] }), pack: CLOTH.green, strap: '#27844c' },
  { look: person({ top: CLOTH.purple, bottom: CLOTH.denim, hair: 'spiky', hairColor: HAIR.ginger, skin: SKIN.light }), pack: CLOTH.yellow, strap: '#c08f22' },
]
const STUDENT_SCALE = 0.9

/** Someone the statistics foresee: nobody yet, so drawn in the cool grey of a number. */
const foreseen = (actor: PersonActor): PersonActor => ({ ...actor, skin: '#b4bdcc', hairColor: '#566175', top: '#8792a6', bottom: '#566175', shoes: '#465063' })

/** How far in front of the school its railings stand. */
const YARD = 58
/** The reform on the lectern: its middle, above the lectern's foot. */
const DOC_Y = -76
const SEAL_AT = 'translate(12 17)'
const OPEN = 'scale(0.15 1)'
const STAMP_SCALE = 0.5

/** The chart on the board, rising gently; the reform nudges its last point up by RISE. */
const CHART = [
  { x: -36, y: -108 },
  { x: -16, y: -114 },
  { x: 4, y: -112 },
  { x: 24, y: -120 },
  { x: 44, y: -125 },
] as const
const LAST = CHART[4]
const RISE = 11
const AXIS = -100

/** The shaded area under the chart's line, its last point at `last`. */
const chartArea = (last: number): string =>
  `M${CHART[0].x} ${AXIS}${CHART.slice(0, 4)
    .map((point) => `L${point.x} ${point.y}`)
    .join('')}L${LAST.x} ${last}L${LAST.x} ${AXIS}Z`

/** Where the school, the students, the lectern and the board stand, on a wide stage or a tall one. */
interface Layout {
  readonly viewBox: string
  /** The foot of the rooftops around the square, where its paving starts. */
  readonly horizon: number
  /** The middle of the school's front, at its foot; the gate is in line with its door. */
  readonly school: Point
  /** How far the railings run, either side of the gate. */
  readonly fence: { readonly from: number; readonly to: number }
  /** Where the students wait, how far off to the left they come from, and where each wanders off to. */
  readonly students: { readonly xs: readonly number[]; readonly y: number; readonly from: number; readonly away: readonly number[] }
  readonly minister: Point
  readonly lectern: Point
  /** The board's foot, and how high its frame stands. */
  readonly board: Point & { readonly legs: number }
  /** The one the statistics foresee, beside the board. */
  readonly unknown: Point
  /** How much bigger the front row (you, the lectern, the board) is drawn: on a tall stage it stands nearer. */
  readonly near: number
  readonly moon: Point
  /** How far down the stars are. */
  readonly stars: number
  readonly paving: readonly number[]
  readonly labels: Readonly<Record<TrolleyChoice, Point>>
}

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: {
    viewBox: '40 40 920 480',
    horizon: 300,
    school: { x: 300, y: 350 },
    fence: { from: 66, to: 534 },
    students: { xs: [168, 214, 386, 432, 478], y: 466, from: -540, away: [70, 118, 484, 526, 562] },
    minister: { x: 578, y: 466 },
    lectern: { x: 638, y: 466 },
    board: { x: 812, y: 466, legs: 88 },
    unknown: { x: 916, y: 466 },
    near: 1,
    moon: { x: 876, y: 104 },
    stars: 0,
    paving: [362, 384, 410, 440, 474, 512],
    labels: { pull: { x: 538, y: 322 }, stay: { x: 682, y: 322 } },
  },
  tall: {
    viewBox: '150 60 500 640',
    horizon: 286,
    school: { x: 400, y: 330 },
    fence: { from: 170, to: 630 },
    students: { xs: [262, 306, 494, 538, 582], y: 446, from: -480, away: [196, 234, 560, 598, 634] },
    minister: { x: 214, y: 664 },
    lectern: { x: 281, y: 664 },
    board: { x: 502, y: 664, legs: 70 },
    unknown: { x: 610, y: 664 },
    near: 1.12,
    moon: { x: 590, y: 124 },
    stars: 34,
    paving: [344, 366, 392, 422, 456, 494, 536, 582, 632, 688],
    labels: { pull: { x: 344, y: 488 }, stay: { x: 300, y: 530 } },
  },
}

const docAt = (L: Layout): Point => ({ x: L.lectern.x, y: round2(L.lectern.y + DOC_Y * L.near) })
/** The stamp lands across the foot of the reform, clear of the minister's face. */
const stampAt = (L: Layout, scale: number): string =>
  `translate(${round2(L.lectern.x + 14 * L.near)} ${round2(L.lectern.y + (DOC_Y + 6) * L.near)}) rotate(-12) scale(${round2(STAMP_SCALE * L.near * scale)})`
const figureOf = (holder: Element | null): Element | null => holder?.querySelector('.atp-m-figure') ?? null

interface Nodes {
  readonly root: SVGGElement
  readonly camera: SVGGElement | null
  readonly pen: SVGGElement | null
  readonly signature: SVGGElement | null
  readonly seal: SVGGElement | null
  readonly ring: SVGGElement | null
  readonly stamp: SVGGElement | null
  readonly lock: SVGGElement | null
  readonly gates: readonly SVGGElement[]
  readonly bell: SVGGElement | null
  readonly peal: SVGGElement | null
  readonly lights: readonly SVGGElement[]
  readonly spill: SVGGElement | null
  readonly pupils: SVGGElement | null
  readonly students: readonly SVGGElement[]
  readonly tip: SVGGElement | null
  readonly dot: SVGGElement | null
  readonly area: SVGGElement | null
  readonly blip: SVGGElement | null
  readonly unknown: SVGGElement | null
  readonly labels: SVGGElement | null
}

function gather(root: SVGGElement): Nodes {
  return {
    root,
    camera: part(root, 'camera'),
    pen: part(root, 'pen'),
    signature: part(root, 'signature'),
    seal: part(root, 'seal'),
    ring: part(root, 'seal-ring'),
    stamp: part(root, 'stamp'),
    lock: part(root, 'lock'),
    gates: parts(root, 'gate'),
    bell: part(root, 'bell'),
    peal: part(root, 'peal'),
    lights: parts(root, 'window-light'),
    spill: part(root, 'spill'),
    pupils: part(root, 'pupils'),
    students: parts(root, 'student'),
    tip: part(root, 'chart-tip'),
    dot: part(root, 'chart-dot'),
    area: part(root, 'chart-area'),
    blip: part(root, 'chart-blip'),
    unknown: part(root, 'unknown'),
    labels: part(root, 'labels'),
  }
}

/** Puts the chart's last point `v` of the way up its rise. */
function chartTo(n: Nodes, v: number): void {
  const y = round2(LAST.y - RISE * v)
  setAttr(n.tip, 'y2', y)
  setAttr(n.dot, 'cy', y)
  setAttr(n.area, 'd', chartArea(y))
}

async function arrive(n: Nodes, L: Layout, timeline: Timeline, turn: Turn): Promise<void> {
  const mine = turn.current
  n.root.dataset.state = 'arriving'
  // The students come across the square to the locked gate.
  const { xs, y, from } = L.students
  await Promise.all(n.students.map((student, index) => walk(timeline, student, (xs[index] as number) + from, xs[index] as number, y, 1000 + index * 80)))
  // Cut short by an early choice, or by the scene going away (React mounts it twice in development).
  if (turn.current !== mine || timeline.finished) return
  n.root.dataset.state = 'waiting'
  await fade(timeline, n.labels, 1, 400)
}

/** The reform is signed, and sealed in mint. */
async function sign(n: Nodes, timeline: Timeline, emit: Emit): Promise<void> {
  setAttr(n.pen, 'opacity', 1)
  await timeline.tween(
    560,
    (v) => {
      setAttr(n.signature, 'stroke-dashoffset', round2(1 - v))
      setAttr(n.pen, 'transform', `translate(${round2(-14 + 17 * v)} ${round2(18 - 4 * Math.abs(Math.sin(v * Math.PI * 4)))})`)
    },
    easeInOutCubic,
  )
  setAttr(n.pen, 'opacity', 0)
  emit('gavel')
  void timeline.tween(
    520,
    (v) => {
      setAttr(n.ring, 'opacity', round2(1 - v))
      setAttr(n.ring, 'transform', `${SEAL_AT} scale(${round2(0.6 + 1.8 * v)})`)
    },
    easeOutQuad,
  )
  await pop(timeline, n.seal, SEAL_AT, 340)
}

/** The school bell swings, and rings out over the square. */
function ring(n: Nodes, timeline: Timeline): Promise<void> {
  return timeline.tween(
    1400,
    (v) => {
      setAttr(n.bell, 'transform', `rotate(${round2(24 * Math.sin(v * Math.PI * 6) * (1 - v))})`)
      setAttr(n.peal, 'opacity', round2(Math.abs(Math.sin(v * Math.PI * 3)) * (1 - v)))
    },
    linear,
  )
}

/** The lock drops, the gate swings open, and the bell rings. */
async function unlock(n: Nodes, timeline: Timeline, emit: Emit): Promise<void> {
  void timeline.tween(
    320,
    (v) => {
      setAttr(n.lock, 'opacity', round2(1 - v))
      setAttr(n.lock, 'transform', `translate(0 ${round2(16 * v)})`)
    },
    easeInQuad,
  )
  await timeline.wait(160)
  emit('creak')
  await timeline.tween(
    600,
    (v) => {
      for (const gate of n.gates) setAttr(gate, 'transform', `scale(${round2(1 - 0.85 * v)} 1)`)
    },
    easeOutQuad,
  )
  emit('bell')
  void ring(n, timeline)
}

/** Jumps for joy, backpack and all. */
async function hop(timeline: Timeline, student: SVGGElement): Promise<void> {
  const figure = figureOf(student)
  if (!figure) return
  const body = part(figure, 'body')
  const gear = [part(student, 'pack'), part(student, 'straps')]
  // The backpack goes wherever the body does.
  const follow = (): void => {
    for (const node of gear) setAttr(node, 'transform', body?.getAttribute('transform') ?? 'translate(0 0)')
  }
  const jumping = cheer(timeline, figure)
  void timeline.tween(1000, follow, linear)
  await jumping
  follow()
}

/** Walks up to the open gate and through it, smaller with every step, into the light. */
function goIn(L: Layout, timeline: Timeline, student: SVGGElement, x: number, delay: number): Promise<void> {
  const { y } = L.students
  const gate = { x: L.school.x, y: L.school.y + YARD - 6 }
  return timeline.wait(delay).then(() =>
    timeline.tween(
      1100,
      (v) => {
        const bob = Math.abs(Math.sin(v * Math.PI * 6)) * 3
        setAttr(student, 'transform', transform(x + (gate.x - x) * v, y + (gate.y - y) * v - bob, 0, 1 - 0.4 * v))
        setAttr(student, 'opacity', round2(Math.min(1, (1 - v) / 0.3)))
      },
      linear,
    ),
  )
}

/** Wanders off across the square, slowly, and is gone. */
function driftOff(L: Layout, timeline: Timeline, student: SVGGElement, from: number, to: number, delay: number): Promise<void> {
  const { y } = L.students
  return timeline.wait(delay).then(() =>
    timeline.tween(
      1700,
      (v) => {
        setAttr(student, 'transform', transform(from + (to - from) * v, y - Math.abs(Math.sin(v * Math.PI * 5)) * 2))
        setAttr(student, 'opacity', round2(Math.min(1, (1 - v) / 0.45)))
      },
      linear,
    ),
  )
}

/** As foreseen: the statistics' last point creeps up, and one unknown life is lost to them, quietly. */
async function foresee(n: Nodes, timeline: Timeline, emit: Emit): Promise<void> {
  await timeline.tween(800, (v) => chartTo(n, v), easeInOutCubic)
  void timeline.tween(
    600,
    (v) => {
      setAttr(n.blip, 'opacity', round2(1 - v))
      setAttr(n.blip, 'transform', `translate(${LAST.x} ${LAST.y - RISE}) scale(${round2(0.6 + 1.4 * v)})`)
    },
    easeOutQuad,
  )
  emit('impact', { kind: 'person', how: 'flatline' })
  const figure = figureOf(n.unknown)
  if (figure) await lose(timeline, figure)
}

/** The shelving stamp comes down on the reform. */
function stampDown(L: Layout, timeline: Timeline, stamp: SVGGElement | null): Promise<void> {
  return timeline.tween(
    320,
    (v) => {
      setAttr(stamp, 'opacity', Math.min(1, round2(v * 2.5)))
      setAttr(stamp, 'transform', stampAt(L, 2.4 - 1.4 * v))
    },
    easeOutBack,
  )
}

async function run(n: Nodes, L: Layout, timeline: Timeline, choice: TrolleyChoice, emit: Emit, turn: Turn): Promise<void> {
  turn.current += 1
  timeline.skip()
  n.root.dataset.state = 'running'
  void fade(timeline, n.labels, 0, 200)
  const { xs, away } = L.students
  if (choice === 'pull') {
    await sign(n, timeline, emit)
    await unlock(n, timeline, emit)
    // The windows light up one after another, the door last, its light spilling out; the students cheer…
    emit('cheer')
    const door = n.lights.length - 1
    await Promise.all([
      ...n.lights.map((light, index) => timeline.wait(index * 110).then(() => fade(timeline, light, 1, 300))),
      timeline.wait(door * 110).then(() => fade(timeline, n.spill, 1, 700)),
      ...n.students.filter((_, index) => index % 2 === 0).map((student) => hop(timeline, student)),
    ])
    // …and go in, the nearest first.
    await Promise.all(n.students.map((student, index) => goIn(L, timeline, student, xs[index] as number, Math.abs((xs[index] as number) - L.school.x) * 2)))
    void fade(timeline, n.pupils, 1, 600)
    await timeline.wait(500)
    await foresee(n, timeline, emit)
  } else {
    // Shelved: the stamp comes down, the gate stays locked, and the students drift away.
    await stampDown(L, timeline, n.stamp)
    emit('gavel')
    void shake(timeline, n.camera, 4)
    await timeline.wait(350)
    await Promise.all(n.students.map((student, index) => driftOff(L, timeline, student, xs[index] as number, away[index] as number, index * 160)))
    const figure = figureOf(n.unknown)
    if (figure) calm(figure)
  }
  n.root.dataset.state = 'done'
}

function aftermath(n: Nodes, L: Layout, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  // Either way the students are gone: into the school, or home.
  for (const student of n.students) setAttr(student, 'opacity', 0)
  const figure = figureOf(n.unknown)
  if (choice === 'pull') {
    setAttr(n.signature, 'stroke-dashoffset', 0)
    setAttr(n.seal, 'opacity', 1)
    setAttr(n.seal, 'transform', SEAL_AT)
    setAttr(n.lock, 'opacity', 0)
    for (const gate of n.gates) setAttr(gate, 'transform', OPEN)
    for (const light of n.lights) setAttr(light, 'opacity', 1)
    setAttr(n.spill, 'opacity', 1)
    setAttr(n.pupils, 'opacity', 1)
    chartTo(n, 1)
    if (figure) lost(figure)
  } else {
    setAttr(n.stamp, 'opacity', 1)
    setAttr(n.stamp, 'transform', stampAt(L, 1))
    if (figure) calm(figure)
  }
}

/** The rooftops around the square, their feet on `foot`: a row of houses, no two quite alike, a light on here and there. */
function rooftops(foot: number): { readonly d: string; readonly lights: readonly Point[] } {
  let d = ''
  const lights: Point[] = []
  for (let x = -600, i = 0; x < 1600; i++) {
    const w = 46 + Math.round(Math.abs(Math.sin(i * 2.17)) * 44)
    const top = foot - 26 - Math.round(Math.abs(Math.sin(i * 1.31 + 0.6)) * 40)
    d += `M${x} ${foot}V${top}L${x + Math.round(w / 2)} ${top - 16}L${x + w} ${top}V${foot}Z`
    if (i % 2 === 0) d += `M${x + Math.round(w * 0.7)} ${top - 4}V${top - 20}h7V${top - 4}Z`
    if (i % 3 === 1) lights.push({ x: x + Math.round(w * 0.3), y: top + 12 })
    x += w + 6
  }
  return { d, lights }
}

/** The town square at night: sky, moon, the rooftops around it, and its paving. */
function Square({ id, L }: { readonly id: string; readonly L: Layout }) {
  const { horizon, moon } = L
  const roofs = rooftops(horizon)
  return (
    <g aria-hidden="true">
      <rect x="-2000" y="-2000" width="5000" height={2000 + horizon + 2} fill={`url(#${id}-sky)`} />
      <g transform={`translate(0 ${L.stars})`}>
        <Stars />
      </g>
      <circle cx={moon.x} cy={moon.y} r="86" fill={`url(#${id}-moon)`} />
      <circle cx={moon.x} cy={moon.y} r="24" fill="#fff3cf" />
      <circle cx={moon.x - 8} cy={moon.y - 6} r="4.5" fill="#f0dfae" />
      <circle cx={moon.x + 8} cy={moon.y + 8} r="3" fill="#f0dfae" />
      <path d={roofs.d} fill="#0e1f42" />
      {roofs.lights.map(({ x, y }) => (
        <rect key={x} x={x} y={y} width="5" height="6" rx="1" fill="#ffd36b" opacity="0.7" />
      ))}
      <rect x="-2000" y={horizon} width="5000" height="2400" fill={`url(#${id}-paving)`} />
      <g fill="#1f3a63" opacity="0.5">
        {L.paving.map((y, row) =>
          Array.from({ length: 18 }, (_, i) => <rect key={`${y}-${i}`} x={-60 + i * 64 + (row % 2) * 32} y={y} width="44" height="3" rx="1.5" />),
        )}
      </g>
    </g>
  )
}

/** A window's glass: a rectangle, or round-headed with `arch`, `inset` bigger all round. */
function pane(x: number, y: number, w: number, h: number, arch: boolean, inset: number): string {
  if (!arch) return `M${x - inset} ${y - inset}h${w + 2 * inset}v${h + 2 * inset}h${-w - 2 * inset}Z`
  return `M${x - inset} ${y + h + inset}V${y + w / 2}a${w / 2 + inset} ${w / 2 + inset} 0 0 1 ${w + 2 * inset} 0V${y + h + inset}Z`
}

/** A window, dark for the night until its light comes on. */
function Window({ id, x, y, w = 24, h = 32, arch = false }: { readonly id: string; readonly x: number; readonly y: number; readonly w?: number; readonly h?: number; readonly arch?: boolean }) {
  return (
    <g>
      <path d={pane(x, y, w, h, arch, 3)} fill="#c9b896" />
      <path d={pane(x, y, w, h, arch, 0)} fill="#0a1730" />
      <g data-part="window-light" opacity="0">
        <rect x={x - 7} y={y - 7} width={w + 14} height={h + 14} rx="8" fill="#ffd36b" opacity="0.14" />
        <path d={pane(x, y, w, h, arch, 0)} fill={`url(#${id}-lit)`} />
      </g>
      <path d={`M${x + w / 2} ${y + 1}V${y + h}M${x} ${y + Math.round(h * 0.45)}H${x + w}`} stroke="#c9b896" strokeWidth="2" />
      <rect x={x - 5} y={y + h + 2} width={w + 10} height="4" rx="1.5" fill="#d8c9a6" />
    </g>
  )
}

/** The order the windows light up in: along the ground floor, back along the first, the middle one, then the door. */
const WINDOWS: readonly (readonly [number, number])[] = [
  [-136, -52],
  [-94, -52],
  [70, -52],
  [112, -52],
  [112, -100],
  [70, -100],
  [-94, -100],
  [-136, -100],
]

/** Someone inside, against a lit window, at (x, y): head and shoulders, maybe a hand up. */
const pupil = (x: number, y: number, hand: boolean): string =>
  `M${x - 9} ${y + 11}q0 -8 9 -8q9 0 9 8zM${x} ${y - 5}a5 5 0 1 0 0.01 0z${hand ? `M${x + 5} ${y + 4}l2 -14a1.6 1.6 0 0 1 3 0.5l-2 14z` : ''}`

/** The school, its foot centred on (0, 0): brick wings, a pediment with a clock, a bell in its tower. */
function School({ id }: { readonly id: string }) {
  return (
    <g aria-hidden="true">
      {/* The bell tower, behind the pediment, and its bell. */}
      <rect x="-16" y="-214" width="32" height="60" fill="#cdbf9f" />
      <rect x="-16" y="-214" width="6" height="60" fill="#ffffff" opacity="0.12" />
      <path d="M-10 -180V-198a10 10 0 0 1 20 0V-180Z" fill="#0a1730" />
      <g transform="translate(0 -205)">
        <g data-part="bell">
          <rect x="-1" y="0" width="2" height="4" fill="#8a7f6a" />
          <path d="M-7.5 16q-0.5 -12 7.5 -12q8 0 7.5 12l2 2.5h-19z" fill="#e0b354" />
          <circle cx="0" cy="20" r="2.2" fill="#c9a36b" />
        </g>
      </g>
      <g data-part="peal" opacity="0" fill="none" stroke="#fbefd6" strokeWidth="2" strokeLinecap="round">
        <path d="M-25 -202q-6 8 0 16M-33 -207q-9 13 0 26M25 -202q6 8 0 16M33 -207q9 13 0 26" />
      </g>
      <rect x="-20" y="-219" width="40" height="6" rx="2" fill="#d8c9a6" />
      <path d="M-21 -219L0 -241L21 -219Z" fill="#2a3550" />
      <circle cx="0" cy="-243" r="2.6" fill="#e0b354" />

      {/* The wings under their slate roofs, and the middle under its pediment. */}
      <path d="M-160 -116L-148 -132H0V-116ZM160 -116L148 -132H0V-116Z" fill="#22304f" />
      <rect x="-152" y="-118" width="304" height="118" fill="#5b3a40" />
      <rect x="-156" y="-122" width="312" height="6" rx="2" fill="#c9b896" />
      <rect x="-54" y="-138" width="108" height="138" fill="#69423f" />
      <path d="M-152 -116V0M152 -116V0M-54 -136V0M54 -136V0" stroke="#c9b896" strokeWidth="6" opacity="0.85" />
      <rect x="-60" y="-142" width="120" height="6" rx="2" fill="#d8c9a6" />
      <path d="M-63 -142L0 -186L63 -142Z" fill="#d8c9a6" />
      <path d="M-48 -146L0 -179L48 -146Z" fill="#b9aa8a" />
      <circle cx="0" cy="-158" r="10" fill="#f4ecd8" stroke="#7a6a4c" strokeWidth="2" />
      <path d="M0 -158V-165M0 -158l-5 3" stroke="#1b2d55" strokeWidth="2" strokeLinecap="round" />
      <rect x="-154" y="-10" width="308" height="10" fill="#7d7363" />

      {WINDOWS.map(([x, y]) => (
        <Window key={`${x},${y}`} id={id} x={x} y={y} />
      ))}
      <Window id={id} x={-13} y={-114} w={26} h={36} arch />
      {/* The door, lit last, ready for the students. */}
      <path d="M-18 0V-34a18 18 0 0 1 36 0V0Z" fill="#c9b896" />
      <path d="M-14 0V-34a14 14 0 0 1 28 0V0Z" fill="#4a2c24" />
      <path d="M0 -48V0" stroke="#2e1b16" strokeWidth="2" />
      <circle cx="-3.5" cy="-20" r="1.6" fill="#e0b354" />
      <circle cx="3.5" cy="-20" r="1.6" fill="#e0b354" />
      <g data-part="window-light" opacity="0">
        <path d="M-14 0V-34a14 14 0 0 1 28 0V0Z" fill={`url(#${id}-lit)`} />
      </g>
      <rect x="-24" y="0" width="48" height="4" fill="#a89a7e" />
      <rect x="-30" y="4" width="60" height="4" fill="#958870" />

      {/* Those inside, once it has filled. */}
      <path data-part="pupils" opacity="0" fill="#a35d24" d={`${pupil(-124, -31, false)}${pupil(-82, -31, true)}${pupil(124, -31, false)}${pupil(82, -79, false)}`} />

      {/* Light from the open door, down the path and through the gate. */}
      <g data-part="spill" opacity="0">
        <path d={`M-16 8H16L46 ${YARD}H-46Z`} fill={`url(#${id}-spill)`} />
        <ellipse cx="0" cy={YARD + 10} rx="96" ry="18" fill={`url(#${id}-pool)`} />
      </g>
    </g>
  )
}

/** One leaf of the iron gate, hinged on its left at (0, 0) and 48 wide, rising to meet the other in the middle. */
function Leaf() {
  const top = (x: number): number => Math.round(-64 - 10 * (x / 48) ** 2)
  return (
    <g fill="#4a5774">
      <rect x="0" y="-66" width="4" height="62" rx="1.5" />
      <rect x="44" y="-76" width="4" height="72" rx="1.5" />
      {[10, 18, 26, 34].map((x) => (
        <path key={x} d={`M${x - 1.5} -6V${top(x)}l1.5 -5l1.5 5V-6Z`} />
      ))}
      <path d="M2 -63Q28 -64 46 -74" fill="none" stroke="#4a5774" strokeWidth="3.5" />
      <rect x="0" y="-40" width="48" height="3.5" rx="1.5" />
      <rect x="0" y="-11" width="48" height="4" rx="1.5" />
      <circle cx="24" cy="-24" r="6" fill="none" stroke="#4a5774" strokeWidth="2.5" />
    </g>
  )
}

/** The railings along the front of the school, from `from` to `to` either side of their gate (its foot centred on 0, 0), locked. */
function Railings({ from, to }: { readonly from: number; readonly to: number }) {
  const pickets: number[] = []
  for (let x = from + 12; x < to - 8; x += 11) if (Math.abs(x) > 70) pickets.push(x)
  const post = (x: number, height: number) => (
    <g key={x}>
      <rect x={x - 8} y={-height} width="16" height={height + 2} fill="#8a8070" />
      <rect x={x - 8} y={-height} width="4" height={height + 2} fill="#ffffff" opacity="0.12" />
      <rect x={x - 11} y={-height - 6} width="22" height="7" rx="2" fill="#b5a687" />
      <circle cx={x} cy={-height - 11} r="5" fill="#b5a687" />
    </g>
  )
  return (
    <g aria-hidden="true">
      <rect x={from} y="-7" width={to - from} height="9" fill="#3a4157" />
      <rect x={from} y="-7" width={to - from} height="2" fill="#566079" />
      <g fill="#3b4664">
        {pickets.map((x) => (
          <path key={x} d={`M${x - 1.75} -6V-42l1.75 -6l1.75 6V-6Z`} />
        ))}
      </g>
      <path d={`M${from} -38H-62M62 -38H${to}M${from} -14H-62M62 -14H${to}`} stroke="#2a3550" strokeWidth="3" />
      {post(from, 58)}
      {post(to, 58)}
      {post(-56, 86)}
      {post(56, 86)}
      {[-1, 1].map((side) => (
        <g key={side} transform={`translate(${side * 48} 0)`}>
          <g data-part="gate">
            <g transform={side < 0 ? undefined : 'scale(-1 1)'}>
              <Leaf />
            </g>
          </g>
        </g>
      ))}
      <g data-part="lock">
        <path d="M-11 -41h22" stroke="#8a94a6" strokeWidth="2.5" strokeDasharray="3 2" />
        <path d="M-3.2 -36v-3.5a3.2 3.2 0 0 1 6.4 0v3.5" fill="none" stroke="#c9a36b" strokeWidth="2.2" />
        <rect x="-5.5" y="-36" width="11" height="10" rx="2" fill="#e0b354" />
        <circle cx="0" cy="-31.5" r="1.4" fill="#5a3b2a" />
      </g>
    </g>
  )
}

/** The statistics board on its stand, its foot on (0, 0), its frame `legs` up: a chart that rises, gently, dot by dot. */
function Board({ title, legs }: { readonly title: string; readonly legs: number }) {
  const before = CHART[3]
  return (
    <g aria-hidden="true">
      <ellipse className="atp-m-shadow" cx="0" cy="1" rx="54" ry="4" />
      <path d={`M0 ${-legs - 4}V-2`} stroke="#1f2a42" strokeWidth="4" strokeLinecap="round" />
      <path d={`M-36 ${-legs - 4}L-47 0M36 ${-legs - 4}L47 0`} stroke="#3b4664" strokeWidth="5" strokeLinecap="round" />
      <path d={`M-42 ${Math.round(-legs / 2)}H42`} stroke="#3b4664" strokeWidth="3" />
      <g transform={`translate(0 ${88 - legs})`}>
        <rect x="-66" y="-186" width="132" height="98" rx="8" fill="#2c4a66" />
        <rect x="-60" y="-180" width="120" height="86" rx="5" fill="#0d1a2c" />
        <text y="-166" textAnchor="middle" className="atp-m-school-title">
          {title}
        </text>
        <path d="M-50 -159H50" stroke="#1b3445" strokeWidth="1.5" />
        <path d="M-46 -142H52M-46 -126H52M-46 -110H52" stroke="#1b3445" strokeWidth="1" strokeDasharray="3 3" />
        <path d={`M-46 -150V${AXIS}H54`} fill="none" stroke="#5d6f8c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path data-part="chart-area" d={chartArea(LAST.y)} fill="#8fc4ff" opacity="0.14" />
        <path
          d={CHART.slice(0, 4)
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
            .join('')}
          fill="none"
          stroke="#8fc4ff"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <line data-part="chart-tip" x1={before.x} y1={before.y} x2={LAST.x} y2={LAST.y} stroke="#8fc4ff" strokeWidth="2.4" strokeLinecap="round" />
        <g fill="#8fc4ff" stroke="#0d1a2c" strokeWidth="1.5">
          {CHART.slice(0, 4).map((point) => (
            <circle key={point.x} cx={point.x} cy={point.y} r="3" />
          ))}
          <circle data-part="chart-dot" cx={LAST.x} cy={LAST.y} r="3.4" />
        </g>
        <circle data-part="chart-blip" r="6" fill="none" stroke="#8fc4ff" strokeWidth="2" opacity="0" transform={`translate(${LAST.x} ${LAST.y})`} />
      </g>
    </g>
  )
}

/** The reform: a page of it, a line to sign, and a place for the seal (its middle on 0, 0). */
function Bill() {
  return (
    <g>
      <rect x="-18" y="-23" width="40" height="50" rx="3" fill="#000000" opacity="0.25" />
      <rect x="-20" y="-25" width="40" height="50" rx="3" fill="#fbefd6" />
      <g fill="#2b3f73">
        <path d="M-8 -15l8 -4l8 4l-8 4z" />
        <path d="M-4.5 -13.3v3.3q4.5 2.6 9 0v-3.3l-4.5 2.3z" />
      </g>
      <path d="M8 -15v5" stroke="#c9a36b" strokeWidth="1.2" />
      <path d="M-14 -3H14M-14 2H10M-14 7H14M-14 12H4" stroke="#d9cbae" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M-15 21H3" stroke="#a89a7e" strokeWidth="1" />
      <path
        data-part="signature"
        d="M-14 18c2 -7 4 -7 4 -2s2 3 4 -2s3 -4 3 0s3 2 6 -2"
        fill="none"
        stroke="#2b3f73"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset="1"
      />
      <circle cx="12" cy="17" r="6" fill="none" stroke="#c9a36b" strokeWidth="1.2" strokeDasharray="2 2" />
      <g data-part="seal" opacity="0" transform={SEAL_AT}>
        <path d="M-4 3l-3 9l3 -2l2 3l1 -8zM4 3l3 9l-3 -2l-2 3l-1 -8z" fill="#3fb58a" />
        <circle r="7" fill="#7fe3b8" />
        <circle r="5" fill="none" stroke="#3fb58a" strokeWidth="1" />
        <path d="M-2.8 0.2l2 2l3.8 -4" fill="none" stroke="#0d2a1e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle data-part="seal-ring" r="9" fill="none" stroke="#7fe3b8" strokeWidth="2.5" opacity="0" transform={SEAL_AT} />
      <g data-part="pen" opacity="0" transform="translate(-14 18)">
        <path d="M0 0l2 -6l17 -17l4 4l-17 17z" fill="#2a3550" />
        <path d="M0 0l2 -6l4 4z" fill="#e0b354" />
      </g>
    </g>
  )
}

/** The minister's lectern, its foot on (0, 0), with the reform propped on it. */
function Lectern() {
  return (
    <g>
      <ellipse className="atp-m-shadow" cx="0" cy="1" rx="24" ry="4" />
      <path d="M-15 0L-11 -46H11L15 0Z" fill="#5a3b2a" />
      <path d="M-9 -8L-7 -40H7L9 -8Z" fill="#6b4632" />
      <g transform="translate(0 -25)" fill="#c9a36b">
        <path d="M-7 -1.5l7 -3.5l7 3.5l-7 3.5z" />
        <path d="M-4 0.5v3q4 2.2 8 0v-3l-4 2z" />
      </g>
      <rect x="-20" y="-4" width="40" height="4" rx="2" fill="#4a2f22" />
      <rect x="-25" y="-53" width="50" height="8" rx="2.5" fill="#7a5434" />
      <rect x="-25" y="-53" width="50" height="2.5" rx="1.25" fill="#9a6e45" />
      <g transform={`translate(0 ${DOC_Y}) rotate(-4)`}>
        <Bill />
      </g>
    </g>
  )
}

export function SchoolScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, L })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)
  const unknown = useMemo(() => {
    const actor = dilemma.trackB.find(isPerson)
    return actor ? foreseen(actor) : undefined
  }, [dilemma])

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
    else void arrive(nodes, latest.current.L, timeline, turn)
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
  const opened = opening !== null
  const doc = docAt(L)
  const shelved = FOOT_UI.shelved[lang]
  // Wide enough for the stamp's heavy, spaced capitals.
  const stampWidth = Math.round(shelved.length * 16 + 26)
  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.schoolLabel[lang]}>
      <defs>
        <linearGradient id={`${id}-sky`} gradientUnits="userSpaceOnUse" x1="0" y1={L.horizon - 320} x2="0" y2={L.horizon}>
          <stop offset="0" stopColor="#050c1f" />
          <stop offset="0.6" stopColor="#0c1c3f" />
          <stop offset="1" stopColor="#1d3768" />
        </linearGradient>
        <linearGradient id={`${id}-paving`} gradientUnits="userSpaceOnUse" x1="0" y1={L.horizon} x2="0" y2={L.horizon + 300}>
          <stop offset="0" stopColor="#172d52" />
          <stop offset="1" stopColor="#0b1a3a" />
        </linearGradient>
        <radialGradient id={`${id}-moon`}>
          <stop offset="0" stopColor="#fff3cf" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff3cf" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-lit`} cx="0.5" cy="0.6" r="0.75">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset="1" stopColor="#ffd36b" />
        </radialGradient>
        <linearGradient id={`${id}-spill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.42" />
          <stop offset="1" stopColor="#ffd36b" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id={`${id}-pool`}>
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          <Square id={id} L={L} />
          <g transform={transform(L.school.x, L.school.y)}>
            <School id={id} />
          </g>
          <g transform={transform(L.school.x, L.school.y + YARD)}>
            <Railings from={L.fence.from - L.school.x} to={L.fence.to - L.school.x} />
          </g>

          {/* The statistics, and beside them the one they foresee: nobody yet. */}
          <g transform={transform(L.board.x, L.board.y, 0, L.near)}>
            <Board title={FOOT_UI.statistics[lang]} legs={L.board.legs} />
          </g>
          {unknown && (
            <g data-part="unknown" transform={transform(L.unknown.x, L.unknown.y, 0, L.near)} opacity="0.55">
              <Figure actor={unknown} youLabel={you} delay={0.6} />
            </g>
          )}

          {STUDENTS.map(({ look, pack, strap }, index) => {
            const x = L.students.xs[index] as number
            return (
              <g key={x} data-part="student" transform={transform(opened ? x : x + L.students.from, L.students.y)}>
                <g transform={`scale(${STUDENT_SCALE})`}>
                  <rect data-part="pack" x="-19" y="-61" width="38" height="34" rx="10" fill={pack} />
                  <Figure actor={look} youLabel={you} delay={index * 0.41} />
                  <path data-part="straps" d="M-8 -52q-1 10 0 19M8 -52q1 10 0 19" fill="none" stroke={strap} strokeWidth="3" strokeLinecap="round" />
                </g>
              </g>
            )
          })}

          {/* You, the minister, and the reform on your lectern. */}
          <g transform={transform(L.minister.x, L.minister.y, 0, L.near)}>
            <Figure actor={MINISTER} youLabel={you} delay={1.1} />
          </g>
          <g transform={transform(L.lectern.x, L.lectern.y, 0, L.near)}>
            <Lectern />
          </g>
          <g data-part="stamp" className="atp-m-stamp atp-m-school-shelved" opacity="0" transform={stampAt(L, 1)}>
            <rect x={-stampWidth / 2} y="-19" width={stampWidth} height="34" rx="5" />
            <text y="6.5" textAnchor="middle">
              {shelved}
            </text>
          </g>

          <g data-part="labels" opacity="0">
            <Pill x={L.labels.pull.x} y={L.labels.pull.y} text={dilemma.verbs?.pull[lang] ?? UI.pull[lang]} tone="pull" />
            <Pill x={L.labels.stay.x} y={L.labels.stay.y} text={dilemma.verbs?.stay?.[lang] ?? UI.stay[lang]} tone="stay" />
          </g>

          <circle className="atp-m-hint" cx={doc.x} cy={doc.y} r="28" />
          <circle
            className="atp-m-hotspot"
            cx={doc.x}
            cy={doc.y}
            r="42"
            aria-hidden="true"
            onClick={() => {
              if (interactive) onLever?.('pull')
            }}
          />
        </g>
      </g>
    </svg>
  )
}
