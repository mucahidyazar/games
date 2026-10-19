import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { logger } from '@/lib/logger'
import { UI } from '../content/strings'
import type { Actor, AnyDilemma, Lang, TrolleyChoice } from '../content/types'
import type { SceneEvent, SceneEventDetail, TrolleyScene } from '../scene/TrolleyScene'

export interface StageHandle {
  /** Plays the run for a choice; resolves when it is over (immediately without a scene). */
  play(choice: TrolleyChoice): Promise<void>
}

export type StageProps = {
  readonly ref?: Ref<StageHandle>
  readonly dilemma: AnyDilemma | null
  readonly trackA: readonly Actor[]
  /** A choice already made for this dilemma: show its aftermath instead of the run. */
  readonly settled: TrolleyChoice | null
  readonly lang: Lang
  readonly reducedMotion: boolean
  /** Whether the lever in the scene can be clicked or dragged to decide. */
  readonly interactive?: boolean
  readonly onLever?: (choice: TrolleyChoice) => void
  /** Changing it rebuilds the set, even on the same dilemma (another player's game). */
  readonly setKey?: string
  readonly onEvent: (event: SceneEvent, detail?: SceneEventDetail) => void
  readonly children?: ReactNode
}

type Status = 'loading' | 'ready' | 'error'

/** The framed 3D scene. The three.js code loads with it, so the rest of the site never pays for it. */
export function Stage({ ref, dilemma, trackA, settled, lang, reducedMotion, interactive = false, onLever, setKey = '', onEvent, children }: StageProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<TrolleyScene | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [scene, setScene] = useState<TrolleyScene | null>(null)
  const emit = useEffectEvent(onEvent)
  const decide = useEffectEvent((choice: TrolleyChoice) => onLever?.(choice))
  const initial = useRef({ lang, reducedMotion })

  useImperativeHandle(ref, () => ({
    play: (choice) => sceneRef.current?.play(choice) ?? Promise.resolve(),
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let created: TrolleyScene | null = null
    void import('../scene/TrolleyScene')
      .then(({ TrolleyScene: Scene }) =>
        Scene.create({
          canvas,
          lang: initial.current.lang,
          reducedMotion: initial.current.reducedMotion,
          onEvent: (event, detail) => emit(event, detail),
          onLever: (choice) => decide(choice),
        }),
      )
      .then((instance) => {
        if (cancelled) {
          instance.dispose()
          return
        }
        created = instance
        sceneRef.current = instance
        const frame = frameRef.current
        if (frame) instance.resize(frame.clientWidth, frame.clientHeight, window.devicePixelRatio || 1)
        setScene(instance)
        setStatus('ready')
        if (import.meta.env.DEV) (window as Window & { __absurdTrolley?: TrolleyScene }).__absurdTrolley = instance
      })
      .catch((error: unknown) => {
        if (cancelled) return
        logger.error('The 3D scene could not start', error)
        setStatus('error')
      })
    return () => {
      cancelled = true
      created?.dispose()
      sceneRef.current = null
      if (import.meta.env.DEV) delete (window as Window & { __absurdTrolley?: TrolleyScene }).__absurdTrolley
    }
  }, [])

  // Keep the render size in step with the frame.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !scene || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => scene.resize(frame.clientWidth, frame.clientHeight, window.devicePixelRatio || 1))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [scene])

  // Stop rendering while the frame is off screen or the tab is hidden.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !scene) return
    let onScreen = true
    const sync = (): void => scene.setVisible(onScreen && document.visibilityState === 'visible')
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true
      sync()
    })
    observer?.observe(frame)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [scene])

  useEffect(() => scene?.setLang(lang), [scene, lang])
  useEffect(() => scene?.setReducedMotion(reducedMotion), [scene, reducedMotion])
  useEffect(() => scene?.setInteractive(interactive), [scene, interactive])

  // A new dilemma rebuilds the set; a choice made later plays on the same set.
  const showDilemma = useEffectEvent((instance: TrolleyScene) => {
    if (dilemma) instance.setDilemma(dilemma, trackA, settled)
  })
  const dilemmaId = dilemma?.id ?? null
  useEffect(() => {
    if (scene && dilemmaId) showDilemma(scene)
  }, [scene, dilemmaId, setKey])

  // A choice taken back (from the Dilemmas tab) puts the tram and everyone back for another go.
  const shown = useRef({ id: dilemmaId, settled, setKey })
  useEffect(() => {
    const before = shown.current
    shown.current = { id: dilemmaId, settled, setKey }
    const same = before.id === dilemmaId && before.setKey === setKey
    if (scene && dilemmaId && same && before.settled !== null && settled === null) showDilemma(scene)
  }, [scene, dilemmaId, settled, setKey])

  return (
    <div ref={frameRef} className="atp-stage" data-status={status}>
      <canvas ref={canvasRef} className="atp-canvas" role="img" aria-label={UI.sceneLabel[lang]} />
      {status === 'loading' && (
        <div className="atp-stage-note" role="status">
          <span className="atp-loader" aria-hidden="true" />
          {UI.loadingScene[lang]}
        </div>
      )}
      {status === 'error' && (
        <div className="atp-stage-note is-error" role="status">
          {UI.sceneError[lang]}
        </div>
      )}
      {children}
    </div>
  )
}
