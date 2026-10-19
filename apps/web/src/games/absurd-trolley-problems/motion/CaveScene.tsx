import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FOOT_UI, UI } from '../content/strings'
import type { PersonActor, TrolleyChoice } from '../content/types'
import { calm, fade, lose, lost, part, parts, shake } from './acting'
import { easeInOutCubic, easeInQuad, easeOutQuad, linear, round2, setAttr, Timeline, transform } from './animate'
import { Pill, Stars } from './Backdrop'
import { Figure } from './figures'
import type { Point } from './geometry'
import { emitter, isPerson, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * Philippa Foot's cave, in motion: the tide is coming in, and the large man
 * who led the way out is stuck in the only exit. In one version his head is
 * in the open air, and waiting drowns only the rest; in the other it is
 * inside, and waiting drowns him too. Blast him out with the dynamite, or wait.
 */

/** Which of Foot's two versions: his head outside the cave, or inside it. */
const headInside = (id: string): boolean => id === 'foot-cave-inside'
/** Lying down the tunnel he can be drawn at his full (large) size. */
const STUCK_INSIDE_SCALE = 1.25

/** The cave's shape and where everyone is in it, on a wide stage or a tall one. */
interface Layout {
  readonly viewBox: string
  /** The chamber and the tunnel up to the mouth: where the water can go. */
  readonly interior: string
  /** The opening to the night sky at the mouth, and how wide the blast leaves it. */
  readonly sky: string
  readonly blasted: string
  readonly floor: number
  readonly partyXs: readonly number[]
  readonly mouth: Point
  /** Head inside: where his feet stick out of the mouth, how he lies up the tunnel, and where his head ends up. */
  readonly inside: Point & { readonly angle: number; readonly head: Point }
  /** Where the tunnel meets the chamber floor, on the way out. */
  readonly tunnelFoot: number
  readonly throwFrom: Point
  /** The water's surface: low at first, over everyone's heads if you wait (up the whole tunnel with his head inside), behind the climbers if you blast. */
  readonly water: { readonly start: number; readonly risen: number; readonly drowned: number; readonly behind: number }
  readonly lamp: Point & { readonly r: number }
  readonly stalactites: { readonly xs: readonly number[]; readonly y: number }
  readonly moon: Point
  readonly labels: Readonly<Record<TrolleyChoice, Point>>
}

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: {
    viewBox: '40 40 920 480',
    interior: 'M70 420Q60 250 160 180Q300 120 470 150Q560 170 600 230L780 150Q800 140 840 150L852 196L690 300Q660 380 640 430Q400 452 70 420Z',
    sky: 'M760 168Q790 96 850 120Q880 150 860 200L820 210Z',
    blasted: 'M740 190Q760 70 860 90Q920 140 880 230L800 240Z',
    floor: 404,
    partyXs: [470, 410, 350, 290, 230],
    mouth: { x: 816, y: 176 },
    inside: { x: 828, y: 188, angle: 242, head: { x: 755, y: 227 } },
    tunnelFoot: 620,
    throwFrom: { x: 486, y: 352 },
    water: { start: 426, risen: 300, drowned: 192, behind: 372 },
    lamp: { x: 380, y: 320, r: 240 },
    stalactites: { xs: [120, 260, 420, 560], y: 150 },
    moon: { x: 900, y: 80 },
    labels: { pull: { x: 640, y: 130 }, stay: { x: 250, y: 250 } },
  },
  tall: {
    viewBox: '150 60 500 640',
    interior: 'M150 650Q130 500 210 440Q310 390 440 410L520 300Q550 230 560 190L624 196L612 260L560 420Q550 560 540 664Q340 684 150 650Z',
    sky: 'M556 196Q560 136 596 124Q636 118 644 160Q644 186 622 198L592 206Z',
    blasted: 'M520 220Q530 100 610 92Q680 96 680 180Q670 236 610 248L550 252Z',
    floor: 630,
    partyXs: [460, 405, 350, 295, 240],
    mouth: { x: 592, y: 200 },
    inside: { x: 596, y: 194, angle: 200, head: { x: 568, y: 271 } },
    tunnelFoot: 520,
    throwFrom: { x: 476, y: 578 },
    water: { start: 652, risen: 520, drowned: 226, behind: 590 },
    lamp: { x: 340, y: 540, r: 200 },
    stalactites: { xs: [240, 320, 400], y: 414 },
    moon: { x: 612, y: 132 },
    labels: { pull: { x: 430, y: 330 }, stay: { x: 260, y: 480 } },
  },
}

interface Nodes {
  readonly root: SVGGElement
  readonly camera: SVGGElement | null
  readonly water: SVGGElement | null
  readonly dynamite: SVGGElement | null
  readonly blast: SVGGElement | null
  readonly debris: SVGGElement | null
  readonly wide: SVGGElement | null
  readonly stuck: SVGGElement | null
  readonly held: SVGGElement | null
  readonly labels: SVGGElement | null
  readonly flash: SVGGElement | null
  readonly party: readonly SVGGElement[]
}

function gather(root: SVGGElement): Nodes {
  return {
    root,
    camera: part(root, 'camera'),
    water: part(root, 'water'),
    dynamite: part(root, 'dynamite'),
    blast: part(root, 'blast'),
    debris: part(root, 'debris'),
    wide: part(root, 'wide'),
    stuck: part(root, 'stuck'),
    held: part(root, 'held'),
    labels: part(root, 'labels'),
    flash: part(root, 'flash'),
    party: parts(root, 'caver'),
  }
}

const waterAt = (level: number): string => `translate(0 ${Math.round(level)})`
const figureOf = (holder: Element | null): Element | null => holder?.querySelector('.atp-m-figure') ?? null

/** Climbs from the chamber floor up the tunnel and out of the mouth. */
function climbOut(L: Layout, timeline: Timeline, caver: SVGGElement, fromX: number, delay: number): Promise<void> {
  const { mouth, floor, tunnelFoot } = L
  return timeline.wait(delay).then(() =>
    timeline.tween(
      1500,
      (v) => {
        const toFloor = Math.min(1, v * 2.2)
        const up = Math.max(0, (v - 0.45) / 0.55)
        const x = fromX + (tunnelFoot - fromX) * toFloor + (mouth.x - tunnelFoot) * up
        const y = floor - (floor - (mouth.y + 26)) * up - Math.abs(Math.sin(v * Math.PI * 8)) * 3
        setAttr(caver, 'transform', transform(x, y, 0, 1 - 0.25 * up))
        setAttr(caver, 'opacity', round2(v > 0.9 ? (1 - v) * 10 : 1))
      },
      linear,
    ),
  )
}

async function arrive(n: Nodes, L: Layout, timeline: Timeline, emit: Emit, turn: Turn): Promise<void> {
  const mine = turn.current
  n.root.dataset.state = 'arriving'
  emit('splash')
  await timeline.tween(900, (v) => setAttr(n.water, 'transform', waterAt(L.water.start + 20 * (1 - v))), easeOutQuad)
  if (turn.current !== mine || timeline.finished) return
  n.root.dataset.state = 'waiting'
  await fade(timeline, n.labels, 1, 400)
}

async function run(n: Nodes, L: Layout, timeline: Timeline, inside: boolean, choice: TrolleyChoice, emit: Emit, turn: Turn): Promise<void> {
  turn.current += 1
  timeline.skip()
  n.root.dataset.state = 'running'
  void fade(timeline, n.labels, 0, 200)
  const { mouth, throwFrom, water } = L
  if (choice === 'pull') {
    // The dynamite goes up the tunnel, fizzes, and the way out is blown open.
    setAttr(n.held, 'opacity', 0)
    setAttr(n.dynamite, 'opacity', 1)
    await timeline.tween(
      800,
      (v) => {
        const x = throwFrom.x + (mouth.x - 20 - throwFrom.x) * v
        const y = throwFrom.y + (mouth.y + 30 - throwFrom.y) * v - 120 * 4 * v * (1 - v)
        setAttr(n.dynamite, 'transform', transform(x, y, 360 * v))
      },
      easeInOutCubic,
    )
    emit('zap')
    await timeline.wait(500)
    emit('boom')
    setAttr(n.dynamite, 'opacity', 0)
    void shake(timeline, n.camera, 12)
    void timeline.tween(500, (v) => setAttr(n.flash, 'opacity', round2(0.55 * (1 - v))), easeOutQuad)
    void timeline.tween(
      700,
      (v) => {
        setAttr(n.blast, 'opacity', round2(1 - v))
        setAttr(n.blast, 'transform', `translate(${mouth.x} ${mouth.y}) scale(${round2(0.3 + 1.5 * v)})`)
        setAttr(n.debris, 'opacity', round2(1 - v))
        setAttr(n.debris, 'transform', `translate(${mouth.x} ${mouth.y}) scale(${round2(0.4 + 1.8 * v)})`)
      },
      easeOutQuad,
    )
    emit('impact', { kind: 'person', how: 'blast' })
    const man = figureOf(n.stuck)
    const losing = man ? lose(timeline, man) : Promise.resolve()
    void fade(timeline, n.wide, 1, 400)
    // Everyone climbs out while the water comes in behind them.
    void timeline.tween(2400, (v) => setAttr(n.water, 'transform', waterAt(water.start + (water.behind - water.start) * v)), easeInQuad)
    emit('cheer')
    await Promise.all([losing, ...n.party.map((caver, index) => climbOut(L, timeline, caver, L.partyXs[index] as number, 300 + index * 220))])
  } else {
    // Waiting: the tide rises over them all (and up the tunnel, over him, if his head is inside).
    emit('splash')
    const lostAt = n.party.map(() => false)
    const man = figureOf(n.stuck)
    let manLost = false
    const top = inside ? water.drowned : water.risen
    await timeline.tween(
      inside ? 3400 : 2600,
      (v) => {
        const level = water.start + (top - water.start) * v
        setAttr(n.water, 'transform', waterAt(level))
        // Under once the water is over their heads.
        for (const [index, caver] of n.party.entries()) {
          if (lostAt[index] || level > L.floor - 62) continue
          lostAt[index] = true
          emit('impact', { kind: 'person', how: 'drown' })
          const figure = figureOf(caver)
          if (figure) void lose(timeline, figure)
        }
        if (inside && !manLost && level <= L.inside.head.y + 8) {
          manLost = true
          emit('impact', { kind: 'person', how: 'drown' })
          if (man) void lose(timeline, man)
        }
      },
      linear,
    )
    if (man && !inside) calm(man)
  }
  n.root.dataset.state = 'done'
}

function aftermath(n: Nodes, L: Layout, inside: boolean, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  const man = figureOf(n.stuck)
  if (choice === 'pull') {
    setAttr(n.held, 'opacity', 0)
    setAttr(n.water, 'transform', waterAt(L.water.behind))
    setAttr(n.wide, 'opacity', 1)
    if (man) lost(man)
    for (const caver of n.party) setAttr(caver, 'opacity', 0)
  } else {
    setAttr(n.water, 'transform', waterAt(inside ? L.water.drowned : L.water.risen))
    if (man && inside) lost(man)
    else if (man) calm(man)
    for (const caver of n.party) {
      const figure = figureOf(caver)
      if (figure) lost(figure)
    }
  }
}

export function CaveScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const { mouth, throwFrom } = L
  const inside = headInside(dilemma.id)
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, L, inside })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)
  // You lead the party, dynamite in hand.
  const party = useMemo(
    () => dilemma.trackA.filter(isPerson).slice(0, L.partyXs.length).map((actor, index): PersonActor => (index === 0 ? { ...actor, marker: 'you' } : actor)),
    [dilemma, L],
  )
  const stuck = useMemo(() => dilemma.trackB.find(isPerson), [dilemma])

  useEffect(() => {
    latest.current = { onEvent, reducedMotion, L, inside }
    timelineRef.current?.setInstant(reducedMotion)
  })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const timeline = new Timeline(latest.current.reducedMotion)
    timelineRef.current = timeline
    const nodes = gather(root)
    if (opening) aftermath(nodes, latest.current.L, latest.current.inside, opening)
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
        return run(gather(root), latest.current.L, timeline, latest.current.inside, choice, emitter(timeline, latest), turn)
      },
    }),
    [],
  )

  const you = FOOT_UI.you[lang]
  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.caveLabel[lang]}>
      <defs>
        <clipPath id={`${id}-inside`}>
          <path d={L.interior} />
        </clipPath>
        <linearGradient id={`${id}-rock`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3029" />
          <stop offset="1" stopColor="#221c18" />
        </linearGradient>
        <radialGradient id={`${id}-blast`}>
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.5" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff5b4d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-lamp`}>
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          {/* Night outside, seen through the mouth; rock everywhere else. */}
          <rect x="-2000" y="-2000" width="5000" height="5000" fill="#0b1a3a" />
          <g transform="translate(0 -40)">
            <Stars />
          </g>
          <circle cx={L.moon.x} cy={L.moon.y} r="22" fill="#fff3cf" />
          <path d={`M-2000 -2000H3000V3000H-2000Z${L.sky}`} fill={`url(#${id}-rock)`} fillRule="evenodd" />
          <g data-part="wide" opacity="0">
            <path d={L.blasted} fill="#0b1a3a" />
          </g>
          <path d={L.interior} fill="#14100f" />
          <g clipPath={`url(#${id}-inside)`}>
            <circle cx={L.lamp.x} cy={L.lamp.y} r={L.lamp.r} fill={`url(#${id}-lamp)`} />
            {L.stalactites.xs.map((x) => (
              <path key={x} d={`M${x} ${L.stalactites.y}l10 26l10 -26z`} fill="#2d2520" />
            ))}
          </g>
          <path d={L.interior} fill="none" stroke="#4a3d33" strokeWidth="6" />

          {/* The large man, stuck fast in the way out: his head in the open air, or (the other version) down the tunnel, his legs sticking out. */}
          {stuck && (
            <g data-part="stuck" transform={inside ? transform(L.inside.x, L.inside.y, L.inside.angle, STUCK_INSIDE_SCALE) : transform(mouth.x, mouth.y + 52)}>
              <Figure actor={stuck} youLabel={you} delay={0.7} />
            </g>
          )}
          <path d={`M${mouth.x - 44} ${mouth.y + 36}Q${mouth.x} ${mouth.y + 20} ${mouth.x + 44} ${mouth.y + 30}L${mouth.x + 50} ${mouth.y + 60}H${mouth.x - 50}Z`} fill="#3a3029" />

          {party.map((actor, index) => (
            <g key={L.partyXs[index]} data-part="caver" transform={transform(L.partyXs[index] as number, L.floor)}>
              <Figure actor={actor} youLabel={you} delay={index * 0.39} />
              <circle cx="0" cy="-72" r="2.5" fill="#fff6cf" />
            </g>
          ))}

          <g clipPath={`url(#${id}-inside)`}>
            <g data-part="water" transform={waterAt(L.water.start)}>
              <path className="atp-m-wave is-long is-back" d="M-160 4q40 -8 80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0V600H-160Z" fill="#2b6aa8" opacity="0.5" />
              <path className="atp-m-wave is-long" d="M-200 0q40 -10 80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0t80 0V600H-200Z" fill="#3f86c9" opacity="0.6" />
            </g>
          </g>

          <g data-part="dynamite" opacity="0" transform={transform(throwFrom.x, throwFrom.y)}>
            <rect x="-10" y="-6" width="20" height="12" rx="3" fill="#d9473f" />
            <path d="M-10 -2h20M-10 2h20" stroke="#a3253a" strokeWidth="1.5" />
            <path d="M10 -4q8 -6 12 -12" fill="none" stroke="#c9a36b" strokeWidth="2" />
            <circle className="atp-m-spark" cx="22" cy="-16" r="3" fill="#ffd36b" />
          </g>
          <g data-part="blast" opacity="0">
            <circle r="90" fill={`url(#${id}-blast)`} />
          </g>
          <g data-part="debris" opacity="0" fill="#5a4a3e">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
              const angle = (index / 8) * Math.PI * 2
              return <rect key={index} x={Math.round(Math.cos(angle) * 40)} y={Math.round(Math.sin(angle) * 40)} width="9" height="7" rx="2" transform={`rotate(${index * 40})`} />
            })}
          </g>

          <g data-part="labels" opacity="0">
            <Pill x={L.labels.pull.x} y={L.labels.pull.y} text={`${dilemma.verbs?.pull[lang] ?? UI.pull[lang]} ↗`} tone="pull" />
            <Pill x={L.labels.stay.x} y={L.labels.stay.y} text={dilemma.verbs?.stay?.[lang] ?? UI.stay[lang]} tone="stay" />
          </g>

          <circle className="atp-m-hint" cx={throwFrom.x} cy={throwFrom.y} r="26" />
          <circle
            className="atp-m-hotspot"
            cx={throwFrom.x}
            cy={throwFrom.y}
            r="40"
            aria-hidden="true"
            onClick={() => {
              if (interactive) onLever?.('pull')
            }}
          />
          <g data-part="held" transform={transform(throwFrom.x, throwFrom.y)} pointerEvents="none">
            <rect x="-9" y="-5" width="18" height="10" rx="3" fill="#d9473f" />
            <path d="M9 -3q6 -5 9 -10" fill="none" stroke="#c9a36b" strokeWidth="2" />
          </g>
        </g>
        <rect data-part="flash" x="-2000" y="-2000" width="5000" height="5000" fill="#ffffff" opacity="0" pointerEvents="none" />
      </g>
    </svg>
  )
}
