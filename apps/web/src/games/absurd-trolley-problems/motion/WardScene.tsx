import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CLOTH, HAIR, person, SKIN } from '../content/cast'
import { FOOT_UI, UI } from '../content/strings'
import type { TrolleyChoice } from '../content/types'
import { calm, cheer, fade, lose, lost, part, parts, walk } from './acting'
import { easeInOutCubic, easeOutBack, easeOutQuad, round2, setAttr, Timeline, transform } from './animate'
import { Pill } from './Backdrop'
import { Figure } from './figures'
import type { Point } from './geometry'
import { Bed } from './hospital'
import { monitor } from './monitor'
import { emitter, isPerson, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * Philippa Foot's doctor, in motion, on a hospital ward at night: five
 * patients on one side, one on the other. The drug can go to the one or be
 * shared by the five; the whole ward can stay with one patient or turn to
 * five crash victims; a serum for the five would cost a healthy man's life,
 * or a starving beggar's, if he is turned away; a gas that saves the five
 * would poison the patient next door.
 */

type Variant = 'drug' | 'crash' | 'serum' | 'beggar' | 'gas'

const VARIANTS: Readonly<Record<string, Variant>> = {
  'foot-drug': 'drug',
  'foot-crash': 'crash',
  'foot-serum': 'serum',
  'foot-beggar': 'beggar',
  'foot-gas': 'gas',
}
/** Who stands rather than lies in a bed: the healthy man, and the beggar at the door. */
const standing = (variant: Variant): boolean => variant === 'serum' || variant === 'beggar'
/** Where the one is spent to make a serum for the five. */
const makesSerum = (variant: Variant): boolean => variant === 'serum' || variant === 'beggar'
const DOCTOR_LOOK = person({ top: '#f4f6f8', bottom: CLOTH.navy, skin: SKIN.medium, hair: 'short', hairColor: HAIR.black, accessories: ['glasses'], marker: 'you' })

/** Where the beds, the doctor and the furniture are, on a wide stage or a tall one. */
interface Layout {
  readonly viewBox: string
  /** The five beds: their x, the floor they stand on, how big, and how far out the monitor stands. */
  readonly beds: { readonly xs: readonly number[]; readonly y: number; readonly scale: number; readonly monitor: number }
  readonly single: Point
  readonly doctor: Point
  readonly hand: Point
  /** The gas machine: its middle, and its top. */
  readonly machine: Point
  readonly pipeTo: number
  readonly windows: readonly number[]
  readonly clock: Point
  readonly cross: Point
  /** The wall between the ward and the room next door (the gas). */
  readonly partition: { readonly x: number; readonly bottom: number; readonly vent: number }
  readonly labels: { readonly stay: Point; readonly pull: Point; readonly pullGas: Point }
  readonly floorLines: readonly number[]
  readonly mist: { readonly gas: number; readonly fumes: number }
}

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: {
    viewBox: '40 40 920 480',
    beds: { xs: [492, 584, 676, 768, 860], y: 404, scale: 1, monitor: 60 },
    single: { x: 150, y: 404 },
    doctor: { x: 318, y: 404 },
    hand: { x: 340, y: 342 },
    machine: { x: 400, y: 236 },
    pipeTo: 900,
    windows: [600, 760],
    clock: { x: 470, y: 128 },
    cross: { x: 150, y: 130 },
    partition: { x: 236, bottom: 430, vent: 190 },
    labels: { stay: { x: 228, y: 244 }, pull: { x: 452, y: 252 }, pullGas: { x: 520, y: 222 } },
    floorLines: [372, 420, 478],
    mist: { gas: 70, fumes: 110 },
  },
  tall: {
    viewBox: '140 70 520 640',
    beds: { xs: [182, 284, 386, 488, 590], y: 620, scale: 0.9, monitor: 54 },
    single: { x: 232, y: 430 },
    doctor: { x: 420, y: 446 },
    hand: { x: 442, y: 384 },
    machine: { x: 524, y: 312 },
    pipeTo: 720,
    windows: [340, 480],
    clock: { x: 630, y: 128 },
    cross: { x: 190, y: 128 },
    partition: { x: 320, bottom: 452, vent: 230 },
    labels: { stay: { x: 232, y: 248 }, pull: { x: 452, y: 300 }, pullGas: { x: 524, y: 262 } },
    floorLines: [372, 460, 560, 680],
    mist: { gas: 56, fumes: 90 },
  },
}

interface Nodes {
  readonly root: SVGGElement
  readonly camera: SVGGElement | null
  readonly item: SVGGElement | null
  /** The empty vial the beggar's serum goes into, once the soup is put away. */
  readonly vial: SVGGElement | null
  readonly doses: readonly SVGGElement[]
  readonly vialFill: SVGGElement | null
  readonly stream: SVGGElement | null
  readonly gas: SVGGElement | null
  readonly fumes: SVGGElement | null
  readonly needle: SVGGElement | null
  readonly valve: SVGGElement | null
  readonly labels: SVGGElement | null
  readonly five: readonly SVGGElement[]
  readonly one: SVGGElement | null
}

function gather(root: SVGGElement): Nodes {
  return {
    root,
    camera: part(root, 'camera'),
    item: part(root, 'item'),
    vial: part(root, 'vial'),
    doses: parts(root, 'dose'),
    vialFill: part(root, 'vial-fill'),
    stream: part(root, 'stream'),
    gas: part(root, 'gas'),
    fumes: part(root, 'fumes'),
    needle: part(root, 'needle'),
    valve: part(root, 'valve'),
    labels: part(root, 'labels'),
    five: parts(root, 'patient'),
    one: part(root, 'single'),
  }
}

/** The figure in a bed (or standing), for the acting helpers. */
const figureOf = (holder: Element | null): Element | null => holder?.querySelector('.atp-m-figure') ?? null

/** Something glowing flies in an arc from the doctor's hand to (x, y). */
function fly(L: Layout, timeline: Timeline, node: Element | null, x: number, y: number, duration: number): Promise<void> {
  const { hand } = L
  setAttr(node, 'opacity', 1)
  return timeline.tween(
    duration,
    (v) => {
      const px = hand.x + (x - hand.x) * v
      const py = hand.y + (y - hand.y) * v - 90 * 4 * v * (1 - v)
      setAttr(node, 'transform', transform(px, py, 0, 1 - 0.3 * v))
      if (v >= 1) setAttr(node, 'opacity', 0)
    },
    easeInOutCubic,
  )
}

/** Where a dose lands on each of the five beds. */
const toBeds = (L: Layout, timeline: Timeline, doses: readonly SVGGElement[]): Promise<void[]> =>
  Promise.all(doses.map((dose, index) => fly(L, timeline, dose, L.beds.xs[index] as number, L.beds.y - 92 * L.beds.scale, 700 + index * 90)))

/** The one walks out of the ward, and out of sight however wide the stage. */
async function leave(L: Layout, timeline: Timeline, one: SVGGElement | null): Promise<void> {
  await walk(timeline, one, L.single.x, -120, L.single.y, 1400)
  await fade(timeline, one, 0, 300)
}

/** A patient made well: a strong heartbeat, and arms in the air. */
async function recover(timeline: Timeline, patient: Element | null, emit: Emit): Promise<void> {
  monitor(patient, 'well')
  emit('heal')
  const figure = figureOf(patient)
  if (figure) await cheer(timeline, figure)
}

/** A patient lost: the line goes flat. */
function flatline(timeline: Timeline, patient: Element | null, emit: Emit): Promise<void> {
  monitor(patient, 'flat')
  setAttr(part(patient, 'bandage'), 'opacity', 0.5)
  emit('impact', { kind: 'person', how: 'flatline' })
  const figure = figureOf(patient)
  return figure ? lose(timeline, figure) : Promise.resolve()
}

async function arrive(n: Nodes, timeline: Timeline, emit: Emit, turn: Turn): Promise<void> {
  const mine = turn.current
  n.root.dataset.state = 'arriving'
  emit('bell')
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
  const flatlines = (patients: readonly (Element | null)[]) =>
    Promise.all(patients.map((patient, index) => timeline.wait(index * 220).then(() => flatline(timeline, patient, emit))))

  if (variant === 'drug' || variant === 'crash') {
    emit('push')
    if (choice === 'pull') {
      // Shared: a fifth of the drug, or of the ward's care, for each of the five.
      setAttr(n.item, 'opacity', 0)
      await toBeds(L, timeline, n.doses)
      await Promise.all([...n.five.map((patient) => recover(timeline, patient, emit)), flatline(timeline, n.one, emit)])
    } else {
      await fly(L, timeline, n.item, L.single.x, L.single.y - 92, 800)
      await Promise.all([recover(timeline, n.one, emit), flatlines(n.five)])
    }
  } else if (makesSerum(variant)) {
    if (choice === 'pull') {
      // The healthy man's life, or the starving beggar's, drawn into the vial.
      const man = figureOf(n.one)
      if (variant === 'beggar') {
        void fade(timeline, n.item, 0, 300)
        await fade(timeline, n.vial, 1, 300)
      }
      void fade(timeline, n.stream, 1, 300)
      emit('impact', { kind: 'person', how: 'flatline' })
      await Promise.all([man ? lose(timeline, man) : Promise.resolve(), timeline.tween(900, (v) => setAttr(n.vialFill, 'transform', `translate(0 ${round2(16 * (1 - v))}) scale(1 ${round2(v)})`), easeOutQuad)])
      void fade(timeline, n.stream, 0, 300)
      emit('push')
      await toBeds(L, timeline, n.doses)
      await Promise.all(n.five.map((patient) => recover(timeline, patient, emit)))
    } else if (variant === 'beggar') {
      // The soup goes to the beggar, who eats and goes on his way; nothing is left for the five.
      emit('push')
      await fly(L, timeline, n.item, L.single.x + 18, L.single.y - 40, 800)
      const man = figureOf(n.one)
      emit('heal')
      if (man) await cheer(timeline, man)
      await Promise.all([leave(L, timeline, n.one), flatlines(n.five)])
    } else {
      // He goes home; nothing can be done for the five.
      calm(figureOf(n.one) as Element)
      await Promise.all([leave(L, timeline, n.one), flatlines(n.five)])
    }
  } else if (choice === 'pull') {
    // The gas: the valve turns, the ward fills, and the fumes find the room next door.
    emit('lever')
    await timeline.tween(
      420,
      (v) => {
        setAttr(n.valve, 'transform', `rotate(${Math.round(90 * v)})`)
        setAttr(n.needle, 'transform', `rotate(${Math.round(-60 + 120 * v)})`)
      },
      easeOutBack,
    )
    emit('splash')
    await Promise.all([fade(timeline, n.gas, 1, 900), fade(timeline, n.fumes, 1, 1400)])
    await Promise.all([...n.five.map((patient) => recover(timeline, patient, emit)), flatline(timeline, n.one, emit)])
  } else {
    await flatlines(n.five)
  }
  const saved = variant === 'gas' || variant === 'serum' ? choice === 'pull' : true
  if (saved) emit('cheer')
  n.root.dataset.state = 'done'
}

function aftermath(n: Nodes, variant: Variant, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  const settle = (patient: Element | null, well: boolean) => {
    monitor(patient, well ? 'well' : 'flat')
    if (!well) setAttr(part(patient, 'bandage'), 'opacity', 0.5)
    const figure = figureOf(patient)
    if (!figure) return
    if (well) calm(figure)
    else lost(figure)
  }
  if (variant === 'drug' || variant === 'crash') {
    setAttr(n.item, 'opacity', 0)
    for (const patient of n.five) settle(patient, choice === 'pull')
    settle(n.one, choice === 'stay')
  } else if (makesSerum(variant)) {
    for (const patient of n.five) settle(patient, choice === 'pull')
    if (variant === 'beggar') {
      setAttr(n.item, 'opacity', 0)
      setAttr(n.vial, 'opacity', choice === 'pull' ? 1 : 0)
    }
    if (choice === 'pull') {
      lost(figureOf(n.one) as Element)
      setAttr(n.vialFill, 'transform', 'translate(0 0) scale(1 1)')
    } else {
      setAttr(n.one, 'opacity', 0)
    }
  } else {
    for (const patient of n.five) settle(patient, choice === 'pull')
    if (choice === 'pull') {
      settle(n.one, false)
      setAttr(n.valve, 'transform', 'rotate(90)')
      setAttr(n.needle, 'transform', 'rotate(60)')
      setAttr(n.gas, 'opacity', 1)
      setAttr(n.fumes, 'opacity', 1)
    } else {
      settle(n.one, true)
    }
  }
}

/** An empty vial, ready for the serum: its fill grows from the bottom. */
function Vial() {
  return (
    <g>
      <rect x="-6" y="-22" width="12" height="26" rx="4" fill="#cfe3f2" opacity="0.85" />
      <g transform="translate(0 2)">
        <rect data-part="vial-fill" x="-4" y="-18" width="8" height="18" rx="2" fill="#7fe3b8" transform="translate(0 16) scale(1 0)" />
      </g>
    </g>
  )
}

/** The ward at night: pale walls, two windows on the dark, a clock; sirens outside after the crash, a door to the street for the beggar. */
function Ward({ L, variant }: { readonly L: Layout; readonly variant: Variant }) {
  const { partition, single } = L
  return (
    <g className="atp-m-ward" aria-hidden="true">
      <rect x="-2000" y="-2000" width="5000" height={2000 + 334} fill="#1a3448" />
      <rect x="-2000" y="318" width="5000" height="16" fill="#132838" />
      <rect x="-2000" y="334" width="5000" height="2400" fill="#122532" />
      {L.floorLines.map((y) => (
        <path key={y} d={`M-2000 ${y}H3000`} stroke="#1b3445" strokeWidth="2" />
      ))}
      {L.windows.map((x) => (
        <g key={x}>
          <rect x={x} y="96" width="120" height="118" rx="6" fill="#0a1730" stroke="#2c4a66" strokeWidth="6" />
          <path d={`M${x + 60} 96V214M${x} 155H${x + 120}`} stroke="#2c4a66" strokeWidth="4" />
          <circle cx={x + 28} cy="122" r="1.6" fill="#f6f1da" />
          <circle cx={x + 92} cy="182" r="1.2" fill="#f6f1da" />
        </g>
      ))}
      <circle cx={(L.windows[1] ?? 0) + 28} cy="128" r="12" fill="#fff3cf" />
      {variant === 'crash' &&
        L.windows.map((x) => (
          <g key={x} className="atp-m-siren">
            <rect x={x + 3} y="99" width="114" height="112" rx="4" fill="#3a6fd8" className="atp-m-siren-blue" />
            <rect x={x + 3} y="99" width="114" height="112" rx="4" fill="#ff5b4d" className="atp-m-siren-red" />
          </g>
        ))}
      {variant === 'beggar' && (
        <g>
          <rect x={single.x - 50} y={single.y - 168} width="100" height="170" rx="6" fill="#0a1730" stroke="#2c4a66" strokeWidth="6" />
          <path d={`M${single.x - 44} ${single.y - 40}H${single.x + 44}`} stroke="#132838" strokeWidth="2" />
          <circle cx={single.x - 20} cy={single.y - 140} r="1.6" fill="#f6f1da" />
          <circle cx={single.x + 24} cy={single.y - 118} r="1.2" fill="#f6f1da" />
          <path d={`M${single.x + 50} ${single.y - 168}l26 10v164l-26 -4z`} fill="#203f57" />
        </g>
      )}
      <g transform={`translate(${L.clock.x} ${L.clock.y})`}>
        <circle r="22" fill="#e9eef5" stroke="#5d6f8c" strokeWidth="4" />
        <path className="atp-m-clock" d="M0 0V-14" stroke="#1b2d55" strokeWidth="3" strokeLinecap="round" />
        <path d="M0 0H9" stroke="#1b2d55" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform={`translate(${L.cross.x} ${L.cross.y})`}>
        <rect x="-18" y="-18" width="36" height="36" rx="6" fill="#3fb56b" opacity="0.85" />
        <path d="M-4 -12h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill="#f4f6f8" />
      </g>
      {variant === 'gas' && (
        <g>
          <rect x={partition.x} y="-2000" width="22" height={2000 + partition.bottom} fill="#203f57" />
          <rect x={partition.x - 6} y={partition.vent} width="34" height="40" rx="4" fill="#132838" />
          {[8, 18, 28].map((dy) => (
            <path key={dy} d={`M${partition.x - 2} ${partition.vent + dy}H${partition.x + 24}`} stroke="#3a5a78" strokeWidth="3" />
          ))}
        </g>
      )}
    </g>
  )
}

export function WardScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const variant = VARIANTS[dilemma.id] ?? 'drug'
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, variant, L })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)
  const five = useMemo(() => dilemma.trackA.filter(isPerson).slice(0, L.beds.xs.length), [dilemma, L])
  const one = useMemo(() => dilemma.trackB.find(isPerson), [dilemma])

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
  const { beds, single, hand, machine } = L
  const hotspot = variant === 'gas' ? { x: machine.x, y: machine.y + 64 } : hand
  const pipe = `M${machine.x} ${machine.y}V170H${L.pipeTo}`
  const pullLabel = variant === 'gas' ? L.labels.pullGas : L.labels.pull
  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.wardLabel[lang]}>
      <defs>
        <radialGradient id={`${id}-gas`}>
          <stop offset="0" stopColor="#7fe3b8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#7fe3b8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-fumes`}>
          <stop offset="0" stopColor="#a3d65c" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7a5bd6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          <Ward L={L} variant={variant} />

          {/* The one: in a bed on the left, or standing (the healthy man, the beggar at the door). */}
          {one &&
            (standing(variant) ? (
              <g data-part="single" transform={transform(single.x, single.y)}>
                <Figure actor={one} youLabel={you} delay={0.4} />
              </g>
            ) : (
              <g data-part="single" transform={transform(single.x, single.y)}>
                <Bed actor={one} youLabel={you} delay={0.4} monitorAt={-60} />
              </g>
            ))}

          {five.map((actor, index) => (
            <g key={beds.xs[index]} data-part="patient" transform={transform(beds.xs[index] as number, beds.y, 0, beds.scale)}>
              <Bed actor={actor} youLabel={you} delay={index * 0.37} monitorAt={beds.monitor} bandaged={variant === 'crash'} />
            </g>
          ))}

          {variant === 'gas' && (
            <g>
              <g data-part="gas" opacity="0">
                {beds.xs.map((x) => (
                  <circle key={x} cx={x} cy={beds.y - 110 * beds.scale} r={L.mist.gas} fill={`url(#${id}-gas)`} className="atp-m-mist" />
                ))}
              </g>
              <g data-part="fumes" opacity="0">
                <circle cx={single.x} cy={single.y - 120} r={L.mist.fumes} fill={`url(#${id}-fumes)`} className="atp-m-mist" />
              </g>
              {/* The gas machine, its gauge and valve, and the pipe to the ward. */}
              <path d={pipe} fill="none" stroke="#5d6f8c" strokeWidth="8" />
              <path d={pipe} fill="none" stroke="#7fe3b8" strokeWidth="3" strokeDasharray="10 14" className="atp-m-flow" opacity="0.6" />
              <rect x={machine.x - 24} y={machine.y} width="48" height="128" rx="14" fill="#8fa3bf" />
              <rect x={machine.x - 24} y={machine.y} width="48" height="16" rx="8" fill="#a9bcd6" />
              <g transform={`translate(${machine.x} ${machine.y + 50})`}>
                <circle r="13" fill="#eef3f8" stroke="#5d6f8c" strokeWidth="3" />
                <g data-part="needle" transform="rotate(-60)">
                  <path d="M0 0V-10" stroke="#d9473f" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              </g>
              <g transform={`translate(${machine.x} ${machine.y + 90})`}>
                <g data-part="valve">
                  <rect x="-14" y="-3" width="28" height="6" rx="3" fill="#d9473f" />
                  <circle r="5" fill="#2a3550" />
                </g>
              </g>
            </g>
          )}

          {/* The doctor (you), with the drug or the empty vial. */}
          <g transform={transform(L.doctor.x, L.doctor.y)}>
            <Figure actor={DOCTOR_LOOK} youLabel={you} delay={0.9} />
          </g>
          {variant !== 'gas' && (
            <g data-part="item" transform={transform(hand.x, hand.y)}>
              {variant === 'drug' && (
                <g>
                  <rect x="-8" y="-20" width="16" height="24" rx="5" fill="#cfe3f2" opacity="0.9" />
                  <rect x="-6" y="-12" width="12" height="14" rx="3" fill="#7fe3b8" className="atp-m-glow-pulse" />
                  <rect x="-5" y="-26" width="10" height="6" rx="2" fill="#d9473f" />
                </g>
              )}
              {variant === 'crash' && (
                <g>
                  <rect x="-15" y="-18" width="30" height="22" rx="5" fill="#f4f6f8" stroke="#c4d0de" strokeWidth="1.5" />
                  <path d="M-6 -24h12v6h-12z" fill="none" stroke="#c4d0de" strokeWidth="2.5" strokeLinejoin="round" />
                  <path d="M-2.6 -13h5.2v4.4h4.4v5.2h-4.4v4.4h-5.2v-4.4h-4.4v-5.2h4.4z" fill="#d9473f" />
                </g>
              )}
              {variant === 'serum' && <Vial />}
              {variant === 'beggar' && (
                <g>
                  <path d="M-14 -10h28q-2 13 -14 13t-14 -13z" fill="#e9dcc0" />
                  <ellipse cx="0" cy="-10" rx="14" ry="3.5" fill="#f2b04a" />
                  <path className="atp-m-steam" d="M-5 -16q-3 -5 0 -9t0 -9M4 -16q-3 -5 0 -9t0 -9" fill="none" stroke="#fbefd6" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" />
                </g>
              )}
            </g>
          )}
          {variant === 'beggar' && (
            <g data-part="vial" opacity="0" transform={transform(hand.x, hand.y)}>
              <Vial />
            </g>
          )}
          {makesSerum(variant) && (
            <path data-part="stream" opacity="0" d={`M${single.x + 10} ${single.y - 60}Q${(single.x + hand.x) / 2} ${single.y - 160} ${hand.x} ${hand.y - 10}`} className="atp-m-stream" />
          )}
          {[0, 1, 2, 3, 4].map((index) => (
            <g key={index} data-part="dose" opacity="0" transform={transform(hand.x, hand.y)}>
              <circle r="7" fill="#7fe3b8" />
              <circle r="12" fill="#7fe3b8" opacity="0.3" />
            </g>
          ))}

          <g data-part="labels" opacity="0">
            <Pill x={L.labels.stay.x} y={L.labels.stay.y} text={dilemma.verbs?.stay?.[lang] ?? UI.stay[lang]} tone="stay" />
            <Pill x={pullLabel.x} y={pullLabel.y} text={dilemma.verbs?.pull[lang] ?? UI.pull[lang]} tone="pull" />
          </g>

          <circle className="atp-m-hint" cx={hotspot.x} cy={hotspot.y} r="30" />
          <circle
            className="atp-m-hotspot"
            cx={hotspot.x}
            cy={hotspot.y}
            r="44"
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
