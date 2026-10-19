import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CLOTH, HAIR, person, SKIN } from '../content/cast'
import { FOOT_UI, UI } from '../content/strings'
import type { TrolleyChoice } from '../content/types'
import { alternate, calm, cheer, fade, fall, fallenPose, lieDown, lose, lost, part, parts, shake } from './acting'
import { easeInCubic, easeOutBack, easeOutCubic, easeOutQuad, linear, round2, setAttr, Timeline } from './animate'
import { Backdrop, Pill, Stars } from './Backdrop'
import { Figure, MobMember } from './figures'
import type { Point } from './geometry'
import { emitter, isPerson, svgId, type Emit, type Frame, type MotionSceneProps, type Turn } from './scene'

/**
 * Philippa Foot's judge, in motion: an angry crowd at the courthouse holds
 * five hostages until it gets a culprit. Bring the gavel down on an innocent
 * man and they go home; refuse, and they turn on the hostages.
 */

const JUDGE = person({ top: '#23263a', skin: SKIN.light, hair: 'short', hairColor: HAIR.grey, marker: 'you', shoes: CLOTH.black })
const GAVEL = { x: 538, y: 252 } as const
/** Off stage left: where the crowd comes from, and where it goes. */
const AWAY = -640
const SURGE = 64

/** Where everyone stands around the courthouse (which stays put), on a wide stage or a tall one. */
interface Layout {
  readonly viewBox: string
  readonly innocent: Point
  readonly hostages: { readonly xs: readonly number[]; readonly y: number }
  readonly mob: readonly (readonly [number, number])[]
  readonly rope: string
  readonly torch: { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number }
  /** The street lamp's post (x) and its top. */
  readonly lamp: Point
  readonly labels: Readonly<Record<TrolleyChoice, Point>>
  readonly cobbles: readonly number[]
  /** Which way the first hostage falls (the rest alternate), so nobody falls out of the frame. */
  readonly fallFirst: 1 | -1
}

const LAYOUTS: Readonly<Record<Frame, Layout>> = {
  wide: {
    viewBox: '40 60 920 460',
    innocent: { x: 792, y: 470 },
    hostages: { xs: [95, 147, 199, 251, 303], y: 478 },
    mob: [
      [52, 416],
      [98, 430],
      [146, 412],
      [192, 428],
      [238, 414],
      [284, 430],
      [330, 418],
    ],
    rope: 'M78 446Q130 456 147 446T251 446T322 446',
    torch: { cx: 190, cy: 440, rx: 230, ry: 70 },
    lamp: { x: 869, y: 300 },
    labels: { stay: { x: 404, y: 372 }, pull: { x: 612, y: 372 } },
    cobbles: [360, 392, 424, 456, 488],
    fallFirst: 1,
  },
  tall: {
    viewBox: '240 70 520 620',
    innocent: { x: 664, y: 604 },
    hostages: { xs: [282, 326, 370, 414, 458], y: 600 },
    mob: [
      [272, 532],
      [316, 546],
      [360, 528],
      [404, 544],
      [448, 530],
    ],
    rope: 'M266 568Q300 578 326 568T414 568T474 568',
    torch: { cx: 362, cy: 560, rx: 170, ry: 64 },
    lamp: { x: 722, y: 432 },
    labels: { stay: { x: 380, y: 372 }, pull: { x: 624, y: 372 } },
    cobbles: [370, 410, 450, 490, 530, 570, 610, 650],
    fallFirst: 1,
  },
}

/** The lamp's light, from its head down to the ground around the innocent man. */
const lampCone = (L: Layout): string => {
  const { x, y } = L.lamp
  const ground = L.innocent.y + 8
  return `${x - 28},${y - 6} ${x - 16},${y - 6} ${x + 11},${ground} ${x - 165},${ground}`
}

const gavelTransform = (angle: number): string => `translate(${GAVEL.x} ${GAVEL.y}) rotate(${round2(angle)})`
const shift = (x: number): string => `translate(${round2(x)} 0)`
const stampBase = (L: Layout): string => `translate(${L.innocent.x} ${L.innocent.y - 52}) rotate(-12)`

interface Nodes {
  readonly root: SVGGElement
  readonly camera: SVGGElement | null
  readonly gavel: SVGGElement | null
  readonly ring: SVGGElement | null
  readonly mob: SVGGElement | null
  readonly hostages: SVGGElement | null
  readonly rope: SVGGElement | null
  readonly innocentWalk: SVGGElement | null
  readonly innocent: SVGGElement | null
  readonly bars: SVGGElement | null
  readonly redLight: SVGGElement | null
  readonly stamp: Readonly<Record<TrolleyChoice, SVGGElement | null>>
  readonly labels: SVGGElement | null
  readonly flash: SVGGElement | null
  readonly people: readonly SVGGElement[]
}

function gather(root: SVGGElement): Nodes {
  return {
    root,
    camera: part(root, 'camera'),
    gavel: part(root, 'gavel'),
    ring: part(root, 'ring'),
    mob: part(root, 'mob'),
    hostages: part(root, 'hostages'),
    rope: part(root, 'rope'),
    innocentWalk: part(root, 'innocent-walk'),
    innocent: root.querySelector<SVGGElement>('[data-role="innocent"]'),
    bars: part(root, 'bars'),
    redLight: part(root, 'red-light'),
    stamp: { pull: part(root, 'stamp-pull'), stay: part(root, 'stamp-stay') },
    labels: part(root, 'labels'),
    flash: part(root, 'flash'),
    people: parts(root, 'hostage'),
  }
}

async function arrive(n: Nodes, timeline: Timeline, emit: Emit, turn: Turn): Promise<void> {
  const mine = turn.current
  n.root.dataset.state = 'arriving'
  emit('roar')
  void timeline.tween(1500, (v) => setAttr(n.innocentWalk, 'transform', shift(220 * (1 - v))), easeOutCubic)
  await timeline.tween(
    1300,
    (v) => {
      setAttr(n.mob, 'transform', shift(AWAY * (1 - v)))
      setAttr(n.hostages, 'transform', shift(AWAY * (1 - v)))
    },
    easeOutCubic,
  )
  // Cut short by an early choice, or by the scene going away (React mounts it twice in development).
  if (turn.current !== mine || timeline.finished) return
  n.root.dataset.state = 'waiting'
  await fade(timeline, n.labels, 1, 400)
}

/** The gavel goes up, and comes down hard. */
async function strike(n: Nodes, timeline: Timeline, emit: Emit): Promise<void> {
  await timeline.tween(320, (v) => setAttr(n.gavel, 'transform', gavelTransform(-72 * v)), easeOutCubic)
  await timeline.tween(130, (v) => setAttr(n.gavel, 'transform', gavelTransform(-72 + 76 * v)), easeInCubic)
  emit('gavel')
  void shake(timeline, n.camera, 8)
  void timeline.tween(
    460,
    (v) => {
      setAttr(n.ring, 'opacity', round2(1 - v))
      setAttr(n.ring, 'transform', `translate(${GAVEL.x + 22} ${GAVEL.y + 2}) scale(${round2(0.4 + 1.6 * v)})`)
    },
    easeOutQuad,
  )
  void timeline.tween(200, (v) => setAttr(n.gavel, 'transform', gavelTransform(4 - 4 * v)), easeOutQuad)
}

/** A rubber stamp thumped onto the man in the lamplight. */
function stampDown(L: Layout, timeline: Timeline, stamp: SVGGElement | null): Promise<void> {
  return timeline.tween(
    320,
    (v) => {
      setAttr(stamp, 'opacity', Math.min(1, round2(v * 2.5)))
      setAttr(stamp, 'transform', `${stampBase(L)} scale(${round2(2.4 - 1.4 * v)})`)
    },
    easeOutBack,
  )
}

async function run(n: Nodes, L: Layout, timeline: Timeline, choice: TrolleyChoice, emit: Emit, turn: Turn): Promise<void> {
  turn.current += 1
  timeline.skip()
  n.root.dataset.state = 'running'
  void fade(timeline, n.labels, 0, 200)
  if (choice === 'pull') {
    await strike(n, timeline, emit)
    void fade(timeline, n.redLight, 1, 300)
    await stampDown(L, timeline, n.stamp.pull)
    await timeline.wait(260)
    // The cell comes down over him.
    await timeline.tween(
      420,
      (v) => {
        setAttr(n.bars, 'opacity', Math.min(1, round2(v * 3)))
        setAttr(n.bars, 'transform', `translate(0 ${Math.round(-150 * (1 - v))})`)
      },
      easeInCubic,
    )
    emit('impact', { kind: 'person' })
    void shake(timeline, n.camera, 5)
    const losing = n.innocent ? lose(timeline, n.innocent) : Promise.resolve()
    // The crowd has its culprit: torches down, they let the hostages go and leave.
    n.root.dataset.mood = 'satisfied'
    void fade(timeline, n.rope, 0, 300)
    await timeline.wait(300)
    emit('cheer')
    await Promise.all([
      losing,
      timeline.tween(1600, (v) => setAttr(n.mob, 'transform', shift(AWAY * v)), easeInCubic),
      ...n.people.map((figure, index) => timeline.wait(index * 90).then(() => cheer(timeline, figure))),
    ])
  } else {
    // No verdict: the gavel is laid down, and the man walks free.
    await timeline.tween(420, (v) => setAttr(n.gavel, 'transform', gavelTransform(18 * v)), easeOutCubic)
    await stampDown(L, timeline, n.stamp.stay)
    emit('cheer')
    if (n.innocent) await cheer(timeline, n.innocent)
    // The crowd turns on the hostages.
    n.root.dataset.mood = 'furious'
    emit('roar')
    void timeline.tween(
      700,
      (v) => setAttr(n.flash, 'opacity', round2(0.32 * Math.sin(v * Math.PI))),
      linear,
    )
    await timeline.tween(520, (v) => setAttr(n.mob, 'transform', shift(SURGE * v)), easeOutCubic)
    void fade(timeline, n.rope, 0, 200)
    const falls: Promise<void>[] = []
    for (const [index, figure] of n.people.entries()) {
      emit('impact', { kind: 'person' })
      falls.push(fall(timeline, figure, alternate(L.fallFirst, index)))
      await timeline.wait(170)
    }
    await Promise.all(falls)
  }
  n.root.dataset.state = 'done'
}

function aftermath(n: Nodes, L: Layout, choice: TrolleyChoice): void {
  n.root.dataset.state = 'done'
  setAttr(n.mob, 'transform', shift(choice === 'pull' ? AWAY : SURGE))
  setAttr(n.rope, 'opacity', 0)
  const stamp = n.stamp[choice]
  setAttr(stamp, 'opacity', 1)
  setAttr(stamp, 'transform', stampBase(L))
  if (choice === 'pull') {
    n.root.dataset.mood = 'satisfied'
    setAttr(n.redLight, 'opacity', 1)
    setAttr(n.bars, 'opacity', 1)
    setAttr(n.bars, 'transform', 'translate(0 0)')
    if (n.innocent) lost(n.innocent)
    for (const figure of n.people) calm(figure)
  } else {
    n.root.dataset.mood = 'furious'
    setAttr(n.gavel, 'transform', gavelTransform(18))
    if (n.innocent) calm(n.innocent)
    for (const [index, figure] of n.people.entries()) lieDown(figure, fallenPose(alternate(L.fallFirst, index)))
  }
}

function Courthouse({ lang }: { readonly lang: 'tr' | 'en' }) {
  return (
    <g className="atp-m-court" aria-hidden="true">
      <path d="M322 154L500 94L678 154Z" fill="#cdbf9f" />
      <path d="M350 148L500 104L650 148Z" fill="#b5a687" />
      <g transform="translate(500 132)" fill="none" stroke="#7a6a4c" strokeWidth="2.2" strokeLinecap="round">
        <path d="M0 -14v22M-14 -8h28M-14 -8l-6 10h12zM14 -8l-6 10h12z" />
        <path d="M-20 2a6 3 0 0 0 12 0M8 2a6 3 0 0 0 12 0" />
      </g>
      <rect x="316" y="154" width="368" height="20" fill="#dccfb0" />
      <text x="500" y="168.5" textAnchor="middle" className="atp-m-court-text">
        {lang === 'tr' ? 'ADLİYE' : 'COURT OF JUSTICE'}
      </text>
      <rect x="332" y="174" width="336" height="128" fill="#2a2f45" />
      <path d="M462 302V236a38 38 0 0 1 76 0V302Z" fill="#ffcf7a" opacity="0.9" />
      <path d="M470 302V238a30 30 0 0 1 60 0V302Z" fill="#ffe2a3" />
      {[350, 410, 590, 650].map((x) => (
        <g key={x}>
          <rect x={x - 15} y="174" width="30" height="8" fill="#e6dabd" />
          <rect x={x - 11} y="182" width="22" height="112" fill="#d8cbab" />
          <rect x={x - 11} y="182" width="6" height="112" fill="#ffffff" opacity="0.18" />
          <rect x={x - 15} y="294" width="30" height="8" fill="#e6dabd" />
        </g>
      ))}
      <rect x="326" y="302" width="348" height="12" fill="#c3b593" />
      <rect x="312" y="314" width="376" height="13" fill="#b2a483" />
      <rect x="298" y="327" width="404" height="14" fill="#a19374" />
      <path d="M462 302h76l70 40H392Z" fill="#ffcf7a" opacity="0.12" />
    </g>
  )
}

export function JudgeScene({ ref, frame = 'wide', dilemma, lang, settled, reducedMotion, interactive, onLever, onEvent }: MotionSceneProps) {
  const id = svgId(useId())
  const L = LAYOUTS[frame]
  const rootRef = useRef<SVGGElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const turn = useRef(0)
  const latest = useRef({ onEvent, reducedMotion, L })
  // Only the first value counts: a choice made here plays out instead of jumping to its end.
  const [opening] = useState(settled)
  const hostages = useMemo(() => dilemma.trackA.filter(isPerson).slice(0, L.hostages.xs.length), [dilemma, L])
  const innocent = useMemo(() => dilemma.trackB.find(isPerson), [dilemma])

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
        return run(gather(root), latest.current.L, timeline, choice, emitter(timeline, latest), turn)
      },
    }),
    [],
  )

  const you = FOOT_UI.you[lang]
  const opened = opening !== null
  // The stamp's letters are heavy and spaced out: about 16 units each, so the frame fits round them.
  const stamp = (choice: TrolleyChoice, text: string) => (
    <g data-part={`stamp-${choice}`} className={`atp-m-stamp is-${choice}`} opacity="0" transform={stampBase(L)}>
      <rect x={-(text.length * 16 + 28) / 2} y="-19" width={text.length * 16 + 28} height="34" rx="5" />
      <text y="6.5" textAnchor="middle">
        {text}
      </text>
    </g>
  )

  return (
    <svg className={`atp-motion ${interactive ? 'is-live' : ''}`} viewBox={L.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={FOOT_UI.courtLabel[lang]}>
      <defs>
        <radialGradient id={`${id}-torch`}>
          <stop offset="0" stopColor="#ff9a4d" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ff9a4d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-lamp`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c4" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff1c4" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={`${id}-red`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5b4d" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff5b4d" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <g ref={rootRef} className="atp-m-scene">
        <g data-part="camera">
          <Backdrop id={id} horizon={300} />
          <Stars />
          <Courthouse lang={lang} />
          <g className="atp-m-cobbles" fill="#1f4646" opacity="0.6">
            {L.cobbles.map((y, row) =>
              Array.from({ length: 16 }, (_, i) => <rect key={`${y}-${i}`} x={-40 + i * 70 + (row % 2) * 35} y={y} width="40" height="3" rx="1.5" />),
            )}
          </g>

          {/* The street lamp over the innocent man; its light turns red when he is condemned. */}
          <g className="atp-m-lamp-post">
            <rect x={L.lamp.x - 3} y={L.lamp.y} width="6" height={L.innocent.y + 2 - L.lamp.y} rx="3" fill="#2a3550" />
            <path d={`M${L.lamp.x} ${L.lamp.y + 2}q0 -16 -16 -16h-6`} fill="none" stroke="#2a3550" strokeWidth="5" />
            <rect x={L.lamp.x - 31} y={L.lamp.y - 16} width="18" height="10" rx="4" fill="#3b4664" />
            <polygon points={lampCone(L)} fill={`url(#${id}-lamp)`} />
            <polygon data-part="red-light" points={lampCone(L)} fill={`url(#${id}-red)`} opacity="0" />
          </g>

          {/* The judge at the bench, and the gavel. */}
          <g transform="translate(500 300)">
            <Figure actor={JUDGE} youLabel={you} robe />
          </g>
          <rect x="446" y="256" width="108" height="46" rx="4" fill="#5a3b2a" />
          <rect x="446" y="256" width="108" height="7" rx="3" fill="#7a5434" />
          <circle cx="500" cy="281" r="9" fill="none" stroke="#c9a36b" strokeWidth="2" />
          <rect x="548" y="250" width="22" height="7" rx="2" fill="#7a5434" />
          <g data-part="gavel" transform={gavelTransform(0)}>
            <rect x="-2" y="-2.5" width="30" height="5" rx="2.5" fill="#8b5a3a" />
            <rect x="22" y="-9" width="14" height="18" rx="3" fill="#6b4a2b" />
            <rect x="22" y="-9" width="14" height="4" rx="2" fill="#c9a36b" />
            <rect x="22" y="5" width="14" height="4" rx="2" fill="#c9a36b" />
          </g>
          <g data-part="ring" opacity="0" transform={`translate(${GAVEL.x + 22} ${GAVEL.y + 2})`}>
            <circle r="16" fill="none" stroke="#ffd36b" strokeWidth="3" />
          </g>
          <circle className="atp-m-hint" cx={GAVEL.x + 12} cy={GAVEL.y} r="30" />

          <g data-part="labels" opacity="0">
            <Pill x={L.labels.stay.x} y={L.labels.stay.y} text={`← ${dilemma.verbs?.stay?.[lang] ?? UI.stay[lang]}`} tone="stay" />
            <Pill x={L.labels.pull.x} y={L.labels.pull.y} text={`${dilemma.verbs?.pull[lang] ?? UI.pull[lang]} →`} tone="pull" />
          </g>

          {/* The crowd, its torchlight, and the hostages it holds. */}
          <g data-part="mob" transform={shift(opened ? 0 : AWAY)} className="atp-m-crowd">
            <ellipse cx={L.torch.cx} cy={L.torch.cy} rx={L.torch.rx} ry={L.torch.ry} fill={`url(#${id}-torch)`} />
            {L.mob.map(([x, y], index) => (
              <g key={x} transform={`translate(${x} ${y})`}>
                <MobMember variant={index} delay={index * 0.29} />
              </g>
            ))}
          </g>
          <g data-part="hostages" transform={shift(opened ? 0 : AWAY)}>
            {hostages.map((actor, index) => (
              <g key={L.hostages.xs[index]} data-part="hostage" transform={`translate(${L.hostages.xs[index]} ${L.hostages.y})`}>
                <Figure actor={actor} youLabel={you} delay={index * 0.53} />
              </g>
            ))}
            <path data-part="rope" d={L.rope} fill="none" stroke="#c9a36b" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          {/* The innocent man, the cell that may come down over him, and the verdict. */}
          <g data-part="innocent-walk" transform={shift(opened ? 0 : 220)}>
            {innocent && (
              <g data-role="innocent" transform={`translate(${L.innocent.x} ${L.innocent.y})`}>
                <Figure actor={innocent} youLabel={you} delay={0.8} />
              </g>
            )}
          </g>
          <g data-part="bars" opacity="0" transform="translate(0 -150)" className="atp-m-bars">
            <rect x={L.innocent.x - 42} y={L.innocent.y - 118} width="84" height="7" rx="3" />
            {[-36, -24, -12, 0, 12, 24, 36].map((dx) => (
              <rect key={dx} x={L.innocent.x + dx - 2} y={L.innocent.y - 114} width="4" height="114" rx="2" />
            ))}
            <rect x={L.innocent.x - 42} y={L.innocent.y - 4} width="84" height="7" rx="3" />
          </g>
          {stamp('pull', FOOT_UI.guilty[lang])}
          {stamp('stay', FOOT_UI.free[lang])}

          <circle
            className="atp-m-hotspot"
            cx={GAVEL.x + 10}
            cy={GAVEL.y}
            r="40"
            aria-hidden="true"
            onClick={() => {
              if (interactive) onLever?.('pull')
            }}
          />
        </g>
        <rect data-part="flash" x="-2000" y="-2000" width="5000" height="5000" fill="#ff3b30" opacity="0" pointerEvents="none" />
      </g>
    </svg>
  )
}
