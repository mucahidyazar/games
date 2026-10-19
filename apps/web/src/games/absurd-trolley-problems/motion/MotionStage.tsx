import { useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { StageProps } from '../components/Stage'
import type { FootDilemmaId } from '../content/foot'
import { CaveScene } from './CaveScene'
import { DriverScene } from './DriverScene'
import { DungeonScene } from './DungeonScene'
import { HomeScene } from './HomeScene'
import { JudgeScene } from './JudgeScene'
import { PilotScene } from './PilotScene'
import { SchoolScene } from './SchoolScene'
import { SeaScene } from './SeaScene'
import { ShopScene } from './ShopScene'
import { TheatreScene } from './TheatreScene'
import type { Frame, MotionSceneHandle, MotionSceneProps } from './scene'
import { WardScene } from './WardScene'

type SceneComponent = (props: MotionSceneProps) => ReactNode

/** Which drawing each of Foot's cases plays in: every case has one, or this stops compiling. */
const SCENES: Readonly<Record<FootDilemmaId, SceneComponent>> = {
  'foot-driver': DriverScene,
  'foot-judge': JudgeScene,
  'foot-pilot': PilotScene,
  'foot-drug': WardScene,
  'foot-crash': WardScene,
  'foot-serum': WardScene,
  'foot-beggar': WardScene,
  'foot-gas': WardScene,
  'foot-rescue': DungeonScene,
  'foot-tyrant': DungeonScene,
  'foot-madman': DungeonScene,
  'foot-children': HomeScene,
  'foot-oil': ShopScene,
  'foot-education': SchoolScene,
  'foot-cave': CaveScene,
  'foot-cave-inside': CaveScene,
  'foot-lifeboat': SeaScene,
  'foot-hysterectomy': TheatreScene,
  'foot-craniotomy': TheatreScene,
  'foot-mother-or-child': TheatreScene,
  'foot-worst-dilemma': TheatreScene,
}

/** Narrower than this (width over height), a stage is tall: a phone held upright gets the scenes laid out for it. */
const TALL_BELOW = 1

/**
 * Philippa Foot's problems drawn in motion: smooth SVG scenes in the same
 * frame, with the same contract (play a choice, report what happens) as the
 * 3D stage, so the play view takes either.
 */
export function MotionStage({ ref, dilemma, settled, lang, reducedMotion, interactive = false, onLever, setKey = '', onEvent, children }: StageProps) {
  const sceneRef = useRef<MotionSceneHandle>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<Frame>('wide')

  // Upright on a phone, the scenes switch to a tall layout; turned on its side, back to wide.
  useLayoutEffect(() => {
    const node = stageRef.current
    if (!node) return
    const measure = (): void => {
      const { clientWidth: width, clientHeight: height } = node
      if (width > 0 && height > 0) setFrame(width / height < TALL_BELOW ? 'tall' : 'wide')
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  // A choice taken back (from the Cases tab) starts the scene over, for another go.
  const [lastSettled, setLastSettled] = useState(settled)
  const [round, setRound] = useState(0)
  if (settled !== lastSettled) {
    if (lastSettled !== null && settled === null) setRound(round + 1)
    setLastSettled(settled)
  }

  useImperativeHandle(ref, () => ({
    play: (choice) => sceneRef.current?.play(choice) ?? Promise.resolve(),
  }))

  const Scene = (dilemma && SCENES[dilemma.id as FootDilemmaId]) ?? DriverScene
  return (
    <div ref={stageRef} className="atp-stage is-motion" data-status="ready" data-frame={frame}>
      {dilemma && (
        <Scene
          key={`${dilemma.id}:${setKey}:${round}:${frame}`}
          ref={sceneRef}
          frame={frame}
          dilemma={dilemma}
          lang={lang}
          settled={settled}
          reducedMotion={reducedMotion}
          interactive={interactive}
          onLever={onLever}
          onEvent={onEvent}
        />
      )}
      {children}
    </div>
  )
}
