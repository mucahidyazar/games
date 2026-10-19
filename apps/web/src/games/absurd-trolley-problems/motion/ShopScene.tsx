import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CLOTH, HAIR, person, SKIN } from '../content/cast'
import { FOOT_UI, UI } from '../content/strings'
import type { PersonActor, TrolleyChoice } from '../content/types'
import { calm, fade, lose, lost, part, parts, setArms, walk, walkTo } from './acting'
import { easeInOutCubic, easeInQuad, easeOutBack, easeOutQuad, linear, round2, setAttr, Timeline, transform } from './animate'
import { Pill, Stars } from './Backdrop'
import { Figure } from './figures'
import { FIGURE, type Point } from './geometry'
import { emitter, isPerson, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * Philippa Foot's merchants, in motion: a grocer's shop at night, its back
 * room full of cooking oil you know is poisonous, and five customers queuing
 * on the pavement with their baskets. Sell it, and they take it home to cook
 * with; pour it away, and the shop goes under.
 */

/** You, the grocer: a cream shirt, with a brown apron drawn over it. */
const MERCHANT = person({ top: '#f4efe4', bottom: CLOTH.charcoal, skin: SKIN.medium, hair: 'short', hairColor: HAIR.black, accessories: ['mustache'], marker: 'you' })
const MERCHANT_DELAY = 0.9
/** The barrel you can tip: its size, and how far over it goes (about its bottom left corner). */
const BARREL = { w: 56, h: 76 } as const
const TIP = -46
/** How dark the shop gets once it has shut. */
const DIM = 0.62

const HOUSES = [
  { wall: '#3a4562', roof: '#8c3b3b' },
  { wall: '#2f3a57', roof: '#5b4a7a' },
  { wall: '#40496a', roof: '#a0522d' },
  { wall: '#333d5c', roof: '#3f6b5a' },
  { wall: '#3b4566', roof: '#7a4a6a' },
] as const

/** What stands on the shelves, in turn, and the colours of the tins and packets. */
const GOODS = ['tin', 'bottle', 'tin', 'jar', 'box', 'bottle', 'tin', 'tin', 'jar', 'bottle', 'box'] as const
const PACKS = ['#d9473f', '#2bb3a3', '#f2c14e', '#efece4', '#3a6fd8', '#8c5bd6', '#3fb56b'] as const

/** The shop, the street and the houses up the steps, on a wide stage or a tall one. */
interface Layout {
  readonly viewBox: string
  /** The building's outer walls, and the top of its cornice. */
  readonly shop: { readonly x0: number; readonly x1: number; readonly top: number }
  /** The cut-away front: the back room from x0 to the partition, the shop from there to x1, and the door after it. */
  readonly room: { readonly x0: number; readonly x1: number; readonly partition: number; readonly door: number }
  /** The shop floor (the grocer's feet), and the pavement from the shop's step to the kerb. */
  readonly floor: number
  readonly pavement: { readonly top: number; readonly kerb: number }
  readonly merchant: number
  readonly counter: { readonly x0: number; readonly x1: number }
  readonly shelves: readonly number[]
  /** The bottom left corner of the barrel that tips, the one behind it, and the drain the oil runs to. */
  readonly barrel: number
  readonly spare: number
  readonly drain: number
  /** Where each of the queue stands, front first, and how far off they shuffle in from. */
  readonly spots: readonly number[]
  readonly queueY: number
  readonly shuffleFrom: number
  /** The steps up to the houses: their middle, where a walker sets off up them, and how wide they are at the foot. */
  readonly stairs: { readonly x: number; readonly foot: number; readonly width: number }
  /** The rise the houses stand on: where it starts, and its top. */
  readonly hill: { readonly x0: number; readonly top: number }
  /** Each customer's front door (the first served lives furthest off), how small they are up there, and how big the houses are. */
  readonly homes: readonly number[]
  readonly homeScale: number
  readonly house: { readonly w: number; readonly h: number; readonly roof: number }
  /** The far hills, the moon, and where the two choices are written. */
  readonly far: string
  readonly moon: Point & { readonly r: number }
  readonly labels: Readonly<Record<TrolleyChoice, Point>>
}

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: {
    viewBox: '40 40 920 480',
    shop: { x0: 66, x1: 604, top: 100 },
    room: { x0: 88, x1: 540, partition: 238, door: 548 },
    floor: 404,
    pavement: { top: 412, kerb: 480 },
    merchant: 410,
    counter: { x0: 300, x1: 522 },
    shelves: [236, 274, 312],
    barrel: 154,
    spare: 98,
    drain: 120,
    spots: [668, 724, 780, 836, 892],
    queueY: 464,
    shuffleFrom: 60,
    stairs: { x: 632, foot: 416, width: 40 },
    hill: { x0: 606, top: 346 },
    homes: [924, 864, 804, 744, 684],
    homeScale: 0.64,
    house: { w: 54, h: 68, roof: 20 },
    far: 'M560 350Q650 250 760 272T960 258T1160 274V350Z',
    moon: { x: 890, y: 100, r: 22 },
    labels: { pull: { x: 496, y: 300 }, stay: { x: 160, y: 446 } },
  },
  tall: {
    viewBox: '150 60 500 640',
    shop: { x0: 160, x1: 598, top: 316 },
    room: { x0: 174, x1: 542, partition: 314, door: 548 },
    floor: 572,
    pavement: { top: 580, kerb: 656 },
    merchant: 428,
    counter: { x0: 340, x1: 524 },
    shelves: [448, 482, 516],
    barrel: 232,
    spare: 180,
    drain: 190,
    spots: [572, 518, 464, 410, 356],
    queueY: 640,
    shuffleFrom: -60,
    stairs: { x: 624, foot: 584, width: 42 },
    hill: { x0: -2000, top: 264 },
    homes: [212, 290, 368, 446, 524],
    homeScale: 0.56,
    house: { w: 58, h: 56, roof: 18 },
    far: 'M-200 268Q0 170 200 196T600 180T1000 200V268Z',
    moon: { x: 596, y: 112, r: 18 },
    labels: { pull: { x: 500, y: 450 }, stay: { x: 240, y: 616 } },
  },
}

interface Nodes {
  readonly root: SVGGElement
  readonly merchant: SVGGElement | null
  readonly barrel: SVGGElement | null
  readonly pour: readonly SVGGElement[]
  readonly flow: SVGGElement | null
  readonly puddles: readonly SVGGElement[]
  readonly sign: SVGGElement | null
  readonly signOpen: SVGGElement | null
  readonly signClosed: SVGGElement | null
  readonly doorbell: SVGGElement | null
  readonly dim: SVGGElement | null
  readonly spill: SVGGElement | null
  readonly bottle: SVGGElement | null
  readonly coin: SVGGElement | null
  readonly glint: SVGGElement | null
  readonly labels: SVGGElement | null
  readonly customers: readonly SVGGElement[]
  readonly lights: readonly SVGGElement[]
}

function gather(root: SVGGElement): Nodes {
  return {
    root,
    merchant: part(root, 'merchant'),
    barrel: part(root, 'barrel'),
    pour: parts(root, 'pour'),
    flow: part(root, 'flow'),
    puddles: parts(root, 'puddle'),
    sign: part(root, 'sign'),
    signOpen: part(root, 'sign-open'),
    signClosed: part(root, 'sign-closed'),
    doorbell: part(root, 'doorbell'),
    dim: part(root, 'dim'),
    spill: part(root, 'spill'),
    bottle: part(root, 'bottle'),
    coin: part(root, 'coin'),
    glint: part(root, 'glint'),
    labels: part(root, 'labels'),
    customers: parts(root, 'customer'),
    lights: parts(root, 'home-light'),
  }
}

const figureOf = (holder: Element | null): Element | null => holder?.querySelector('.atp-m-figure') ?? null
const counterTop = (L: Layout): number => L.floor - 30
const canX = (L: Layout): number => L.counter.x1 - 48
const tillOf = (L: Layout): Point => ({ x: L.counter.x1 - 17, y: counterTop(L) - 12 })
/** Where the grocer stands behind the counter: up on a step, so the customers can see them. */
const behindCounter = (L: Layout): Point => ({ x: L.merchant, y: L.floor - 6 })
/** The grocer's right hand, held out over the counter. */
const handOf = (L: Layout): Point => ({ x: L.merchant + 34, y: L.floor - 50 })
/** Where the grocer stands to tip the barrel: just to its right. */
const besideBarrel = (L: Layout): number => L.barrel + BARREL.w + 10
const tilt = (L: Layout, angle: number): string => `rotate(${round2(angle)} ${L.barrel} ${L.floor})`

/** How big someone is at height y: full size in the queue, smaller up by the houses. */
const depth = (L: Layout, y: number): number => round2(1 - ((L.queueY - y) / (L.queueY - L.hill.top)) * (1 - L.homeScale))

/** Where the basket hangs: from the right hand, upright, wherever the arm is. */
function basketAt(angle: number): string {
  const a = Math.round(angle * 10) / 10
  return `translate(${FIGURE.shoulderX} ${FIGURE.shoulderY}) rotate(${-a}) rotate(${a} 0 22)`
}

/** Raises one arm to `angle` degrees from hanging straight down. */
function lift(figure: Element, side: 'left' | 'right', angle: number): void {
  const s = side === 'left' ? -1 : 1
  setAttr(part(figure, `arm-${side}`), 'transform', `translate(${s * FIGURE.shoulderX} ${FIGURE.shoulderY}) rotate(${Math.round(-s * angle * 10) / 10})`)
}

/** Where the oil leaves the tipped barrel: its top left corner. */
function lip(L: Layout): Point {
  const a = (TIP * Math.PI) / 180
  const dx = 4
  const dy = -BARREL.h
  return { x: Math.round(L.barrel + dx * Math.cos(a) - dy * Math.sin(a)), y: Math.round(L.floor + dx * Math.sin(a) + dy * Math.cos(a)) }
}

/** The oil's way: out of the barrel, down to the floor, over the step and across the pavement into the drain. */
function pourPath(L: Layout): string {
  const from = lip(L)
  const { floor, drain } = L
  const { kerb } = L.pavement
  return `M${from.x} ${from.y}C${from.x - 10} ${from.y + 14} ${from.x - 8} ${floor - 24} ${from.x - 4} ${floor}L${from.x} ${floor + 12}Q${from.x + 6} ${kerb - 10} ${drain} ${kerb + 13}`
}

/** The queue shuffling up to the door, `v` of the way. */
function shuffleIn(n: Nodes, L: Layout, v: number): void {
  for (const [index, customer] of n.customers.entries()) {
    const p = Math.min(1, Math.max(0, (v - index * 0.08) / 0.68))
    const x = (L.spots[index] as number) + L.shuffleFrom * (1 - easeOutQuad(p))
    setAttr(customer, 'transform', transform(x, L.queueY - Math.abs(Math.sin(p * Math.PI * 3)) * 3))
  }
}

/** The bell over the door rings: a swing that dies away. */
const ring = (timeline: Timeline, bell: Element | null): Promise<void> =>
  timeline.tween(900, (v) => setAttr(bell, 'transform', `rotate(${Math.round(24 * Math.sin(v * Math.PI * 5) * (1 - v))})`), linear)

/** The queue steps up a place. */
const stepUp = (L: Layout, timeline: Timeline, waiting: readonly Element[]): Promise<unknown> =>
  Promise.all(waiting.map((customer, place) => walk(timeline, customer, L.spots[place + 1] as number, L.spots[place] as number, L.queueY, 420)))

/** The grocer hands something over the counter: right arm out, and back. */
const reach = (timeline: Timeline, figure: Element): Promise<void> =>
  timeline.tween(520, (v) => lift(figure, 'right', FIGURE.armRest + 72 * Math.sin(v * Math.PI)), linear)

/** A shrug: both hands up and out, and down again, the basket swinging with the right one. */
function shrug(timeline: Timeline, customer: Element): Promise<void> {
  const figure = figureOf(customer)
  const basket = part(customer, 'basket')
  return timeline.tween(
    620,
    (v) => {
      const angle = FIGURE.armRest + 40 * Math.sin(v * Math.PI)
      if (figure) setArms(figure, angle)
      setAttr(basket, 'transform', basketAt(angle))
    },
    linear,
  )
}

/** Something small thrown in a short arc: a bottle over the counter, a coin back. */
function toss(timeline: Timeline, node: Element | null, from: Point, to: Point, height: number, duration: number): Promise<void> {
  setAttr(node, 'opacity', 1)
  return timeline.tween(
    duration,
    (v) => {
      setAttr(node, 'transform', transform(from.x + (to.x - from.x) * v, from.y + (to.y - from.y) * v - height * 4 * v * (1 - v), 24 * Math.sin(v * Math.PI)))
      if (v >= 1) setAttr(node, 'opacity', 0)
    },
    easeInOutCubic,
  )
}

/** Paid: a coin back over the counter, and a glint as it drops in the till. */
async function pay(n: Nodes, L: Layout, timeline: Timeline): Promise<void> {
  const till = tillOf(L)
  await toss(timeline, n.coin, { x: (L.spots[0] as number) - 14, y: L.queueY - 32 }, till, 36, 340)
  await timeline.tween(
    380,
    (v) => {
      setAttr(n.glint, 'opacity', round2(1 - v))
      setAttr(n.glint, 'transform', `translate(${till.x} ${till.y - 6}) scale(${round2(0.4 + 0.8 * v)})`)
    },
    easeOutQuad,
  )
}

/** Walks a group along a path, bobbing, and smaller the further up the screen (the further off) it goes. */
function walkAlong(L: Layout, timeline: Timeline, node: Element, path: readonly Point[]): Promise<void> {
  const legs = path.slice(1).map((to, index) => Math.hypot(to.x - (path[index] as Point).x, to.y - (path[index] as Point).y))
  const total = legs.reduce((sum, leg) => sum + leg, 0)
  const bobs = Math.max(1, Math.round(total / 26))
  return timeline.tween(
    600 + total * 1.25,
    (v) => {
      let along = v * total
      let leg = 0
      while (leg < legs.length - 1 && along > (legs[leg] as number)) {
        along -= legs[leg] as number
        leg += 1
      }
      const from = path[leg] as Point
      const to = path[leg + 1] as Point
      const length = legs[leg] as number
      const t = length > 0 ? Math.min(1, along / length) : 1
      const y = from.y + (to.y - from.y) * t
      const scale = depth(L, y)
      setAttr(node, 'transform', transform(from.x + (to.x - from.x) * t, y - Math.abs(Math.sin(v * Math.PI * bobs)) * 3 * scale, 0, scale))
    },
    linear,
  )
}

/** Home from a place in the queue: over to the steps, up them, and along the top to their own front door. */
function walkHome(L: Layout, timeline: Timeline, customer: Element, from: number, index: number): Promise<void> {
  const { stairs, hill } = L
  return walkAlong(L, timeline, customer, [
    { x: from, y: L.queueY },
    { x: stairs.x, y: stairs.foot },
    { x: stairs.x, y: hill.top },
    { x: L.homes[index] as number, y: hill.top },
  ])
}

/** At home, the oil does its work: the lights go out, and they are lost. */
async function poisoned(n: Nodes, timeline: Timeline, customer: Element, index: number, emit: Emit): Promise<void> {
  emit('impact', { kind: 'person', how: 'flatline' })
  const figure = figureOf(customer)
  await Promise.all([fade(timeline, n.lights[index] ?? null, 0, 500), fade(timeline, part(customer, 'basket'), 0.5, 400), figure ? lose(timeline, figure) : undefined])
}

/** Nothing for sale: a shrug, home up the steps, and indoors. */
async function goHome(L: Layout, timeline: Timeline, customer: Element, index: number): Promise<void> {
  const figure = figureOf(customer)
  if (figure) calm(figure)
  await shrug(timeline, customer)
  await walkHome(L, timeline, customer, L.spots[index] as number, index)
  await fade(timeline, customer, 0, 300)
}

/** The sign on the door turns round: closed. */
async function flip(n: Nodes, timeline: Timeline): Promise<void> {
  await timeline.tween(220, (v) => setAttr(n.sign, 'transform', `scale(${round2(1 - v)} 1)`), easeInQuad)
  setAttr(n.signOpen, 'opacity', 0)
  setAttr(n.signClosed, 'opacity', 1)
  await timeline.tween(340, (v) => setAttr(n.sign, 'transform', `scale(${round2(v)} 1)`), easeOutBack)
}

async function arrive(n: Nodes, L: Layout, timeline: Timeline, emit: Emit, turn: Turn): Promise<void> {
  const mine = turn.current
  n.root.dataset.state = 'arriving'
  emit('bell')
  void ring(timeline, n.doorbell)
  await timeline.tween(1100, (v) => shuffleIn(n, L, v), linear)
  if (turn.current !== mine || timeline.finished) return
  n.root.dataset.state = 'waiting'
  await fade(timeline, n.labels, 1, 400)
}

/** Sell it: a bottle over the counter for each of the five, a coin back, and home they go. A little later, the lights go out. */
async function sell(n: Nodes, L: Layout, timeline: Timeline, emit: Emit): Promise<void> {
  const grocer = figureOf(n.merchant)
  const front = L.spots[0] as number
  const walks: Promise<void>[] = []
  for (const [index, customer] of n.customers.entries()) {
    emit('push')
    const handing = grocer ? reach(timeline, grocer) : Promise.resolve()
    const stepping = index > 0 ? stepUp(L, timeline, n.customers.slice(index)) : Promise.resolve()
    await timeline.wait(100)
    await toss(timeline, n.bottle, handOf(L), { x: front + 18, y: L.queueY - 30 }, 50, 400)
    await stepping
    setAttr(part(customer, 'bought'), 'opacity', 1)
    void pay(n, L, timeline)
    walks.push(walkHome(L, timeline, customer, front, index))
    await Promise.all([handing, timeline.wait(100)])
  }
  await Promise.all(walks)
  await timeline.wait(400)
  await Promise.all(n.customers.map((customer, index) => timeline.wait(index * 280).then(() => poisoned(n, timeline, customer, index, emit))))
}

/** Pour it away: into the back room, over goes the barrel, and the oil runs to the drain. The customers shrug and go home; the shop shuts. */
async function pourAway(n: Nodes, L: Layout, timeline: Timeline, emit: Emit): Promise<void> {
  const grocer = figureOf(n.merchant)
  await walkTo(timeline, n.merchant, behindCounter(L), { x: besideBarrel(L), y: L.floor }, 760)
  emit('push')
  if (grocer) void timeline.tween(820, (v) => lift(grocer, 'left', FIGURE.armRest + 76 * Math.sin(v * Math.PI)), linear)
  await timeline.wait(200)
  await timeline.tween(460, (v) => setAttr(n.barrel, 'transform', tilt(L, TIP * v)), easeInQuad)
  emit('splash')
  const leaving = n.customers.map((customer, index) => timeline.wait(300 + index * 340).then(() => goHome(L, timeline, customer, index)))
  void timeline.tween(1000, (v) => n.puddles.forEach((puddle) => setAttr(puddle, 'transform', `scale(${round2(v)})`)), easeOutQuad)
  await timeline.tween(900, (v) => n.pour.forEach((stream) => setAttr(stream, 'stroke-dashoffset', round2(100 * (1 - v)))), easeOutQuad)
  void fade(timeline, n.flow, 1, 300)
  await timeline.wait(300)
  emit('creak')
  await flip(n, timeline)
  await Promise.all([fade(timeline, n.dim, DIM, 700), fade(timeline, n.spill, 0, 700), ...leaving])
}

async function run(n: Nodes, L: Layout, timeline: Timeline, choice: TrolleyChoice, emit: Emit, turn: Turn): Promise<void> {
  turn.current += 1
  timeline.skip()
  n.root.dataset.state = 'running'
  void fade(timeline, n.labels, 0, 200)
  if (choice === 'pull') await sell(n, L, timeline, emit)
  else await pourAway(n, L, timeline, emit)
  n.root.dataset.state = 'done'
}

function aftermath(n: Nodes, L: Layout, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  for (const [index, customer] of n.customers.entries()) {
    setAttr(customer, 'transform', transform(L.homes[index] as number, L.hill.top, 0, L.homeScale))
    const figure = figureOf(customer)
    if (choice === 'pull') {
      setAttr(part(customer, 'bought'), 'opacity', 1)
      setAttr(part(customer, 'basket'), 'opacity', 0.5)
      if (figure) lost(figure)
    } else {
      // Indoors, safe, their lights still on.
      setAttr(customer, 'opacity', 0)
      if (figure) calm(figure)
    }
  }
  if (choice === 'pull') {
    for (const light of n.lights) setAttr(light, 'opacity', 0)
    return
  }
  setAttr(n.merchant, 'transform', transform(besideBarrel(L), L.floor))
  setAttr(n.barrel, 'transform', tilt(L, TIP))
  for (const stream of n.pour) setAttr(stream, 'stroke-dashoffset', 0)
  setAttr(n.flow, 'opacity', 1)
  for (const puddle of n.puddles) setAttr(puddle, 'transform', 'scale(1)')
  setAttr(n.signOpen, 'opacity', 0)
  setAttr(n.signClosed, 'opacity', 1)
  setAttr(n.dim, 'opacity', DIM)
  setAttr(n.spill, 'opacity', 0)
}

/**
 * A narrow house up the steps, its door at (x, base). Whoever lives there
 * stands in front of the door; the windows upstairs stay lit until they are lost.
 */
function House({ x, base, size, look }: { readonly x: number; readonly base: number; readonly size: Layout['house']; readonly look: (typeof HOUSES)[number] }) {
  const { w, h, roof } = size
  const top = base - h
  const windows = [x - 19, x + 6]
  const attic = { x, y: top - Math.round(roof * 0.4) }
  const pane = (wx: number, fill: string) => <rect key={wx} x={wx} y={top + 8} width="13" height="14" rx="2" fill={fill} />
  return (
    <g>
      <rect x={x + w / 2 - 15} y={top - roof + 2} width="8" height="16" fill={look.wall} />
      <rect x={x - w / 2} y={top} width={w} height={h} fill={look.wall} />
      <rect x={x - w / 2} y={top + h * 0.48} width={w} height="3" fill="#000000" opacity="0.15" />
      <path d={`M${x - w / 2 - 5} ${top + 2}L${x} ${top - roof}L${x + w / 2 + 5} ${top + 2}Z`} fill={look.roof} />
      <rect x={x - 8} y={base - 30} width="16" height="30" rx="3" fill="#141c30" />
      {windows.map((wx) => pane(wx, '#101b33'))}
      <circle cx={attic.x} cy={attic.y} r="3.6" fill="#101b33" />
      <g data-part="home-light">
        <ellipse cx={x} cy={top + 15} rx={w * 0.66} ry="22" fill="#ffd36b" opacity="0.08" />
        {windows.map((wx) => (
          <g key={wx}>
            {pane(wx, '#ffd36b')}
            <path d={`M${wx + 6.5} ${top + 8}V${top + 22}M${wx} ${top + 15}H${wx + 13}`} stroke={look.wall} strokeWidth="1.4" />
          </g>
        ))}
        <circle cx={attic.x} cy={attic.y} r="3.6" fill="#ffd36b" />
      </g>
    </g>
  )
}

/** Steps going away up the rise, `width` wide at the foot. */
function Stairs({ x, foot, top, width }: { readonly x: number; readonly foot: number; readonly top: number; readonly width: number }) {
  const half = (y: number): number => Math.round((width / 2) * (0.62 + 0.38 * ((y - top) / (foot - top))))
  const count = Math.max(4, Math.round((foot - top) / 13))
  const rows = Array.from({ length: count }, (_, row) => Math.round(top + ((foot - top) * (row + 1)) / (count + 1)))
  return (
    <g>
      <path d={`M${x - half(foot)} ${foot}L${x - half(top)} ${top}H${x + half(top)}L${x + half(foot)} ${foot}Z`} fill="#33456a" />
      {rows.map((y) => (
        <path key={y} d={`M${x - half(y)} ${y}H${x + half(y)}`} stroke="#566c98" strokeWidth="2" />
      ))}
      <path d={`M${x - half(foot) - 2} ${foot}L${x - half(top) - 2} ${top}M${x + half(foot) + 2} ${foot}L${x + half(top) + 2} ${top}`} stroke="#16223b" strokeWidth="4" />
    </g>
  )
}

/** The night over the town: the sky, the far hills, and the houses up the steps where the customers live. */
function Town({ id, L }: { readonly id: string; readonly L: Layout }) {
  const { hill, stairs, pavement } = L
  const rows = Array.from({ length: Math.floor((pavement.top - hill.top - 8) / 16) }, (_, row) => hill.top + 14 + row * 16)
  return (
    <g aria-hidden="true">
      <rect x="-2000" y="-2000" width="5000" height={2000 + pavement.top} fill={`url(#${id}-sky)`} />
      <Stars />
      <circle cx={L.moon.x} cy={L.moon.y} r={L.moon.r * 3.6} fill={`url(#${id}-moon)`} />
      <circle cx={L.moon.x} cy={L.moon.y} r={L.moon.r} fill="#fff3cf" />
      <circle cx={L.moon.x - L.moon.r * 0.35} cy={L.moon.y - L.moon.r * 0.25} r={L.moon.r * 0.2} fill="#f0dfae" />
      <path d={L.far} fill="#0e1f42" />
      {/* The rise the houses stand on, faced with stone, and the steps up it. */}
      <rect x={hill.x0} y={hill.top} width={3000 - hill.x0} height={pavement.top - hill.top + 2} fill="#1a2b48" />
      {rows.map((y, row) => (
        <path key={y} d={`M${hill.x0} ${y}H3000`} stroke="#22365a" strokeWidth="1.5" strokeDasharray="30 4" strokeDashoffset={row % 2 === 0 ? 0 : 17} />
      ))}
      <rect x={hill.x0} y={hill.top - 4} width={3000 - hill.x0} height="8" rx="4" fill="#1d3f3e" />
      <Stairs x={stairs.x} foot={pavement.top} top={hill.top} width={stairs.width} />
      {L.homes.map((x, index) => (
        <House key={x} x={x} base={hill.top} size={L.house} look={HOUSES[index % HOUSES.length] as (typeof HOUSES)[number]} />
      ))}
    </g>
  )
}

/** The pavement in front of the shop, the kerb and the road. */
function Street({ L }: { readonly L: Layout }) {
  const { top, kerb } = L.pavement
  return (
    <g aria-hidden="true">
      <rect x="-2000" y={top} width="5000" height={kerb - top} fill="#2a3550" />
      <path d={`M-2000 ${Math.round((top + kerb) / 2)}H3000`} stroke="#243049" strokeWidth="2" />
      {Array.from({ length: 26 }, (_, i) => -100 + i * 48).map((x, i) => (
        <path key={x} d={`M${x + (i % 2) * 24} ${top}v${Math.round((kerb - top) / 2)}M${x + 24 - (i % 2) * 24} ${Math.round((top + kerb) / 2)}V${kerb}`} stroke="#243049" strokeWidth="2" />
      ))}
      <rect x="-2000" y={kerb} width="5000" height="8" fill="#3d4a66" />
      <rect x="-2000" y={kerb - 2} width="5000" height="3" fill="#56648a" />
      <rect x="-2000" y={kerb + 8} width="5000" height="2400" fill="#111a2e" />
    </g>
  )
}

/** The shelves' goods: tins, bottles of oil, jars and packets, from x0 to x1, standing on y. */
function Shelf({ x0, x1, y, seed }: { readonly x0: number; readonly x1: number; readonly y: number; readonly seed: number }) {
  const goods: ReactNode[] = []
  for (let x = x0 + 6, i = seed; x < x1 - 18; i++) {
    const kind = GOODS[i % GOODS.length]
    const colour = PACKS[(i * 3 + seed) % PACKS.length]
    if (kind === 'bottle') {
      goods.push(
        <g key={x}>
          <rect x={x + 2.5} y={y - 21} width="3" height="6" fill="#e0a23c" />
          <rect x={x + 2} y={y - 23} width="4" height="2.5" rx="1" fill="#3f6b5a" />
          <rect x={x} y={y - 16} width="8" height="16" rx="3" fill="#e0a23c" />
          <rect x={x + 1.5} y={y - 14} width="2" height="10" rx="1" fill="#fff3cf" opacity="0.45" />
        </g>,
      )
      x += 12
    } else if (kind === 'jar') {
      goods.push(
        <g key={x}>
          <rect x={x} y={y - 13} width="12" height="13" rx="3" fill="#efe2c4" opacity="0.9" />
          <rect x={x - 0.5} y={y - 16} width="13" height="4" rx="1.5" fill={colour} />
        </g>,
      )
      x += 16
    } else if (kind === 'box') {
      goods.push(
        <g key={x}>
          <rect x={x} y={y - 20} width="14" height="20" rx="1.5" fill={colour} />
          <rect x={x + 3} y={y - 15} width="8" height="6" rx="1" fill="#fbefd6" opacity="0.8" />
        </g>,
      )
      x += 18
    } else {
      goods.push(
        <g key={x}>
          <rect x={x} y={y - 14} width="12" height="14" rx="2" fill={colour} />
          <rect x={x} y={y - 9} width="12" height="5" fill="#fbefd6" opacity="0.55" />
          <rect x={x} y={y - 14} width="12" height="2.5" rx="1.2" fill="#ffffff" opacity="0.35" />
        </g>,
      )
      x += 15
    }
  }
  return (
    <g>
      {goods}
      <rect x={x0} y={y} width={x1 - x0} height="5" rx="1.5" fill="#9a6a40" />
      <rect x={x0} y={y + 5} width={x1 - x0} height="3" fill="#1a120c" opacity="0.35" />
    </g>
  )
}

/** The poison sign: a skull over crossed bones, cream on red. */
function PoisonMark({ x, y, r }: { readonly x: number; readonly y: number; readonly r: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill="#d9473f" stroke="#fbefd6" strokeWidth="1.2" />
      <g transform={`scale(${round2(r / 9)})`}>
        <path d="M-5.5 -4.5L5.5 5.5M5.5 -4.5L-5.5 5.5" stroke="#fbefd6" strokeWidth="1.8" strokeLinecap="round" />
        <circle cy="-1.2" r="4.4" fill="#fbefd6" />
        <rect x="-2.6" y="1.4" width="5.2" height="3" rx="1" fill="#fbefd6" />
        <circle cx="-1.6" cy="-1.4" r="1.1" fill="#d9473f" />
        <circle cx="1.6" cy="-1.4" r="1.1" fill="#d9473f" />
      </g>
    </g>
  )
}

/** An oil drum standing with its bottom left corner on (0, 0); the biggest carries the word as well as the sign. */
function Drum({ w, h, word }: { readonly w: number; readonly h: number; readonly word?: string }) {
  return (
    <g>
      <rect x="0" y={-h} width={w} height={h} rx="6" fill="#3e6260" />
      <rect x="5" y={-h + 6} width="6" height={h - 12} rx="3" fill="#6a948c" opacity="0.45" />
      <rect x="0" y={-h + 13} width={w} height="4" rx="2" fill="#2c4744" />
      <rect x="0" y="-15" width={w} height="4" rx="2" fill="#2c4744" />
      <rect x="-1.5" y={-h} width={w + 3} height="6" rx="3" fill="#5b837c" />
      <PoisonMark x={w / 2} y={word ? -h + 29 : -h / 2} r={word ? 9 : 8} />
      {word && (
        <g>
          <rect x="3" y="-36" width={w - 6} height="16" rx="3" fill="#d9473f" />
          <text x={w / 2} y="-24.5" textAnchor="middle" className="atp-m-shop-label" fill="#fff3e6">
            {word}
          </text>
        </g>
      )}
    </g>
  )
}

/** The grocer's apron, over the figure's shirt; it breathes along with them. */
function Apron({ delay }: { readonly delay: number }) {
  const style = { '--delay': `${-delay}s` } as CSSProperties
  return (
    <g className="atp-m-idle" style={style}>
      <path d="M-6 -50L-9.5 -53M6 -50L9.5 -53" stroke="#7a4a26" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M-6 -50H6V-39Q11 -38 11 -34V-8Q11 -5 8 -5H-8Q-11 -5 -11 -8V-34Q-11 -38 -6 -39Z" fill="#9a6234" />
      <rect x="-5.5" y="-27" width="11" height="7" rx="2" fill="#7a4a26" />
    </g>
  )
}

/** One of the queue: a stranger with a basket on their right arm, which holds the bottle if they buy one. */
function Customer({ actor, youLabel, delay }: { readonly actor: PersonActor; readonly youLabel: string; readonly delay: number }) {
  return (
    <>
      <Figure actor={actor} youLabel={youLabel} delay={delay} />
      <g data-part="basket" transform={basketAt(FIGURE.armRest)}>
        <g data-part="bought" opacity="0">
          <rect x="0" y="17" width="3" height="5" fill="#e0a23c" />
          <rect x="-0.5" y="15.5" width="4" height="2.5" rx="1" fill="#3f6b5a" />
          <rect x="-2" y="21" width="7" height="12" rx="2.5" fill="#e0a23c" />
        </g>
        <path d="M-7 27Q0 13 7 27" fill="none" stroke="#a8844f" strokeWidth="1.6" />
        <path d="M-9 26H9L7 37H-7Z" fill="#c9a36b" />
        <path d="M-8.2 30H8.2M-7.6 33.5H7.6" stroke="#a8844f" strokeWidth="1" />
      </g>
    </>
  )
}

/** The striped awning over the shop front, flaring out a little, with a scalloped edge. */
function Awning({ x0, x1, top, bottom }: { readonly x0: number; readonly x1: number; readonly top: number; readonly bottom: number }) {
  const count = Math.round((x1 - x0) / 30)
  const flare = 10
  const atTop = (i: number): number => Math.round(x0 + ((x1 - x0) * i) / count)
  const atBottom = (i: number): number => Math.round(x0 - flare + ((x1 - x0 + 2 * flare) * i) / count)
  return (
    <g>
      <rect x={x0 - 4} y={top - 4} width={x1 - x0 + 8} height="6" rx="3" fill="#1b2440" />
      {Array.from({ length: count }, (_, i) => (
        <path
          key={i}
          d={`M${atTop(i)} ${top}L${atTop(i + 1)} ${top}L${atBottom(i + 1)} ${bottom}A${round2((atBottom(i + 1) - atBottom(i)) / 2)} 7 0 0 1 ${atBottom(i)} ${bottom}Z`}
          fill={i % 2 === 0 ? '#c8453c' : '#f3e6c8'}
        />
      ))}
      <path d={`M${x0} ${top}H${x1}L${x1 + flare} ${bottom}H${x0 - flare}Z`} fill="#000000" opacity="0.08" />
    </g>
  )
}

/** The sign hanging in the door: open, or (once the oil is poured away) turned round to closed. */
function DoorSign({ x, y, open, closed }: { readonly x: number; readonly y: number; readonly open: string; readonly closed: string }) {
  const width = Math.round(Math.max(open.length, closed.length) * 7.4 + 16)
  const face = (text: string, fill: string, ink: string) => (
    <>
      <rect x={-width / 2} y="12" width={width} height="22" rx="5" fill={fill} stroke="#1b2440" strokeWidth="1.5" />
      <text y="27.5" textAnchor="middle" className="atp-m-sign-text" fill={ink}>
        {text}
      </text>
    </>
  )
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M${-width / 2 + 9} 13L0 0L${width / 2 - 9} 13`} fill="none" stroke="#c9a36b" strokeWidth="1.4" />
      <circle r="2.2" fill="#c9a36b" />
      <g data-part="sign">
        <g data-part="sign-open">{face(open, '#7fe3b8', '#0d2a1e')}</g>
        <g data-part="sign-closed" opacity="0">
          {face(closed, '#d9473f', '#fff8e8')}
        </g>
      </g>
    </g>
  )
}

export function ShopScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, L })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)
  // The five who would buy the oil (track B: lost if you sell).
  const customers = useMemo(() => dilemma.trackB.filter(isPerson).slice(0, L.spots.length), [dilemma, L])

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
  const { shop, room, floor, pavement, counter } = L
  const roomTop = shop.top + 84
  const top = counterTop(L)
  const can = { x: canX(L), y: top - 14 }
  const till = tillOf(L)
  const door = { x: room.door + 7, w: shop.x1 - room.door - 14, top: floor - 106 }
  const lamp = { x: L.merchant, y: roomTop + 26 }
  const crate = counter.x0 + 30
  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.shopLabel[lang]}>
      <defs>
        <linearGradient id={`${id}-sky`} gradientUnits="userSpaceOnUse" x1="0" y1={L.hill.top - 340} x2="0" y2={L.hill.top + 20}>
          <stop offset="0" stopColor="#050c1f" />
          <stop offset="0.6" stopColor="#0c1c3f" />
          <stop offset="1" stopColor="#1b3463" />
        </linearGradient>
        <radialGradient id={`${id}-moon`}>
          <stop offset="0" stopColor="#fff3cf" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff3cf" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a5a3c" />
          <stop offset="1" stopColor="#4d3827" />
        </linearGradient>
        <radialGradient id={`${id}-lamp`}>
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-bulb`}>
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-spill`}>
          <stop offset="0" stopColor="#ffc861" stopOpacity="0.3" />
          <stop offset="0.6" stopColor="#ffc861" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffc861" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset="1" stopColor="#f2b04a" />
        </linearGradient>
        <clipPath id={`${id}-room`}>
          <rect x={room.x0} y={roomTop} width={room.x1 - room.x0} height={floor - roomTop} />
        </clipPath>
      </defs>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          <Town id={id} L={L} />
          <Street L={L} />
          <ellipse data-part="spill" cx={(room.partition + shop.x1) / 2} cy={floor + 6} rx={(shop.x1 - room.partition) * 0.66} ry={pavement.kerb - floor + 4} fill={`url(#${id}-spill)`} />

          {/* The shop, its front cut away: the lit shop, and the back room where the oil is kept. */}
          <rect x={shop.x0} y={shop.top + 10} width={shop.x1 - shop.x0} height={floor - shop.top} fill="#24304d" />
          <g clipPath={`url(#${id}-room)`}>
            <rect x={room.x0} y={roomTop} width={room.x1 - room.x0} height={floor - roomTop} fill={`url(#${id}-wall)`} />
            <circle cx={lamp.x} cy={lamp.y + 20} r="230" fill={`url(#${id}-lamp)`} />
            <rect x={room.x0} y={roomTop} width={room.partition - room.x0} height={floor - roomTop} fill="#2c231c" />
            <circle cx={(room.x0 + room.partition) / 2} cy={roomTop + 30} r="120" fill={`url(#${id}-bulb)`} />
            <rect x={room.x0} y={floor - 8} width={room.x1 - room.x0} height="8" fill="#3a2a1e" />
          </g>
          {L.shelves.map((y, index) => (
            <Shelf key={y} x0={room.partition + 18} x1={room.x1 - 8} y={y} seed={index * 4} />
          ))}
          <g aria-hidden="true">
            <path d={`M${(room.x0 + room.partition) / 2} ${roomTop}V${roomTop + 18}`} stroke="#1d1a1f" strokeWidth="1.5" />
            <circle cx={(room.x0 + room.partition) / 2} cy={roomTop + 22} r="4.5" fill="#ffe2a3" />
            <rect x={room.x0 + 8} y={floor - 112} width={room.partition - room.x0 - 16} height="5" rx="1.5" fill="#5a3f2a" />
            {[0, 1, 2].map((index) => (
              <g key={index} transform={`translate(${room.x0 + 14 + index * 26} ${floor - 112})`}>
                <rect x="0" y="-24" width="20" height="24" rx="2" fill="#9aa4b6" />
                <rect x="0" y="-24" width="20" height="4" rx="1.5" fill="#c3cad6" />
                <rect x="4" y="-15" width="12" height="8" rx="1.5" fill="#d9473f" />
              </g>
            ))}
            <g transform={`translate(${L.spare} ${floor})`}>
              <Drum w={44} h={62} />
            </g>
            <rect x={room.partition} y={roomTop} width="10" height={floor - 104 - roomTop} fill="#3a2f27" />
            <rect x={room.partition} y={floor - 108} width="10" height="4" fill="#2a211b" />
            <path d={`M${lamp.x} ${roomTop}V${lamp.y - 12}`} stroke="#1d1a1f" strokeWidth="1.5" />
            <path d={`M${lamp.x - 13} ${lamp.y}L${lamp.x - 5} ${lamp.y - 12}H${lamp.x + 5}L${lamp.x + 13} ${lamp.y}Z`} fill="#2a3550" />
            <circle cx={lamp.x} cy={lamp.y + 2} r="4.5" fill="#fff3cf" />
          </g>

          <g data-part="barrel" transform={tilt(L, 0)}>
            <g transform={`translate(${L.barrel} ${floor})`}>
              <Drum w={BARREL.w} h={BARREL.h} word={FOOT_UI.poison[lang]} />
            </g>
          </g>

          <g data-part="merchant" transform={transform(behindCounter(L).x, behindCounter(L).y)}>
            <Figure actor={MERCHANT} youLabel={you} delay={MERCHANT_DELAY} />
            <Apron delay={MERCHANT_DELAY} />
          </g>

          {/* The counter: a crate of bottles, the can of oil, the till. */}
          <g aria-hidden="true">
            <rect x={counter.x0} y={top + 4} width={counter.x1 - counter.x0} height={floor - top - 4} fill="#6b4528" />
            {[0, 1, 2].map((index) => {
              const width = (counter.x1 - counter.x0 - 24) / 3
              return <rect key={index} x={Math.round(counter.x0 + 9 + index * (width + 3))} y={top + 10} width={Math.round(width)} height={floor - top - 16} rx="2" fill="#7a5434" stroke="#5a3a22" strokeWidth="1.5" />
            })}
            <rect x={counter.x0 - 6} y={top} width={counter.x1 - counter.x0 + 12} height="7" rx="2.5" fill="#b07a4c" />
            <rect x={counter.x0 - 6} y={top} width={counter.x1 - counter.x0 + 12} height="2" rx="1" fill="#d39a64" />
            <g transform={`translate(${crate} ${top})`}>
              {[-12, -4, 4, 12].map((dx) => (
                <g key={dx}>
                  <rect x={dx - 2} y="-22" width="4" height="8" fill="#e0a23c" />
                  <rect x={dx - 2.5} y="-24" width="5" height="3" rx="1" fill="#3f6b5a" />
                </g>
              ))}
              <rect x="-19" y="-15" width="38" height="15" rx="2" fill="#8b5a3a" />
              <path d="M-19 -9H19" stroke="#6b4528" strokeWidth="1.5" />
            </g>
            <g transform={`translate(${can.x} ${top})`}>
              <rect x="-3" y="-34" width="6" height="6" rx="1" fill="#c9a36b" />
              <path d="M6 -26q8 0 8 8" fill="none" stroke="#c9a36b" strokeWidth="2" />
              <rect x="-10" y="-29" width="20" height="29" rx="3" fill="#e0a23c" />
              <rect x="-10" y="-29" width="20" height="4" rx="2" fill="#f5c46b" />
              <rect x="-7" y="-20" width="14" height="12" rx="2" fill="#3f6b5a" />
              <path d="M0 -18q4 4 0 8q-4 -4 0 -8z" fill="#f5c46b" />
            </g>
            <g transform={`translate(${till.x} ${top})`}>
              <path d="M-12 -16L-9 -24H9L12 -16Z" fill="#2a3550" />
              <rect x="-13" y="-17" width="26" height="17" rx="2" fill="#3b4664" />
              <rect x="-13" y="-17" width="26" height="3" rx="1.5" fill="#c9a36b" />
              <rect x="-5" y="-21" width="10" height="2" rx="1" fill="#0b1a3a" />
            </g>
          </g>

          {/* The door, its glass lit, the bell over it. */}
          <g aria-hidden="true">
            <rect x={door.x} y={door.top} width={door.w} height={floor - door.top} rx="3" fill="#3b2a1f" />
            <rect x={door.x + 5} y={door.top + 6} width={door.w - 10} height="58" rx="2" fill={`url(#${id}-glass)`} opacity="0.85" />
            <rect x={door.x + 5} y={door.top + 70} width={door.w - 10} height={floor - door.top - 76} rx="2" fill="#4a3526" />
            <circle cx={door.x + door.w - 8} cy={floor - 44} r="2.4" fill="#c9a36b" />
          </g>
          <g transform={`translate(${door.x + 9} ${door.top + 6})`}>
            <g data-part="doorbell">
              <path d="M0 0V4" stroke="#c9a36b" strokeWidth="1.2" />
              <path d="M-5 12Q-5 4 0 4Q5 4 5 12Z" fill="#e0b85a" />
              <circle cy="13" r="1.6" fill="#c9a36b" />
            </g>
          </g>

          {/* Lights out, once the shop has shut. */}
          <g data-part="dim" opacity="0" pointerEvents="none">
            <rect x={room.partition + 10} y={roomTop} width={room.x1 - room.partition - 10} height={floor - roomTop} fill="#060c1c" />
            <rect x={door.x + 5} y={door.top + 6} width={door.w - 10} height="58" fill="#060c1c" />
          </g>
          <DoorSign x={door.x + door.w / 2} y={door.top + 12} open={FOOT_UI.shopOpen[lang]} closed={FOOT_UI.shopClosed[lang]} />

          <Awning x0={shop.x0 + 10} x1={shop.x1 - 10} top={shop.top + 50} bottom={shop.top + 86} />
          <g aria-hidden="true">
            <rect x={shop.x0 - 6} y={shop.top} width={shop.x1 - shop.x0 + 12} height="12" rx="3" fill="#1b2440" />
            <rect x={shop.x0 - 6} y={shop.top} width={shop.x1 - shop.x0 + 12} height="3" rx="1.5" fill="#3a4a72" />
            <rect x={shop.x0 + 16} y={shop.top + 17} width={shop.x1 - shop.x0 - 32} height="28" rx="5" fill="#1d5a4c" stroke="#c9a36b" strokeWidth="2" />
            <g transform={`translate(${(shop.x0 + shop.x1) / 2} ${shop.top + 31})`} fill="#fbefd6">
              <path d="M-3 -10h6v3l3 4v11a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-11l3 -4z" />
              <path d="M-12 4q-10 -2 -14 -10q9 0 14 10zM12 4q10 -2 14 -10q-9 0 -14 10z" opacity="0.8" />
              <circle cx="-44" cy="0" r="2" opacity="0.6" />
              <circle cx="44" cy="0" r="2" opacity="0.6" />
            </g>
            <rect x={shop.x0} y={floor} width={shop.x1 - shop.x0} height="10" fill="#3a4560" />
            <rect x={shop.x0} y={floor} width={shop.x1 - shop.x0} height="2" fill="#56648a" />
          </g>

          {/* Poured away: the oil runs from the barrel to the drain. */}
          <g transform={`translate(${Math.round(lip(L).x - 2)} ${floor + 2})`}>
            <ellipse data-part="puddle" rx="22" ry="3.5" fill="#f2b04a" opacity="0.85" transform="scale(0)" />
          </g>
          <g transform={`translate(${L.drain} ${pavement.kerb + 15})`}>
            <ellipse data-part="puddle" rx="34" ry="6" fill="#f2b04a" opacity="0.85" transform="scale(0)" />
          </g>
          <g transform={`translate(${L.drain} ${pavement.kerb + 15})`} aria-hidden="true">
            <rect x="-17" y="-5" width="34" height="10" rx="2" fill="#0a1020" stroke="#3b4664" strokeWidth="1.5" />
            <path d="M-10 -4V4M-4 -4V4M2 -4V4M8 -4V4" stroke="#3b4664" strokeWidth="1.5" />
          </g>
          {(
            [
              [12, 0.25],
              [5, 1],
            ] as const
          ).map(([width, opacity]) => (
            <path
              key={width}
              data-part="pour"
              d={pourPath(L)}
              pathLength="100"
              strokeDasharray="100 100"
              strokeDashoffset="100"
              fill="none"
              stroke="#f2b04a"
              strokeWidth={width}
              strokeOpacity={opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <path data-part="flow" d={pourPath(L)} className="atp-m-shop-oil" opacity="0" />

          {customers.map((actor, index) => (
            <g key={L.spots[index]} data-part="customer" transform={transform((L.spots[index] as number) + (opening ? 0 : L.shuffleFrom), L.queueY)}>
              <Customer actor={actor} youLabel={you} delay={index * 0.41} />
            </g>
          ))}

          <g data-part="bottle" opacity="0" pointerEvents="none">
            <circle r="13" fill="#ffd36b" opacity="0.18" />
            <rect x="-2" y="-15" width="4" height="7" fill="#e0a23c" />
            <rect x="-2.5" y="-17" width="5" height="3" rx="1" fill="#3f6b5a" />
            <rect x="-5" y="-9" width="10" height="18" rx="3.5" fill="#e0a23c" />
            <rect x="-3" y="-7" width="2.5" height="12" rx="1.2" fill="#fff3cf" opacity="0.5" />
          </g>
          <g data-part="coin" opacity="0" pointerEvents="none">
            <circle r="4.5" fill="#ffd36b" />
            <circle r="2.6" fill="none" stroke="#c9a36b" strokeWidth="1" />
          </g>
          <g data-part="glint" opacity="0" pointerEvents="none">
            <path d="M0 -11L2.4 -2.4L11 0L2.4 2.4L0 11L-2.4 2.4L-11 0L-2.4 -2.4Z" fill="#fff3cf" />
          </g>

          <g data-part="labels" opacity="0">
            <Pill x={L.labels.pull.x} y={L.labels.pull.y} text={dilemma.verbs?.pull[lang] ?? UI.pull[lang]} tone="pull" />
            <Pill x={L.labels.stay.x} y={L.labels.stay.y} text={dilemma.verbs?.stay?.[lang] ?? UI.stay[lang]} tone="stay" />
          </g>

          <circle className="atp-m-hint" cx={can.x} cy={can.y} r="28" />
          <circle
            className="atp-m-hotspot"
            cx={can.x}
            cy={can.y}
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
