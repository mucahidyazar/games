import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CLOTH, HAIR, person, SKIN } from '../content/cast'
import { FOOT_UI, UI } from '../content/strings'
import type { TrolleyChoice } from '../content/types'
import { cheer, fade, fall, fallenPose, lieDown, lose, lost, part, parts, shake, walk, walkTo } from './acting'
import { easeInQuad, easeOutBack, easeOutQuad, linear, round2, setAttr, Timeline, transform } from './animate'
import { Pill, Stars } from './Backdrop'
import { Figure } from './figures'
import type { Point } from './geometry'
import { emitter, isPerson, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * Philippa Foot's starving children, in motion: a cold, bare home at night,
 * three children huddled by a table of empty bowls, and out in the street a
 * man going by with a basket heaped with bread. Kill him for it, or hold back.
 */

/** You, their parent, in clothes worn thin and patched. */
const PARENT = person({ top: CLOTH.brown, bottom: CLOTH.grey, skin: SKIN.light, hair: 'short', hairColor: HAIR.chestnut, shoes: '#3b342c', marker: 'you' })
/** How thick the cut-away walls are, and how high the table stands. */
const WALL = 22
const TABLE_H = 34
/** The basket is drawn around its carrier's feet: its bottom is this far above them. */
const BASKET_FOOT = 10
const SHAWL = 'M-16 -50Q-15 -56 -6 -56Q0 -53 6 -56Q15 -56 16 -50L20 -27Q10 -22 0 -24Q-10 -22 -20 -27Z'

/** Where the home, the street and everyone are, on a wide stage or a tall one. */
interface Layout {
  readonly viewBox: string
  /** The room inside the cut-away walls: its two sides, its ceiling and its floor (the pavement's level too). */
  readonly room: { readonly left: number; readonly right: number; readonly top: number; readonly floor: number }
  readonly ridge: number
  /** The top of the open doorway in the right-hand wall. */
  readonly doorTop: number
  readonly window: Point
  readonly stoveX: number
  readonly childXs: readonly number[]
  /** The table's middle and width: the bowls, and in the end the bread, stand on it. */
  readonly table: { readonly x: number; readonly w: number }
  /** You in the doorway; where you catch up with him; where you set the bread down. */
  readonly you: Point
  readonly meet: Point
  readonly setDown: Point
  /** The man's way along the street: where he comes from, stops under the lamp, and walks on to. */
  readonly man: { readonly y: number; readonly from: number; readonly stop: number; readonly away: number }
  /** Which way he falls: away from you. */
  readonly fallTo: 1 | -1
  /** The lamp post's foot and top, and which side its lantern hangs. */
  readonly lamp: Point & { readonly top: number; readonly side: 1 | -1 }
  /** Rooftops further down the street: x, width, height. */
  readonly town: readonly (readonly [number, number, number])[]
  /** The rows of cobbles, and the near kerb. */
  readonly cobbles: readonly number[]
  readonly kerb: number
  readonly labels: Readonly<Record<TrolleyChoice, Point>>
}

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: {
    viewBox: '40 40 920 480',
    room: { left: 92, right: 514, top: 206, floor: 392 },
    ridge: 112,
    doorTop: 284,
    window: { x: 248, y: 262 },
    stoveX: 142,
    childXs: [214, 240, 266],
    table: { x: 364, w: 134 },
    you: { x: 525, y: 392 },
    meet: { x: 700, y: 474 },
    setDown: { x: 460, y: 392 },
    man: { y: 474, from: 1150, stop: 756, away: -170 },
    fallTo: 1,
    lamp: { x: 808, y: 470, top: 260, side: -1 },
    town: [
      [588, 76, 60],
      [672, 98, 92],
      [784, 66, 54],
      [858, 116, 112],
      [992, 88, 74],
    ],
    cobbles: [416, 438, 464, 494],
    kerb: 508,
    labels: { pull: { x: 756, y: 366 }, stay: { x: 446, y: 268 } },
  },
  tall: {
    viewBox: '150 60 500 640',
    room: { left: 196, right: 584, top: 240, floor: 420 },
    ridge: 140,
    doorTop: 312,
    window: { x: 324, y: 296 },
    stoveX: 234,
    childXs: [298, 324, 350],
    table: { x: 440, w: 134 },
    you: { x: 595, y: 420 },
    meet: { x: 512, y: 610 },
    setDown: { x: 540, y: 420 },
    man: { y: 610, from: 830, stop: 452, away: -70 },
    fallTo: -1,
    lamp: { x: 410, y: 606, top: 450, side: 1 },
    town: [],
    cobbles: [446, 470, 498, 530, 566, 606, 648],
    kerb: 666,
    labels: { pull: { x: 452, y: 504 }, stay: { x: 500, y: 300 } },
  },
}

interface Nodes {
  readonly root: SVGGElement
  readonly camera: SVGGElement | null
  readonly door: SVGGElement | null
  readonly you: SVGGElement | null
  readonly man: SVGGElement | null
  readonly basket: SVGGElement | null
  readonly lampLight: SVGGElement | null
  readonly dark: SVGGElement | null
  readonly fire: SVGGElement | null
  readonly warmth: SVGGElement | null
  readonly smoke: SVGGElement | null
  readonly soup: SVGGElement | null
  readonly steam: SVGGElement | null
  readonly chill: SVGGElement | null
  readonly labels: SVGGElement | null
  readonly children: readonly SVGGElement[]
  readonly shawls: readonly SVGGElement[]
}

function gather(root: SVGGElement): Nodes {
  return {
    root,
    camera: part(root, 'camera'),
    door: part(root, 'door'),
    you: part(root, 'you'),
    man: part(root, 'man'),
    basket: part(root, 'basket'),
    lampLight: part(root, 'lamp-light'),
    dark: part(root, 'dark'),
    fire: part(root, 'fire'),
    warmth: part(root, 'warmth'),
    smoke: part(root, 'smoke'),
    soup: part(root, 'soup'),
    steam: part(root, 'steam'),
    chill: part(root, 'chill'),
    labels: part(root, 'labels'),
    children: parts(root, 'child'),
    shawls: parts(root, 'shawl'),
  }
}

const figureOf = (holder: Element | null): Element | null => holder?.querySelector('.atp-m-figure') ?? null
/** The basket as if carried by someone standing on (x, y), tipped `angle` degrees about its bottom. */
const basketAt = (x: number, y: number, angle = 0): string => (angle ? `${transform(x, y)} rotate(${round2(angle)} 0 ${-BASKET_FOOT})` : transform(x, y))
/** Where the bread ends up: at the end of the table, past the bowls. */
const onTable = (L: Layout): Point => ({ x: L.table.x + L.table.w / 2 - 24, y: L.room.floor - TABLE_H + BASKET_FOOT })
/** The door, hinged on the wall's outside, swung `open` of the way towards you. */
const doorSwing = (L: Layout, open: number): string => `translate(${L.room.right + WALL} 0) scale(${round2(open)} 1)`
/** The street lamp sputtering out, and coming back on. */
const sputterOut = (v: number): number => (v < 0.3 ? round2(1 - v * 2) : v < 0.5 ? 0.8 : v < 0.7 ? 0.2 : 0)
const sputterOn = (v: number): number => (v < 0.2 ? 0 : v < 0.35 ? 0.6 : v < 0.5 ? 0.1 : round2((v - 0.5) * 2))

/** You walk from one spot to another with the bread in your arms. */
function carry(n: Nodes, timeline: Timeline, from: Point, to: Point, duration: number): Promise<unknown> {
  return Promise.all([walkTo(timeline, n.you, from, to, duration), walkTo(timeline, n.basket, from, to, duration)])
}

/** A shawl slips off a child's shoulders, now the room is warm. */
function shed(timeline: Timeline, shawl: Element): Promise<void> {
  return timeline.tween(
    380,
    (v) => {
      setAttr(shawl, 'transform', `translate(0 ${round2(16 * v)})`)
      setAttr(shawl, 'opacity', round2(1 - v))
    },
    easeInQuad,
  )
}

async function arrive(n: Nodes, L: Layout, timeline: Timeline, emit: Emit, turn: Turn): Promise<void> {
  const mine = turn.current
  n.root.dataset.state = 'arriving'
  // The door creaks in the cold, and a man comes up the street with his bread.
  emit('creak')
  void timeline.tween(700, (v) => setAttr(n.door, 'transform', doorSwing(L, 0.72 + 0.28 * v)), easeOutBack)
  const { y, from, stop } = L.man
  await Promise.all([walk(timeline, n.man, from, stop, y, 1500), walk(timeline, n.basket, from, stop, y, 1500)])
  if (turn.current !== mine || timeline.finished) return
  n.root.dataset.state = 'waiting'
  await fade(timeline, n.labels, 1, 400)
}

async function run(n: Nodes, L: Layout, timeline: Timeline, choice: TrolleyChoice, emit: Emit, turn: Turn): Promise<void> {
  turn.current += 1
  timeline.skip()
  n.root.dataset.state = 'running'
  void fade(timeline, n.labels, 0, 200)
  const { y, stop, away } = L.man
  if (choice === 'pull') {
    // You go out to him; the lamp sputters out, and in the dark it is done.
    await walkTo(timeline, n.you, L.you, L.meet, 760)
    await timeline.tween(
      260,
      (v) => {
        setAttr(n.lampLight, 'opacity', sputterOut(v))
        setAttr(n.dark, 'opacity', round2(0.6 * v))
      },
      linear,
    )
    emit('push')
    await shake(timeline, n.camera, 9)
    emit('impact', { kind: 'person' })
    // The light comes back on him lying in the street, his basket dropped at his feet.
    const man = figureOf(n.man)
    await Promise.all([
      man ? fall(timeline, man, L.fallTo) : Promise.resolve(),
      timeline.tween(420, (v) => setAttr(n.basket, 'transform', basketAt(stop, y + BASKET_FOOT * v, -12 * v)), easeInQuad),
      timeline.tween(
        480,
        (v) => {
          setAttr(n.lampLight, 'opacity', sputterOn(v))
          setAttr(n.dark, 'opacity', round2(0.6 * (1 - v)))
        },
        linear,
      ),
    ])
    // You carry the bread home and set it on the table.
    await timeline.tween(
      260,
      (v) => setAttr(n.basket, 'transform', basketAt(stop + (L.meet.x - stop) * v, y + BASKET_FOOT * (1 - v) - 8 * Math.sin(v * Math.PI), -12 * (1 - v))),
      easeOutQuad,
    )
    await carry(n, timeline, L.meet, L.you, 680)
    await carry(n, timeline, L.you, L.setDown, 300)
    const table = onTable(L)
    await timeline.tween(260, (v) => setAttr(n.basket, 'transform', basketAt(L.setDown.x + (table.x - L.setDown.x) * v, L.setDown.y + (table.y - L.setDown.y) * v)), easeOutQuad)
    // The stove is lit and the bowls are filled; warm at last, the children throw off their shawls.
    emit('heal')
    void fade(timeline, n.fire, 1, 400)
    void fade(timeline, n.warmth, 1, 900)
    void fade(timeline, n.smoke, 1, 900)
    await fade(timeline, n.soup, 1, 500)
    void fade(timeline, n.steam, 1, 500)
    await Promise.all(n.shawls.map((shawl) => shed(timeline, shawl)))
    emit('cheer')
    await Promise.all(
      n.children.map((child, index) =>
        timeline.wait(index * 120).then(() => {
          const figure = figureOf(child)
          return figure ? cheer(timeline, figure) : undefined
        }),
      ),
    )
  } else {
    // You hold back: he walks on with his bread, and the house grows colder.
    const walking = Promise.all([walk(timeline, n.man, stop, away, y, 2200), walk(timeline, n.basket, stop, away, y, 2200)])
    void fade(timeline, n.chill, 1, 1800)
    await timeline.wait(1400)
    // One after another, quietly, the children are lost to the hunger.
    const losses: Promise<void>[] = []
    for (const [index, child] of n.children.entries()) {
      if (index > 0) await timeline.wait(550)
      emit('impact', { kind: 'person', how: 'flatline' })
      void fade(timeline, n.shawls[index] ?? null, 0.5, 400)
      const figure = figureOf(child)
      if (figure) losses.push(lose(timeline, figure))
    }
    await Promise.all([walking, ...losses])
    setAttr(n.man, 'opacity', 0)
    setAttr(n.basket, 'opacity', 0)
  }
  n.root.dataset.state = 'done'
}

function aftermath(n: Nodes, L: Layout, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  if (choice === 'pull') {
    const man = figureOf(n.man)
    if (man) lieDown(man, fallenPose(L.fallTo))
    const table = onTable(L)
    setAttr(n.basket, 'transform', basketAt(table.x, table.y))
    setAttr(n.you, 'transform', transform(L.setDown.x, L.setDown.y))
    for (const node of [n.fire, n.warmth, n.smoke, n.soup, n.steam]) setAttr(node, 'opacity', 1)
    for (const shawl of n.shawls) setAttr(shawl, 'opacity', 0)
  } else {
    for (const node of [n.man, n.basket]) {
      setAttr(node, 'transform', transform(L.man.away, L.man.y))
      setAttr(node, 'opacity', 0)
    }
    setAttr(n.chill, 'opacity', 1)
    for (const shawl of n.shawls) setAttr(shawl, 'opacity', 0.5)
    for (const child of n.children) {
      const figure = figureOf(child)
      if (figure) lost(figure)
    }
  }
}

/** A wicker basket heaped with loaves, held low in front of whoever carries it (standing on 0, 0). */
function Basket() {
  const baguette = (x: number, y: number, angle: number) => (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x="-4" y="-13" width="8" height="26" rx="4" fill="#e2a95a" />
      <path d="M-2 -7l4 -2.6M-2 -1l4 -2.6M-2 5l4 -2.6" stroke="#b97a35" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  )
  return (
    <g className="atp-m-home-basket">
      {baguette(-12, -42, -30)}
      {baguette(12, -43, 26)}
      <ellipse cx="-9" cy="-35" rx="8.5" ry="6" fill="#d99a4e" />
      <ellipse cx="9" cy="-35" rx="8.5" ry="6" fill="#dfa452" />
      <ellipse cx="0" cy="-37.5" rx="9.5" ry="6.5" fill="#e9b765" />
      <path d="M-13 -36.5q3.5 -2.6 7 0M6 -36.5q3.5 -2.6 7 0M-4 -39q4 -3 8 0" fill="none" stroke="#b97a35" strokeWidth="1.3" strokeLinecap="round" />
      <ellipse cx="-2.5" cy="-41.5" rx="3.4" ry="1.4" fill="#ffe2a3" opacity="0.7" />
      <path d="M-21 -31H21L17 -10Q0 -7 -17 -10Z" fill="#a86f3a" />
      <path d="M-20 -24.5H20M-18.5 -17.5H18.5M-10 -30V-9M0 -30V-8M10 -30V-9" stroke="#8a5a2e" strokeWidth="1.4" />
      <rect x="-23" y="-34" width="46" height="5" rx="2.5" fill="#c48a4c" />
      <path d="M-20 -32.6H20" stroke="#e0ad6c" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
    </g>
  )
}

/** A child's shawl, worn over their shoulders against the cold (in the child's own frame). */
function Shawl({ patch }: { readonly patch: number }) {
  return (
    <>
      <path d={SHAWL} fill="#56627e" />
      <path d="M-19.4 -30.5Q-10 -26 0 -28Q10 -26 19.4 -30.5" fill="none" stroke="#7d89a6" strokeWidth="2" />
      <rect x={patch} y="-47" width="7" height="7" rx="1.5" fill="#7a6656" />
      <path d={`M${patch + 1.5} -45.5h4M${patch + 1.5} -41.5h4`} stroke="#5c4b3f" strokeWidth="0.8" strokeDasharray="1.2 1" />
    </>
  )
}

/** The street: rooftops further down it against the sky, the pavement, the cobbled road and its near kerb. */
function Street({ L }: { readonly L: Layout }) {
  const F = L.room.floor
  return (
    <g className="atp-m-home-street" aria-hidden="true">
      {L.town.map(([x, w, h], index) => (
        <g key={x}>
          <path d={`M${x} ${F}V${F - h}L${x + w / 2} ${F - h - Math.round(w * 0.32)}L${x + w} ${F - h}V${F}Z`} fill={index % 2 ? '#0d1b38' : '#102040'} />
          <rect x={x + w * 0.24} y={F - h * 0.62} width="9" height="11" rx="2" fill={index === 1 ? '#ffd36b' : '#09142c'} opacity={index === 1 ? 0.45 : 1} />
          <rect x={x + w * 0.62} y={F - h * 0.62} width="9" height="11" rx="2" fill={index === 3 ? '#ffd36b' : '#09142c'} opacity={index === 3 ? 0.35 : 1} />
        </g>
      ))}
      <rect x="-2000" y={F} width="5000" height="12" fill="#1b2944" />
      <rect x="-2000" y={F + 12} width="5000" height="3000" fill="#101b31" />
      <path d={`M-2000 ${F + 12}H3000`} stroke="#283a5a" strokeWidth="2.5" />
      {L.cobbles.map((y, row) => {
        const h = 5 + row * 1.4
        const w = 16 + row * 4
        return (
          <path
            key={y}
            d={`M-400 ${y}H1400`}
            stroke="#192946"
            strokeWidth={round2(h)}
            strokeLinecap="round"
            strokeDasharray={`${w} ${round2(w * 0.5 + h)}`}
            strokeDashoffset={row % 2 ? round2(w * 0.75) : 0}
          />
        )
      })}
      <rect x="-2000" y={L.kerb} width="5000" height="3000" fill="#1b2944" />
      <path d={`M-2000 ${L.kerb}H3000`} stroke="#2e4063" strokeWidth="3" />
    </g>
  )
}

/** The street lamp, and its warm light on the cobbles where the man stops. */
function Lamp({ id, L }: { readonly id: string; readonly L: Layout }) {
  const { x, y, top, side } = L.lamp
  const lx = x + side * 26
  const ground = L.man.y + 4
  return (
    <g className="atp-m-home-lamp" aria-hidden="true">
      <rect x={x - 3} y={top - 8} width="6" height={y - top + 8} rx="3" fill="#2a3550" />
      <rect x={x - 8} y={y - 12} width="16" height="12" rx="3" fill="#2a3550" />
      <path d={`M${x} ${top + 4}q0 -12 ${side * 12} -12h${side * 14}`} fill="none" stroke="#2a3550" strokeWidth="4.5" strokeLinecap="round" />
      <path d={`M${lx - 10} ${top + 1}l4 -7h12l4 7z`} fill="#3b4664" />
      <path d={`M${lx - 7} ${top + 1}h14l-2 15h-10z`} fill="#5a5444" />
      <rect x={lx - 7} y={top + 15} width="14" height="4" rx="2" fill="#3b4664" />
      <g data-part="lamp-light">
        <ellipse cx={lx} cy={ground} rx="116" ry="20" fill={`url(#${id}-pool)`} />
        <polygon points={`${lx - 7},${top + 17} ${lx + 7},${top + 17} ${lx + 90},${ground} ${lx - 90},${ground}`} fill={`url(#${id}-cone)`} />
        <circle cx={lx} cy={top + 8} r="54" fill={`url(#${id}-glow)`} />
        <path d={`M${lx - 7} ${top + 1}h14l-2 15h-10z`} fill="#ffd36b" />
        <path d={`M${lx - 3} ${top + 4}h6l-1 9h-4z`} fill="#fff3cf" />
      </g>
    </g>
  )
}

/** The house, cut away: a roof and chimney, bare walls, a window on the moon, the cold stove, the table and its bowls, the open door. */
function Home({ id, L, opened }: { readonly id: string; readonly L: Layout; readonly opened: boolean }) {
  const { room, stoveX: sx, doorTop } = L
  const F = room.floor
  const width = room.right - room.left
  const outerL = room.left - WALL
  const outerR = room.right + WALL
  const eaves = room.top - 12
  const mid = (outerL + outerR) / 2
  const overhang = 18
  // Where the roof's left slope is, over a given x.
  const slope = (x: number): number => eaves - ((x - (outerL - overhang)) * (eaves - L.ridge)) / (mid - (outerL - overhang))
  const pipeX = sx + 14
  const chimney = Math.round(slope(pipeX) - 30)
  const top = F - TABLE_H
  const left = L.table.x - L.table.w / 2
  const bowls = [0, 1, 2].map((index) => left + 20 + index * 25)
  const { x: wx, y: wy } = L.window
  const plaster = { x: room.left + Math.round(width * 0.5), y: room.top + 88 }
  const plank = (x: number): string => `M${x} ${round2(doorTop - (7 * x) / 38 + 3)}V${round2(F + (5 * x) / 38 - 3)}`
  return (
    <g className="atp-m-home" aria-hidden="true">
      {/* The chimney (smoking once the stove is lit), the roof, and the dark attic under it. */}
      <rect x={pipeX - 12} y={chimney} width="24" height="44" fill="#3a2f3d" />
      <rect x={pipeX - 15} y={chimney - 6} width="30" height="8" rx="2" fill="#4a3d4c" />
      <g data-part="smoke" opacity="0" fill="#aab4c8">
        {[
          [1, -14, 8],
          [-8, -30, 11],
          [-22, -48, 14],
        ].map(([dx, dy, r], index) => (
          <circle key={dy} cx={pipeX + (dx as number)} cy={chimney + (dy as number)} r={r} opacity={round2(0.34 - index * 0.08)} className="atp-m-puff" style={{ animationDelay: `${-index * 0.4}s` }} />
        ))}
      </g>
      <path d={`M${outerL - overhang} ${eaves}L${mid} ${L.ridge}L${outerR + overhang} ${eaves}Z`} fill="#121c33" />
      <path d={`M${mid} ${L.ridge + 8}V${eaves}`} stroke="#1a2741" strokeWidth="5" />
      <rect x={pipeX - 4.5} y={slope(pipeX)} width="9" height={eaves - slope(pipeX)} fill="#1f283b" />
      <path d={`M${outerL - overhang} ${eaves}L${mid} ${L.ridge}L${outerR + overhang} ${eaves}`} fill="none" stroke="#4b3343" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round" />
      <path d={`M${outerL - overhang} ${eaves - 6}L${mid} ${L.ridge - 6}L${outerR + overhang} ${eaves - 6}`} fill="none" stroke="#5f4152" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

      {/* The room: a bare back wall, plaster coming away, a window on the moon. */}
      <rect x={room.left} y={room.top} width={width} height={F - room.top} fill={`url(#${id}-wall)`} />
      <g transform={`translate(${plaster.x} ${plaster.y})`}>
        <path d="M-6 4Q-4 -6 10 -4Q30 -10 44 -2Q56 6 50 22Q44 34 26 30Q8 36 -2 26Q-12 16 -6 4Z" fill="#1b2a44" />
        <g fill="none" stroke="#2a3d5c" strokeWidth="1.5">
          <rect x="2" y="0" width="18" height="9" rx="1.5" />
          <rect x="22" y="0" width="18" height="9" rx="1.5" />
          <rect x="11" y="11" width="18" height="9" rx="1.5" />
          <rect x="31" y="11" width="14" height="9" rx="1.5" />
        </g>
      </g>
      <path d={`M${room.left + Math.round(width * 0.06)} ${room.top}l5 14l-6 10l8 16l-3 9`} fill="none" stroke="#172440" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${wx - 25} ${wy + 27}H${wx + 25}L${wx + 58} ${F}H${wx - 2}Z`} fill={`url(#${id}-beam)`} />
      <g transform={`translate(${wx} ${wy})`}>
        <rect x="-31" y="-29" width="62" height="58" rx="6" fill="#0a1730" />
        <g clipPath={`url(#${id}-glass)`}>
          <circle cx="14" cy="-12" r="10" fill="#fff3cf" />
          <circle cx="10.5" cy="-14.5" r="2.2" fill="#f0dfae" />
          <circle cx="-16" cy="-15" r="1.3" fill="#f6f1da" />
          <circle cx="-9" cy="13" r="1" fill="#f6f1da" />
          <circle cx="17" cy="16" r="1.1" fill="#f6f1da" />
        </g>
        <rect x="-31" y="-29" width="62" height="58" rx="6" fill="none" stroke="#2c4a66" strokeWidth="5" />
        <path d="M0 -29V29M-31 0H31" stroke="#2c4a66" strokeWidth="4" />
        <rect x="-37" y="29" width="74" height="6" rx="2" fill="#2f3a57" />
      </g>
      <rect x={room.left} y={F - 14} width={width} height="9" fill="#1a2741" />
      <rect x={room.left} y={F - 5} width={width} height="5" fill="#25324d" />

      {/* The stove, cold: nothing to burn, an empty pot on top. */}
      <rect x={pipeX - 4.5} y={room.top} width="9" height={F - 66 - room.top} fill="#1f283b" />
      <rect x={pipeX - 6.5} y={F - 92} width="13" height="5" rx="2" fill="#2a3550" />
      <rect x={sx - 22} y={F - 10} width="6" height="10" rx="2" fill="#1b2233" />
      <rect x={sx + 16} y={F - 10} width="6" height="10" rx="2" fill="#1b2233" />
      <rect x={sx - 26} y={F - 62} width="52" height="54" rx="9" fill="#2e3a56" stroke="#161d2d" strokeWidth="1.5" />
      <rect x={sx - 23} y={F - 58} width="4" height="44" rx="2" fill="#404d6c" />
      <rect x={sx - 29} y={F - 67} width="58" height="7" rx="3" fill="#43506f" />
      <rect x={sx - 14} y={F - 48} width="28" height="22" rx="4" fill="#0d1320" stroke="#4a5878" strokeWidth="2" />
      <g data-part="fire" opacity="0">
        <rect x={sx - 12} y={F - 46} width="24" height="18" rx="3" fill="#ff8a3d" opacity="0.6" />
        <path className="atp-m-flame" d={`M${sx - 4} ${F - 46}c5 5 7 10 3 15c-2 2 -4 2 -6 0c-4 -5 -2 -10 3 -15z`} fill="#ffb347" />
        <path className="atp-m-flame" d={`M${sx + 5} ${F - 42}c4 4 5 7 2 11c-1.5 1.5 -3 1.5 -4.5 0c-3 -4 -1.5 -7 2.5 -11z`} fill="#ffb347" />
        <path className="atp-m-flame is-core" d={`M${sx - 4} ${F - 38}c2.5 3 2.5 5.5 1 7h-2c-1.5 -1.5 -1.5 -4 1 -7z`} fill="#fff1b0" />
      </g>
      <path d={`M${sx - 6} ${F - 45}V${F - 29}M${sx} ${F - 45}V${F - 29}M${sx + 6} ${F - 45}V${F - 29}`} stroke="#2a3550" strokeWidth="2" />
      <rect x={sx - 14} y={F - 21} width="28" height="6" rx="2" fill="#222b40" />
      <path d={`M${sx - 23} ${F - 67}v-11q0 -4 4 -4h14q4 0 4 4v11z`} fill="#46526f" />
      <path d={`M${sx - 25} ${F - 78}h3M${sx - 2} ${F - 78}h3`} stroke="#46526f" strokeWidth="3" strokeLinecap="round" />

      {/* The table and three empty bowls; the food, when there is any. */}
      <rect x={left + 8} y={top + 4} width="7" height={TABLE_H - 4} rx="2" fill="#3f3128" />
      <rect x={left + L.table.w - 15} y={top + 4} width="7" height={TABLE_H - 4} rx="2" fill="#3f3128" />
      <rect x={left} y={top} width={L.table.w} height="8" rx="3" fill="#5d4a3c" />
      <rect x={left + 2} y={top} width={L.table.w - 4} height="2.5" rx="1.25" fill="#7a6350" />
      {bowls.map((bx) => (
        <ellipse key={bx} cx={bx} cy={top - 8} rx="10" ry="3.4" fill="#141b2a" />
      ))}
      <g data-part="soup" opacity="0">
        {bowls.map((bx) => (
          <ellipse key={bx} cx={bx} cy={top - 7.6} rx="8.4" ry="2.6" fill="#e0a94f" />
        ))}
      </g>
      {bowls.map((bx) => (
        <g key={bx}>
          <path d={`M${bx - 11} ${top - 8}Q${bx - 10} ${top} ${bx} ${top}Q${bx + 10} ${top} ${bx + 11} ${top - 8}Z`} fill="#b9c4d4" />
          <ellipse cx={bx} cy={top - 8} rx="10.5" ry="3.6" fill="none" stroke="#dbe3ee" strokeWidth="1.4" />
        </g>
      ))}
      <g data-part="steam" opacity="0" fill="none" stroke="#fbefd6" strokeWidth="2" strokeLinecap="round">
        {bowls.map((bx, index) => (
          <g key={bx}>
            <path d={`M${bx - 3} ${top - 13}q-3 -5 0 -9t0 -9`} opacity="0.55" className="atp-m-steam" style={{ animationDelay: `${-index * 0.5}s` }} />
            <path d={`M${bx + 3.5} ${top - 15}q3 -5 0 -9t0 -9`} opacity="0.55" className="atp-m-steam" style={{ animationDelay: `${-index * 0.5 - 0.8}s` }} />
          </g>
        ))}
      </g>

      {/* How the room feels: warm in the stove's light, or colder still. */}
      <g data-part="warmth" opacity="0" clipPath={`url(#${id}-room)`}>
        <rect x={room.left} y={room.top} width={width} height={F - room.top} fill={`url(#${id}-warm)`} />
        <circle cx={sx} cy={F - 40} r="90" fill={`url(#${id}-halo)`} />
      </g>
      <g data-part="chill" opacity="0" clipPath={`url(#${id}-room)`}>
        <rect x={room.left} y={room.top} width={width} height={F - room.top} fill="#050c1f" opacity="0.38" />
      </g>

      {/* The walls, cut away; the open doorway, and the door standing open. */}
      <rect x={outerL} y={eaves} width={WALL} height={F + 12 - eaves} fill="#34405e" />
      <rect x={room.right} y={eaves} width={WALL} height={doorTop - eaves} fill="#34405e" />
      <rect x={outerL} y={eaves} width={outerR - outerL} height="12" fill="#2a3550" />
      <rect x={outerL} y={F} width={outerR - outerL} height="12" fill="#2a3550" />
      <path d={`M${outerL + 3} ${eaves + 12}V${F}M${room.right + 3} ${eaves + 12}V${doorTop - 6}`} stroke="#46527a" strokeWidth="2" opacity="0.7" />
      <rect x={room.right - 4} y={doorTop - 7} width={WALL + 8} height="8" rx="2" fill="#4a3b30" />
      <rect x={room.right - 2} y={F - 3} width={WALL + 4} height="5" rx="2" fill="#4a3b30" />
      <g data-part="door" transform={doorSwing(L, opened ? 1 : 0.72)}>
        <path d={`M0 ${doorTop}L38 ${doorTop - 7}V${F + 5}L0 ${F}Z`} fill="#4f3d31" />
        <path d={`${plank(10)}${plank(19)}${plank(28)}`} stroke="#3f3027" strokeWidth="1.6" />
        <circle cx="31" cy={Math.round((doorTop + F) / 2)} r="2.4" fill="#c9a36b" />
      </g>
    </g>
  )
}

export function HomeScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, L })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)
  const children = useMemo(() => dilemma.trackA.filter(isPerson).slice(0, L.childXs.length), [dilemma, L])
  const man = useMemo(() => dilemma.trackB.find(isPerson), [dilemma])

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
  const { room } = L
  // He walks in from up the street, unless the choice is already made.
  const manAt = transform(opening ? L.man.stop : L.man.from, L.man.y)
  const hotspot = { x: L.man.stop, y: L.man.y - 40 }
  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.homeLabel[lang]}>
      <defs>
        <linearGradient id={`${id}-sky`} gradientUnits="userSpaceOnUse" x1="0" y1="-80" x2="0" y2={room.floor}>
          <stop offset="0" stopColor="#050c1f" />
          <stop offset="0.6" stopColor="#0c1c3f" />
          <stop offset="1" stopColor="#1a3263" />
        </linearGradient>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#263a58" />
          <stop offset="1" stopColor="#1c2b40" />
        </linearGradient>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe3f2" stopOpacity="0.16" />
          <stop offset="1" stopColor="#cfe3f2" stopOpacity="0.03" />
        </linearGradient>
        <radialGradient id={`${id}-warm`} gradientUnits="userSpaceOnUse" cx={L.stoveX} cy={room.floor - 40} r={Math.round((room.right - room.left) * 0.95)}>
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.52" />
          <stop offset="0.5" stopColor="#ff9a4d" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ff9a4d" stopOpacity="0.16" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-pool`}>
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.42" />
          <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-cone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c4" stopOpacity="0.42" />
          <stop offset="1" stopColor="#fff1c4" stopOpacity="0.04" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-room`}>
          <rect x={room.left} y={room.top} width={room.right - room.left} height={room.floor - room.top} />
        </clipPath>
        <clipPath id={`${id}-glass`}>
          <rect x="-29" y="-27" width="58" height="54" rx="4" />
        </clipPath>
      </defs>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          <rect x="-2000" y="-2000" width="5000" height="5000" fill={`url(#${id}-sky)`} />
          <g transform="translate(0 6)">
            <Stars />
          </g>
          <Street L={L} />
          <Home id={id} L={L} opened={opening !== null} />
          <Lamp id={id} L={L} />

          {/* The children, huddled in their shawls by the table. */}
          {children.map((actor, index) => (
            <g key={L.childXs[index]} data-part="child" transform={transform(L.childXs[index] as number, room.floor, 0, actor.scale ?? 1)}>
              <Figure actor={actor} youLabel={you} delay={index * 0.41} />
              <g data-part="shawl">
                <Shawl patch={[-12, 3, -6][index] ?? 0} />
              </g>
            </g>
          ))}

          {/* You, in the doorway, patched at the knee and the chest. */}
          <g data-part="you" transform={transform(L.you.x, L.you.y)}>
            <Figure actor={PARENT} youLabel={you} delay={1.1} />
            <rect x="2.5" y="-17" width="6" height="7" rx="1.5" fill="#a3abba" />
            <rect x="-10" y="-46" width="6" height="6" rx="1.5" fill="#94704c" />
          </g>

          {/* The man in the street, and his bread. */}
          {man && (
            <g data-part="man" transform={manAt}>
              <Figure actor={man} youLabel={you} delay={0.6} />
            </g>
          )}
          <g data-part="basket" transform={manAt} pointerEvents="none">
            <Basket />
          </g>

          <g data-part="labels" opacity="0">
            <Pill x={L.labels.pull.x} y={L.labels.pull.y} text={dilemma.verbs?.pull[lang] ?? UI.pull[lang]} tone="pull" />
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
        <rect data-part="dark" x="-2000" y="-2000" width="5000" height="5000" fill="#020713" opacity="0" pointerEvents="none" />
      </g>
    </svg>
  )
}
