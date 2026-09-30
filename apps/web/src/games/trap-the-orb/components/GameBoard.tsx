import type { Orientation } from '@games/trap-the-orb-engine'
import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import type { GameController, HudSnapshot } from '../controller/GameController'

type GameBoardProps = {
  readonly controller: GameController
  readonly hud: HudSnapshot
  /** The focusable board element, shared so header buttons can hand focus back to it. */
  readonly boardRef: RefObject<HTMLDivElement | null>
  /** Panels shown over the field: ready, paused, level cleared, results. */
  readonly overlay: ReactNode
  /** Enter (or Space on the ready screen) while no level is being played: play, resume or continue. */
  readonly onPrimaryAction: () => void
}

type TouchGesture = {
  readonly pointerId: number
  readonly x: number
  readonly y: number
  readonly orientation: Orientation | null
}

/** A drag longer than this (CSS px) picks the wall direction instead of tapping. */
const SWIPE_THRESHOLD_PX = 18

const ARROW_STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

const localPoint = (event: PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
  const rect = event.currentTarget.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

export function GameBoard({ controller, hud, boardRef, overlay, onPrimaryAction }: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gestureRef = useRef<TouchGesture | null>(null)
  const instructionsId = useId()
  const isPlaying = hud.status === 'playing'

  useEffect(() => {
    const canvas = canvasRef.current
    return canvas ? controller.mount(canvas) : undefined
  }, [controller])

  const focusBoard = (): void => boardRef.current?.focus({ preventScroll: true })

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    focusBoard()
    if (!isPlaying) return
    const { x, y } = localPoint(event)

    if (event.pointerType === 'mouse') {
      if (event.button === 2) {
        controller.toggleOrientation()
        controller.aimAtPoint(x, y)
      } else if (event.button === 0) {
        controller.buildAtPoint(x, y)
      }
      return
    }

    // Keep receiving the swipe even when the finger leaves the canvas (not available in every engine).
    // Only one finger steers at a time; a resting palm or second touch must not hijack the swipe.
    if (gestureRef.current) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gestureRef.current = { pointerId: event.pointerId, x, y, orientation: null }
    controller.aimAtPoint(x, y)
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    const { x, y } = localPoint(event)
    if (event.pointerType === 'mouse') {
      controller.aimAtPoint(x, y)
      return
    }

    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const dx = x - gesture.x
    const dy = y - gesture.y
    if (Math.hypot(dx, dy) < SWIPE_THRESHOLD_PX) return

    const orientation: Orientation = Math.abs(dy) >= Math.abs(dx) ? 'vertical' : 'horizontal'
    if (orientation === gesture.orientation) return
    gestureRef.current = { ...gesture, orientation }
    controller.setOrientation(orientation)
  }

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>): void => {
    const gesture = gestureRef.current
    if (event.pointerType === 'mouse' || !gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    controller.buildAtPoint(gesture.x, gesture.y, gesture.orientation ?? undefined)
    controller.clearAim()
  }

  const cancelGesture = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    gestureRef.current = null
    controller.clearAim()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // Only handle keys aimed at the board itself.
    if (event.target !== event.currentTarget) return
    const step = ARROW_STEPS[event.key]

    if (step) {
      if (!isPlaying) return
      event.preventDefault()
      controller.moveAim(step[0], step[1])
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (isPlaying) controller.buildAtAim()
      else onPrimaryAction()
      return
    }

    if (event.key === ' ') {
      event.preventDefault()
      if (isPlaying) controller.toggleOrientation()
      else if (hud.status === 'ready') onPrimaryAction()
    }
  }

  return (
    <div className="rounded-[12px] border border-line-strong bg-sunken p-1 shadow-card">
      {/* A tall field on portrait screens, a wide one otherwise — the engine picks the matching shape. */}
      <div className="relative aspect-[1/2] max-h-[calc(100svh-7.5rem)] min-h-[280px] w-full overflow-hidden rounded-[8px] landscape:aspect-[2/1] landscape:max-h-[calc(100svh-1.5rem)] lg:landscape:max-h-[calc(100svh-210px)] lg:landscape:min-h-[300px]">
        {/* Only the playing surface is an "application"; the overlay's buttons and inputs stay regular widgets. */}
        <div
          ref={boardRef}
          tabIndex={0}
          role="application"
          aria-roledescription="game board"
          aria-label="Trap The Orb playing field"
          aria-describedby={instructionsId}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 rounded-[8px] outline-none focus-visible:ring-4 focus-visible:ring-teal-500/35 focus-visible:ring-inset"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={cancelGesture}
            onLostPointerCapture={cancelGesture}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') controller.clearAim()
            }}
            onContextMenu={(event) => event.preventDefault()}
            className="absolute inset-0 size-full touch-none select-none"
          />
          <p id={instructionsId} className="sr-only">
            Click or tap to build a wall. Right-click, press Space or swipe to change its direction. Arrow keys aim,
            Enter builds. Press P to pause.
          </p>
        </div>

        {overlay}
      </div>
    </div>
  )
}
