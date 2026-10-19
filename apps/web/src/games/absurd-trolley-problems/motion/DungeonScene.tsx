import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CLOTH, HAIR, person, SKIN } from '../content/cast'
import { FOOT_UI, UI } from '../content/strings'
import type { PersonActor, TrolleyChoice } from '../content/types'
import { calm, cheer, fade, fall, fallenPose, lieDown, part, parts, setArms, slump, slumpedPose, walkTo } from './acting'
import { easeOutBack, easeOutQuad, linear, round2, setAttr, Timeline, transform } from './animate'
import { Pill } from './Backdrop'
import { Figure } from './figures'
import type { Point } from './geometry'
import { emitter, isPerson, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * Philippa Foot's dungeon, in motion. A tyrant who will torture five unless
 * you hurt one; a killer who will kill two unless you kill one; and the
 * tyrant's prisoners again, with a key that opens only one of their cells.
 */

type Variant = 'rescue' | 'tyrant' | 'madman'
type Side = 'left' | 'right'

const VARIANTS: Readonly<Record<string, Variant>> = { 'foot-rescue': 'rescue', 'foot-tyrant': 'tyrant', 'foot-madman': 'madman' }
const PLAYER = person({ top: CLOTH.mint, bottom: CLOTH.navy, hair: 'messy', hairColor: HAIR.black, marker: 'you' })
const TYRANT = person({ top: '#5b2333', bottom: '#3b1622', skin: SKIN.light, hair: 'short', hairColor: HAIR.grey, accessories: ['beard'], shoes: CLOTH.black })
const MADMAN = person({ top: CLOTH.purple, bottom: CLOTH.black, skin: SKIN.fair, hair: 'spiky', hairColor: HAIR.ginger, shoes: CLOTH.black })

/** Where the cells, the lever and everyone in the dungeon are, on a wide stage or a tall one. */
interface Layout {
  readonly viewBox: string
  /** The cells' top, and the floor everyone in them stands on. */
  readonly cellTop: number
  readonly floor: number
  readonly cells: Readonly<Record<Side, { readonly x: number; readonly w: number }>>
  /** Where the five (or the two) stand in the left cell, and the one in the right. */
  readonly leftXs: readonly number[]
  readonly pairXs: readonly number[]
  readonly rightX: number
  readonly you: Point
  readonly lever: Point
  readonly villain: Point
  /** Where you stand to unlock each cell's door. */
  readonly doors: Readonly<Record<Side, Point>>
  readonly labels: { readonly pull: Point; readonly stay: Point; readonly rescuePull: Point; readonly rescueStay: Point }
  /** The walls' foot, how many rows of stone, the torches along them, and the lines in the floor. */
  readonly wallFoot: number
  readonly rows: number
  readonly torches: readonly number[]
  readonly torchY: number
  readonly floorLines: readonly number[]
}

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: {
    viewBox: '40 40 920 480',
    cellTop: 196,
    floor: 400,
    cells: { left: { x: 84, w: 312 }, right: { x: 650, w: 210 } },
    leftXs: [124, 178, 232, 286, 340],
    pairXs: [190, 290],
    rightX: 755,
    you: { x: 476, y: 400 },
    lever: { x: 540, y: 396 },
    villain: { x: 560, y: 268 },
    doors: { left: { x: 402, y: 400 }, right: { x: 644, y: 400 } },
    labels: { pull: { x: 430, y: 250 }, stay: { x: 430, y: 216 }, rescuePull: { x: 300, y: 168 }, rescueStay: { x: 700, y: 168 } },
    wallFoot: 352,
    rows: 8,
    torches: [40, 520, 960],
    torchY: 150,
    floorLines: [388, 436, 492],
  },
  tall: {
    viewBox: '150 60 520 640',
    cellTop: 236,
    floor: 440,
    cells: { left: { x: 160, w: 290 }, right: { x: 520, w: 140 } },
    leftXs: [192, 240, 288, 336, 384],
    pairXs: [240, 330],
    rightX: 590,
    you: { x: 452, y: 620 },
    lever: { x: 520, y: 616 },
    villain: { x: 470, y: 200 },
    doors: { left: { x: 430, y: 480 }, right: { x: 548, y: 480 } },
    labels: { pull: { x: 590, y: 520 }, stay: { x: 590, y: 486 }, rescuePull: { x: 300, y: 504 }, rescueStay: { x: 590, y: 504 } },
    wallFoot: 470,
    rows: 11,
    torches: [196, 640],
    torchY: 140,
    floorLines: [510, 570, 640],
  },
}

interface Nodes {
  readonly root: SVGGElement
  readonly camera: SVGGElement | null
  readonly handle: SVGGElement | null
  readonly bolts: Readonly<Record<Side, SVGGElement | null>>
  readonly doors: Readonly<Record<Side, SVGGElement | null>>
  readonly you: SVGGElement | null
  readonly villain: SVGGElement | null
  readonly labels: SVGGElement | null
  readonly flash: SVGGElement | null
  readonly left: readonly SVGGElement[]
  readonly right: readonly SVGGElement[]
}

function gather(root: SVGGElement): Nodes {
  return {
    root,
    camera: part(root, 'camera'),
    handle: part(root, 'handle'),
    bolts: { left: part(root, 'bolt-left'), right: part(root, 'bolt-right') },
    doors: { left: part(root, 'door-left'), right: part(root, 'door-right') },
    you: part(root, 'you'),
    villain: part(root, 'villain'),
    labels: part(root, 'labels'),
    flash: part(root, 'flash'),
    left: parts(root, 'left-prisoner'),
    right: parts(root, 'right-prisoner'),
  }
}

const handleTransform = (angle: number): string => `rotate(${round2(angle)})`

/**
 * Which cell suffers for a choice. The cells hold the harmed groups: the
 * five (or two) are track A, hurt when you refuse; the one is track B, hurt
 * when you comply. Rescuing the five (pulling) leaves the one behind.
 */
const harmedSide = (choice: TrolleyChoice): Side => (choice === 'stay' ? 'left' : 'right')

/** Lightning from the coil over a cell: a flash, and everyone in it goes down. */
async function zap(n: Nodes, timeline: Timeline, side: Side, victims: readonly SVGGElement[], lethal: boolean, emit: Emit): Promise<void> {
  emit('zap')
  const bolt = n.bolts[side]
  await timeline.tween(
    600,
    (v) => {
      setAttr(bolt, 'opacity', round2(v < 0.15 ? v / 0.15 : Math.max(0, 1 - (v - 0.15) / 0.85) * (0.6 + 0.4 * Math.abs(Math.sin(v * 40)))))
      setAttr(n.flash, 'opacity', round2(0.3 * Math.max(0, 1 - v * 2)))
    },
    linear,
  )
  await Promise.all(
    victims.map((figure, index) => {
      emit('impact', { kind: 'person', how: 'zap' })
      return lethal ? fall(timeline, figure, index % 2 === 0 ? -1 : 1) : slump(timeline, figure, index % 2 === 0 ? -1 : 1)
    }),
  )
}

/** You open a cell: walk to its door, turn the key, and its prisoners come out cheering. */
async function rescue(n: Nodes, L: Layout, timeline: Timeline, side: Side, freed: readonly SVGGElement[], emit: Emit): Promise<void> {
  await walkTo(timeline, n.you, L.you, L.doors[side], 700)
  emit('creak')
  await timeline.tween(500, (v) => setAttr(n.doors[side], 'transform', `scale(${round2(1 - 0.85 * v)} 1)`), easeOutQuad)
  emit('cheer')
  await Promise.all(freed.map((figure) => cheer(timeline, figure)))
}

async function arrive(n: Nodes, timeline: Timeline, emit: Emit, turn: Turn): Promise<void> {
  const mine = turn.current
  n.root.dataset.state = 'arriving'
  emit('creak')
  await timeline.wait(500)
  if (turn.current !== mine || timeline.finished) return
  n.root.dataset.state = 'waiting'
  await fade(timeline, n.labels, 1, 400)
}

async function run(n: Nodes, L: Layout, timeline: Timeline, variant: Variant, choice: TrolleyChoice, emit: Emit, turn: Turn): Promise<void> {
  turn.current += 1
  timeline.skip()
  n.root.dataset.state = 'running'
  void fade(timeline, n.labels, 0, 200)
  const side = harmedSide(choice)
  const harmed = side === 'left' ? n.left : n.right
  const spared = side === 'left' ? n.right : n.left

  if (variant === 'rescue') {
    // Pulling rescues the five (on the left); the one is left behind, and the other way round.
    const freedSide = side === 'left' ? 'right' : 'left'
    await rescue(n, L, timeline, freedSide, spared, emit)
    await zap(n, timeline, side, harmed, false, emit)
  } else if (choice === 'pull') {
    // You do as you are told: the lever, and the one pays.
    emit('lever')
    await timeline.tween(320, (v) => setAttr(n.handle, 'transform', handleTransform(-35 + 70 * v)), easeOutBack)
    await zap(n, timeline, side, harmed, variant === 'madman', emit)
  } else {
    // You refuse; the villain does it himself.
    const villain = n.villain?.querySelector('.atp-m-figure')
    if (villain) await timeline.tween(300, (v) => setArms(villain, 10 + 150 * v), easeOutQuad)
    emit('roar')
    await zap(n, timeline, side, harmed, variant === 'madman', emit)
    if (villain) void timeline.tween(300, (v) => setArms(villain, 160 - 150 * v), easeOutQuad)
  }
  if (variant !== 'rescue' && spared.length > 0) {
    for (const figure of spared) calm(figure)
  }
  n.root.dataset.state = 'done'
}

function aftermath(n: Nodes, L: Layout, variant: Variant, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  const side = harmedSide(choice)
  const harmed = side === 'left' ? n.left : n.right
  const spared = side === 'left' ? n.right : n.left
  for (const [index, figure] of harmed.entries()) {
    const direction = index % 2 === 0 ? -1 : 1
    lieDown(figure, variant === 'madman' ? fallenPose(direction) : slumpedPose(direction))
    if (variant !== 'madman') setAttr(part(figure, 'body'), 'opacity', 0.55)
  }
  for (const figure of spared) calm(figure)
  if (variant === 'rescue') {
    const freedSide = side === 'left' ? 'right' : 'left'
    setAttr(n.doors[freedSide], 'transform', 'scale(0.15 1)')
    setAttr(n.you, 'transform', transform(L.doors[freedSide].x, L.doors[freedSide].y))
  } else if (choice === 'pull') {
    setAttr(n.handle, 'transform', handleTransform(35))
  }
}

/** A cell: a dark recess behind iron bars, with a barred door that can swing open. */
function Cell({ L, side, children }: { readonly L: Layout; readonly side: Side; readonly children?: ReactNode }) {
  const { x, w } = L.cells[side]
  const { cellTop: top, floor } = L
  const doorX = side === 'left' ? x + w - 64 : x + 16
  return (
    <g className="atp-m-cell">
      <rect x={x} y={top} width={w} height={floor - top + 14} rx="6" fill="#0d1424" />
      <rect x={x} y={top} width={w} height="14" fill="#1b2438" />
      {children}
      <g fill="#7d8aa3">
        {Array.from({ length: Math.floor(w / 26) + 1 }, (_, i) => x + 6 + i * 26)
          .filter((barX) => barX < doorX - 4 || barX > doorX + 52)
          .map((barX) => (
            <rect key={barX} x={barX} y={top + 8} width="5" height={floor - top} rx="2" />
          ))}
        <rect x={x - 4} y={top + 4} width={w + 8} height="8" rx="3" />
        <rect x={x - 4} y={floor + 4} width={w + 8} height="8" rx="3" />
      </g>
      <g transform={`translate(${side === 'left' ? doorX + 48 : doorX} 0)`}>
        <g data-part={`door-${side}`}>
          <g transform={`translate(${side === 'left' ? -48 : 0} 0)`} fill="#9aa6bc">
            {[6, 20, 34].map((dx) => (
              <rect key={dx} x={dx} y={top + 14} width="5" height={floor - top - 10} rx="2" />
            ))}
            <rect x="2" y={top + 12} width="44" height="7" rx="3" />
            <rect x="2" y={floor - 4} width="44" height="7" rx="3" />
            <rect x={side === 'left' ? 4 : 36} y={floor - 120} width="10" height="14" rx="3" fill="#c9a36b" />
          </g>
        </g>
      </g>
    </g>
  )
}

/** The device over a cell (whose top is `top`), and the lightning it throws. */
function Coil({ x, top, side }: { readonly x: number; readonly top: number; readonly side: Side }) {
  return (
    <g>
      <rect x={x - 22} y={top - 46} width="44" height="26" rx="6" fill="#3b4664" />
      <rect x={x - 3} y={top - 20} width="6" height="22" fill="#5d6f8c" />
      <circle cx={x} cy={top - 46} r="6" fill="#8fc4ff" className="atp-m-glow-pulse" />
      <path
        data-part={`bolt-${side}`}
        opacity="0"
        d={`M${x} ${top}L${x - 14} ${top + 54}L${x + 6} ${top + 66}L${x - 10} ${top + 134}L${x + 12} ${top + 72}L${x - 6} ${top + 60}L${x + 10} ${top}Z`}
        fill="#bfe3ff"
        stroke="#8fc4ff"
        strokeWidth="2"
      />
    </g>
  )
}

/** Stone walls, torchlight and a flagstone floor. */
function Dungeon({ id, L }: { readonly id: string; readonly L: Layout }) {
  const rows = Array.from({ length: L.rows }, (_, row) => row)
  return (
    <g className="atp-m-dungeon" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-torch`}>
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-2000" y="-2000" width="5000" height={2000 + L.wallFoot} fill="#1c2436" />
      {rows.map((row) =>
        Array.from({ length: 22 }, (_, i) => (
          <rect key={`${row}-${i}`} x={-120 + i * 64 + (row % 2) * 32} y={46 + row * 38} width="60" height="34" rx="4" fill={(row + i) % 3 === 0 ? '#232d43' : '#20293e'} />
        )),
      )}
      <rect x="-2000" y={L.wallFoot} width="5000" height="2400" fill="#151c2b" />
      {L.floorLines.map((y) => (
        <path key={y} d={`M-2000 ${y}H3000`} stroke="#1d2638" strokeWidth="2" />
      ))}
      {L.torches.map((x) => (
        <g key={x}>
          <circle cx={x} cy={L.torchY} r="120" fill={`url(#${id}-torch)`} />
          <rect x={x - 4} y={L.torchY - 2} width="8" height="26" rx="2" fill="#6b4a2b" />
          <path className="atp-m-flame" d={`M${x} ${L.torchY - 32}c8 8 10 16 4 24c-2 2 -6 2 -8 0c-6 -8 -4 -16 4 -24z`} fill="#ffb347" />
        </g>
      ))}
    </g>
  )
}

export function DungeonScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const variant = VARIANTS[dilemma.id] ?? 'tyrant'
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, variant, L })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)
  // Track A, hurt when you refuse (or rescue the one), waits in the left cell; track B in the right.
  const leftGroup = useMemo(() => dilemma.trackA.filter(isPerson).slice(0, L.leftXs.length), [dilemma, L])
  const rightOne = useMemo(() => dilemma.trackB.find(isPerson), [dilemma])

  useEffect(() => {
    latest.current = { onEvent, reducedMotion, variant, L }
    timelineRef.current?.setInstant(reducedMotion)
  })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const timeline = new Timeline(latest.current.reducedMotion)
    timelineRef.current = timeline
    const nodes = gather(root)
    if (opening) aftermath(nodes, latest.current.L, latest.current.variant, opening)
    else void arrive(nodes, timeline, emitter(timeline, latest), turn)
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
        return run(gather(root), latest.current.L, timeline, latest.current.variant, choice, emitter(timeline, latest), turn)
      },
    }),
    [],
  )

  const you = FOOT_UI.you[lang]
  const xs = leftGroup.length <= 2 ? L.pairXs : L.leftXs
  const villain = variant === 'tyrant' ? TYRANT : variant === 'madman' ? MADMAN : null
  const pullWord = dilemma.verbs?.pull[lang] ?? UI.pull[lang]
  const stayWord = dilemma.verbs?.stay?.[lang] ?? UI.stay[lang]
  const hotspot = variant === 'rescue' ? { x: L.you.x + 16, y: L.you.y - 26 } : { x: L.lever.x, y: L.lever.y - 40 }
  const prisoner = (actor: PersonActor, x: number, index: number, side: Side) => (
    <g key={`${side}-${x}`} data-part={`${side}-prisoner`} transform={transform(x, L.floor)}>
      <Figure actor={actor} youLabel={you} delay={index * 0.43} />
    </g>
  )

  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.dungeonLabel[lang]}>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          <Dungeon id={id} L={L} />
          <Cell L={L} side="left">
            {leftGroup.map((actor, index) => prisoner(actor, xs[index] as number, index, 'left'))}
          </Cell>
          <Cell L={L} side="right">
            {rightOne && prisoner(rightOne, L.rightX, 2, 'right')}
          </Cell>
          <Coil x={L.cells.left.x + L.cells.left.w / 2} top={L.cellTop} side="left" />
          <Coil x={L.cells.right.x + L.cells.right.w / 2} top={L.cellTop} side="right" />

          {villain && (
            <g data-part="villain" transform={transform(L.villain.x, L.villain.y)}>
              <rect x="-60" y="0" width="120" height="16" rx="4" fill="#2a3550" />
              {variant === 'tyrant' && <path d="M-22 -50Q-34 -10 -30 0H30Q34 -10 22 -50Z" fill="#a3253a" />}
              <Figure actor={villain} youLabel={you} delay={0.6} />
              {variant === 'tyrant' && <path d="M-12 -78l4 -10l4 6l4 -9l4 9l4 -6l4 10z" fill="#ffd36b" />}
              {variant === 'madman' && <path d="M-6 -59q6 5 12 0" fill="none" stroke="#1d1a1f" strokeWidth="2" strokeLinecap="round" />}
            </g>
          )}

          {variant !== 'rescue' && (
            <g transform={transform(L.lever.x, L.lever.y)}>
              <rect x="-20" y="-14" width="40" height="18" rx="5" fill="#3b4664" />
              <g data-part="handle" transform={handleTransform(-35)}>
                <rect x="-3" y="-62" width="6" height="56" rx="3" fill="#8a94a6" />
                <circle cx="0" cy="-64" r="9" fill="#d9473f" />
              </g>
            </g>
          )}

          <g data-part="you" transform={transform(L.you.x, L.you.y)}>
            <Figure actor={PLAYER} youLabel={you} delay={1.2} />
            {variant === 'rescue' && (
              <g transform="translate(16 -26)">
                <circle r="6" fill="none" stroke="#ffd36b" strokeWidth="3" />
                <rect x="4" y="-2" width="16" height="4" rx="2" fill="#ffd36b" />
                <rect x="14" y="2" width="3" height="6" fill="#ffd36b" />
              </g>
            )}
          </g>

          <g data-part="labels" opacity="0">
            {variant === 'rescue' ? (
              <>
                <Pill x={L.labels.rescuePull.x} y={L.labels.rescuePull.y} text={`← ${pullWord}`} tone="pull" />
                <Pill x={L.labels.rescueStay.x} y={L.labels.rescueStay.y} text={`${stayWord} →`} tone="stay" />
              </>
            ) : (
              <>
                <Pill x={L.labels.pull.x} y={L.labels.pull.y} text={pullWord} tone="pull" />
                <Pill x={L.labels.stay.x} y={L.labels.stay.y} text={stayWord} tone="stay" />
              </>
            )}
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
        <rect data-part="flash" x="-2000" y="-2000" width="5000" height="5000" fill="#bfe3ff" opacity="0" pointerEvents="none" />
      </g>
    </svg>
  )
}
