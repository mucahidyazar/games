import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { CLOTH, HAIR, person, SKIN } from '../content/cast'
import { FOOT_UI, UI } from '../content/strings'
import type { TrolleyChoice } from '../content/types'
import { fade, fadeAway, lost, part, walkTo } from './acting'
import { easeInOutCubic, linear, round2, setAttr, Timeline, transform } from './animate'
import { Pill } from './Backdrop'
import { Figure } from './figures'
import type { Point } from './geometry'
import { Bed } from './hospital'
import { monitor, WEAK_LINE } from './monitor'
import { emitter, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * The operations of the abortion debate, in motion, in an operating theatre
 * at night: the patient in bed, her heart monitor and the baby's, the
 * surgeon (you) and an empty cot. The scene takes no side: nobody is counted,
 * nobody's soul rises, nobody cheers. What happens is read off the two
 * monitors, and off the cot.
 */

type Variant = 'hysterectomy' | 'craniotomy' | 'either' | 'worst'

const VARIANTS: Readonly<Record<string, Variant>> = {
  'foot-hysterectomy': 'hysterectomy',
  'foot-craniotomy': 'craniotomy',
  'foot-mother-or-child': 'either',
  'foot-worst-dilemma': 'worst',
}

const PATIENT = person({ top: '#cfe3f2', bottom: '#cfe3f2', shoes: '#dfe7f0', skin: SKIN.light, hair: 'long', hairColor: HAIR.chestnut })
const SURGEON = person({ top: CLOTH.teal, bottom: CLOTH.teal, shoes: '#dfe7f0', skin: SKIN.tan, hair: 'short', hairColor: HAIR.black, accessories: ['cap'], hatColor: '#9be0d4', marker: 'you' })

/** What a choice comes to: whether time passes first, whether the curtain is drawn, and how mother and baby are left. */
interface Outcome {
  /** Nothing is done, or not yet: the clock goes round. */
  readonly waits: boolean
  /** The curtain is drawn round the bed: an operation, or (the worst dilemma) the delivery afterwards. */
  readonly curtain: boolean
  readonly mother: 'well' | 'lost'
  readonly baby: 'lost' | 'born'
}

function outcomeOf(variant: Variant, choice: TrolleyChoice): Outcome {
  if (choice === 'pull') return { waits: false, curtain: true, mother: 'well', baby: 'lost' }
  if (variant === 'either') return { waits: false, curtain: true, mother: 'lost', baby: 'born' }
  if (variant === 'worst') return { waits: true, curtain: true, mother: 'lost', baby: 'born' }
  return { waits: true, curtain: false, mother: 'lost', baby: 'lost' }
}

/** Where the theatre's furniture and its people are, on a wide stage or a tall one. */
interface Layout {
  readonly viewBox: string
  /** Where the wall meets the floor, and the lines across the floor. */
  readonly wallFoot: number
  readonly floorLines: readonly number[]
  readonly bed: Point & { readonly scale: number; readonly monitorAt: number }
  readonly surgeon: Point
  /** Where the surgeon stands at the bedside, behind the curtain. */
  readonly bedside: Point
  readonly fetal: Point & { readonly scale: number }
  readonly cot: Point & { readonly scale: number }
  readonly lamp: Point
  /** The curtain's rail: its left end (where the curtain is gathered), its length, and how far down it hangs. */
  readonly rail: { readonly x: number; readonly y: number; readonly width: number; readonly bottom: number }
  readonly door: { readonly x: number; readonly top: number }
  readonly clock: Point
  readonly labels: { readonly pull: Point; readonly stay: Point; readonly mother: Point; readonly baby: Point }
}

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: {
    viewBox: '40 40 920 480',
    wallFoot: 334,
    floorLines: [372, 420, 478],
    bed: { x: 470, y: 404, scale: 1.35, monitorAt: 96 },
    surgeon: { x: 318, y: 404 },
    bedside: { x: 420, y: 398 },
    fetal: { x: 700, y: 404, scale: 1.2 },
    cot: { x: 830, y: 404, scale: 1.25 },
    lamp: { x: 470, y: 112 },
    rail: { x: 382, y: 146, width: 176, bottom: 414 },
    door: { x: 66, top: 164 },
    clock: { x: 254, y: 128 },
    labels: { pull: { x: 318, y: 262 }, stay: { x: 254, y: 186 }, mother: { x: 600, y: 182 }, baby: { x: 806, y: 278 } },
  },
  tall: {
    viewBox: '150 60 500 640',
    wallFoot: 500,
    floorLines: [540, 600, 668],
    bed: { x: 392, y: 640, scale: 1.2, monitorAt: 88 },
    surgeon: { x: 226, y: 560 },
    bedside: { x: 352, y: 632 },
    fetal: { x: 588, y: 566, scale: 1.05 },
    cot: { x: 572, y: 684, scale: 1.05 },
    lamp: { x: 392, y: 300 },
    rail: { x: 322, y: 328, width: 142, bottom: 652 },
    door: { x: 170, top: 330 },
    clock: { x: 214, y: 150 },
    labels: { pull: { x: 236, y: 432 }, stay: { x: 278, y: 206 }, mother: { x: 432, y: 458 }, baby: { x: 578, y: 392 } },
  },
}

interface Nodes {
  readonly root: SVGGElement
  readonly camera: SVGGElement | null
  readonly labels: SVGGElement | null
  readonly mother: SVGGElement | null
  readonly fetal: SVGGElement | null
  readonly baby: SVGGElement | null
  readonly surgeon: SVGGElement | null
  readonly curtain: SVGGElement | null
  readonly glow: SVGGElement | null
  readonly sign: SVGGElement | null
  readonly hand: SVGGElement | null
}

function gather(root: SVGGElement): Nodes {
  return {
    root,
    camera: part(root, 'camera'),
    labels: part(root, 'labels'),
    mother: part(root, 'mother'),
    fetal: part(root, 'fetal-monitor'),
    baby: part(root, 'baby'),
    surgeon: part(root, 'surgeon'),
    curtain: part(root, 'curtain'),
    glow: part(root, 'glow'),
    sign: part(root, 'in-surgery'),
    hand: part(root, 'hand'),
  }
}

const GATHERED = 0.12
const curtainAt = (L: Layout, drawn: number): string => `translate(${L.rail.x} 0) scale(${round2(GATHERED + (1 - GATHERED) * drawn)} 1)`
const handAt = (turned: number): string => `rotate(${round2(300 * turned)})`
const figureOf = (holder: Element | null): Element | null => holder?.querySelector('.atp-m-figure') ?? null

/** Draws the curtain round the bed (1) or back (0), the lamp brightening while it is drawn. */
function drawCurtain(L: Layout, timeline: Timeline, n: Nodes, to: 0 | 1): Promise<void> {
  const from = to === 1 ? 0 : 1
  return timeline.tween(
    650,
    (v) => {
      const drawn = from + (to - from) * v
      setAttr(n.curtain, 'transform', curtainAt(L, drawn))
      setAttr(n.glow, 'opacity', round2(0.2 + 0.45 * drawn))
      setAttr(n.sign, 'opacity', round2(drawn))
    },
    easeInOutCubic,
  )
}

/** The mother's line goes flat and she fades where she lies. */
function loseMother(timeline: Timeline, n: Nodes): Promise<void> {
  monitor(n.mother, 'flat')
  const figure = figureOf(n.mother)
  return figure ? fadeAway(timeline, figure) : Promise.resolve()
}

/** The baby is born: into the cot, the baby's monitor beating well. */
async function bear(timeline: Timeline, n: Nodes): Promise<void> {
  monitor(n.fetal, 'well', 'fetal')
  await fade(timeline, n.baby, 1, 600)
}

async function arrive(n: Nodes, timeline: Timeline, turn: Turn): Promise<void> {
  const mine = turn.current
  n.root.dataset.state = 'arriving'
  await timeline.wait(450)
  if (turn.current !== mine || timeline.finished) return
  n.root.dataset.state = 'waiting'
  await fade(timeline, n.labels, 1, 400)
}

async function run(n: Nodes, L: Layout, timeline: Timeline, variant: Variant, choice: TrolleyChoice, emit: Emit, turn: Turn): Promise<void> {
  turn.current += 1
  timeline.skip()
  n.root.dataset.state = 'running'
  void fade(timeline, n.labels, 0, 200)
  const out = outcomeOf(variant, choice)

  if (out.waits) {
    // Time passes: the clock goes round, and the lines weaken to nothing.
    await timeline.tween(1600, (v) => setAttr(n.hand, 'transform', handAt(v)), linear)
    if (out.baby === 'lost') monitor(n.fetal, 'flat', 'fetal')
    await timeline.wait(450)
    await loseMother(timeline, n)
  }

  if (out.curtain) {
    // Behind the curtain: the operation, or the delivery once the mother is gone.
    emit('creak')
    await Promise.all([drawCurtain(L, timeline, n, 1), walkTo(timeline, n.surgeon, L.surgeon, L.bedside, 650)])
    await timeline.wait(900)
    if (out.mother === 'well') monitor(n.mother, 'well')
    else if (!out.waits) monitor(n.mother, 'flat')
    if (out.baby === 'lost') monitor(n.fetal, 'flat', 'fetal')
    await Promise.all([drawCurtain(L, timeline, n, 0), walkTo(timeline, n.surgeon, L.bedside, L.surgeon, 650)])
    const fading = out.mother === 'lost' && !out.waits ? loseMother(timeline, n) : Promise.resolve()
    await Promise.all([fading, out.baby === 'born' ? bear(timeline, n) : Promise.resolve()])
  }
  n.root.dataset.state = 'done'
}

function aftermath(n: Nodes, variant: Variant, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  const out = outcomeOf(variant, choice)
  if (out.waits) setAttr(n.hand, 'transform', handAt(1))
  monitor(n.mother, out.mother === 'well' ? 'well' : 'flat')
  const figure = figureOf(n.mother)
  if (figure && out.mother === 'lost') lost(figure)
  monitor(n.fetal, out.baby === 'born' ? 'well' : 'flat', 'fetal')
  setAttr(n.baby, 'opacity', out.baby === 'born' ? 1 : 0)
}

/** A cubicle curtain, drawn out from its left end: pale fabric in soft folds under a band of hooks. */
function Curtain({ L }: { readonly L: Layout }) {
  const { width, y, bottom } = L.rail
  const folds = Math.round(width / 16)
  const step = width / folds
  return (
    <g data-part="curtain" transform={curtainAt(L, 0)}>
      <rect x="0" y={y} width={width} height={bottom - y} fill="#b9d2da" />
      {Array.from({ length: folds }, (_, index) => (
        <rect key={index} x={round2(index * step + step / 2)} y={y + 8} width={round2(step / 2)} height={bottom - y - 8} fill="#a2bfc8" />
      ))}
      <rect x="0" y={y} width={width} height="9" fill="#d3e4ea" />
      <rect x="0" y={bottom - 6} width={width} height="6" fill="#93b2bc" />
    </g>
  )
}

/** The baby's heart monitor on its stand: a small footprint on the screen says whose heart it is. */
function FetalMonitor({ L }: { readonly L: Layout }) {
  const { x, y, scale } = L.fetal
  return (
    <g data-part="fetal-monitor" transform={transform(x, y, 0, scale)}>
      <ellipse cx="0" cy="2" rx="18" ry="4" className="atp-m-shadow" />
      <rect x="-14" y="-6" width="28" height="6" rx="3" fill="#5d6f8c" />
      <rect x="-2" y="-112" width="4" height="108" fill="#5d6f8c" />
      <rect x="-27" y="-146" width="54" height="34" rx="5" fill="#0d1a2c" stroke="#5d6f8c" strokeWidth="2" />
      <g transform="translate(-19 -133)" fill="#8fc4ff">
        <ellipse cx="0" cy="2.2" rx="2.6" ry="4" />
        <circle cx="-1.8" cy="-3.6" r="1" />
        <circle cx="0.2" cy="-4.2" r="0.9" />
        <circle cx="2" cy="-3.4" r="0.8" />
      </g>
      <path data-part="fetal" className="atp-m-ecg is-weak" d={WEAK_LINE} transform="translate(5 -128) scale(0.9 1)" />
    </g>
  )
}

/** A clear cot on a wheeled stand, and the swaddled baby who may be laid in it. */
function Cot({ L }: { readonly L: Layout }) {
  const { x, y, scale } = L.cot
  return (
    <g transform={transform(x, y, 0, scale)}>
      <ellipse cx="0" cy="2" rx="34" ry="5" className="atp-m-shadow" />
      <rect x="-28" y="-7" width="56" height="5" rx="2.5" fill="#5d6f8c" />
      <circle cx="-23" cy="-1" r="3.4" fill="#2a3550" />
      <circle cx="23" cy="-1" r="3.4" fill="#2a3550" />
      <rect x="-3" y="-34" width="6" height="28" fill="#5d6f8c" />
      <rect x="-30" y="-40" width="60" height="7" rx="3" fill="#e6edf5" />
      <g data-part="baby" opacity="0">
        <ellipse cx="4" cy="-45" rx="19" ry="7.5" fill="#f3efe7" />
        <path d="M-6 -50q10 -3 22 1" fill="none" stroke="#d9cfbf" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="-15" cy="-46" r="6.5" fill={SKIN.light} />
        <path d="M-21 -47a6.5 6.5 0 0 1 11 -4.5" fill="none" stroke="#7a4524" strokeWidth="2" strokeLinecap="round" />
        <path d="M-17.5 -45.5h1.6M-13.6 -45.5h1.6" stroke="#1d1a1f" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      <rect x="-34" y="-68" width="68" height="30" rx="7" fill="#cfe3f2" opacity="0.18" stroke="#a9c3dc" strokeWidth="2" />
    </g>
  )
}

/** The theatre at night: tiled walls, swing doors with round windows and a light over them, a clock. */
function Theatre({ id, L }: { readonly id: string; readonly L: Layout }) {
  const { wallFoot, door, clock, lamp, bed, rail } = L
  const ground = bed.y
  return (
    <g className="atp-m-theatre" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6cf" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff6cf" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="-2000" y="-2000" width="5000" height={2000 + wallFoot} fill="#173a44" />
      {Array.from({ length: 9 }, (_, index) => wallFoot - 40 - index * 46).map((y) => (
        <path key={y} d={`M-2000 ${y}H3000`} stroke="#1b4350" strokeWidth="2" />
      ))}
      <rect x="-2000" y={wallFoot - 16} width="5000" height="16" fill="#12303a" />
      <rect x="-2000" y={wallFoot} width="5000" height="2400" fill="#10262f" />
      {L.floorLines.map((y) => (
        <path key={y} d={`M-2000 ${y}H3000`} stroke="#183641" strokeWidth="2" />
      ))}

      {/* Swing doors, and the light over them that is on while someone is being operated on. */}
      <g>
        <rect x={door.x} y={door.top} width="122" height={wallFoot - door.top} fill="#20434e" stroke="#2c5866" strokeWidth="5" />
        <path d={`M${door.x + 61} ${door.top}V${wallFoot}`} stroke="#2c5866" strokeWidth="4" />
        {[30, 92].map((dx) => (
          <circle key={dx} cx={door.x + dx} cy={door.top + 42} r="12" fill="#0a1730" stroke="#3c6b7a" strokeWidth="3" />
        ))}
        <rect x={door.x + 12} y={wallFoot - 46} width="98" height="9" rx="2" fill="#2c5866" />
        <rect x={door.x + 41} y={door.top - 24} width="40" height="14" rx="4" fill="#2a1a22" />
        <rect data-part="in-surgery" x={door.x + 44} y={door.top - 21} width="34" height="8" rx="3" fill="#ff5b4d" opacity="0" />
      </g>

      <g transform={`translate(${clock.x} ${clock.y})`}>
        <circle r="22" fill="#e9eef5" stroke="#5d6f8c" strokeWidth="4" />
        <g data-part="hand">
          <path d="M0 0V-14" stroke="#1b2d55" strokeWidth="3" strokeLinecap="round" />
        </g>
        <path d="M0 0H9" stroke="#1b2d55" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* The operating lamp on its arm, and its light, brighter while the curtain is drawn. */}
      <rect x={lamp.x - 3} y="-2000" width="6" height={2000 + lamp.y - 34} fill="#5d6f8c" />
      <circle cx={lamp.x} cy={lamp.y - 34} r="6" fill="#8fa3bf" />
      <rect x={lamp.x - 3} y={lamp.y - 34} width="6" height="20" fill="#5d6f8c" />
      <g data-part="glow" opacity="0.2">
        <polygon points={`${lamp.x - 46},${lamp.y + 6} ${lamp.x + 46},${lamp.y + 6} ${bed.x + 110},${ground} ${bed.x - 110},${ground}`} fill={`url(#${id}-light)`} />
      </g>
      <path d={`M${lamp.x - 62} ${lamp.y}q62 -38 124 0z`} fill="#dfe7f0" />
      <ellipse cx={lamp.x} cy={lamp.y} rx="62" ry="9" fill="#a9bcd6" />
      <ellipse cx={lamp.x} cy={lamp.y + 2} rx="42" ry="5" fill="#fff6cf" opacity="0.7" />

      <rect x={rail.x - 6} y={rail.y - 5} width={rail.width + 12} height="6" rx="3" fill="#8fa3bf" />
    </g>
  )
}

export function TheatreScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const variant = VARIANTS[dilemma.id] ?? 'hysterectomy'
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, variant, L })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)

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
    if (opening) aftermath(nodes, latest.current.variant, opening)
    else void arrive(nodes, timeline, turn)
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
  const { bed, surgeon, lamp } = L
  // Mother or baby: each button's words by the one it saves; otherwise by the surgeon, and by the clock.
  const pullAt = variant === 'either' ? L.labels.mother : L.labels.pull
  const stayAt = variant === 'either' ? L.labels.baby : L.labels.stay
  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.theatreLabel[lang]}>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          <Theatre id={id} L={L} />
          <Cot L={L} />
          <FetalMonitor L={L} />
          <g data-part="mother" transform={transform(bed.x, bed.y, 0, bed.scale)}>
            <Bed actor={PATIENT} youLabel={you} delay={0.6} monitorAt={bed.monitorAt} expecting />
          </g>
          <g data-part="surgeon" transform={transform(surgeon.x, surgeon.y)}>
            <Figure actor={SURGEON} youLabel={you} delay={0.2} />
          </g>
          <Curtain L={L} />

          <g data-part="labels" opacity="0">
            <Pill x={stayAt.x} y={stayAt.y} text={dilemma.verbs?.stay?.[lang] ?? UI.stay[lang]} tone="stay" />
            <Pill x={pullAt.x} y={pullAt.y} text={dilemma.verbs?.pull[lang] ?? UI.pull[lang]} tone="pull" />
          </g>

          <circle className="atp-m-hint" cx={lamp.x} cy={lamp.y} r="30" />
          <circle
            className="atp-m-hotspot"
            cx={lamp.x}
            cy={lamp.y}
            r="48"
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
