import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SoundPlayer } from '../audio/sfx'
import { GameController } from '../controller/GameController'
import { GameBoard } from './GameBoard'

const fakeSound = (): SoundPlayer => ({ play: vi.fn(), unlock: vi.fn(), setEnabled: vi.fn() })

/** Renders a board with a run in play whose canvas is 1000 x 500 CSS px (300 x 150 cells). */
function renderBoard() {
  const controller = new GameController({ sound: fakeSound(), seed: 11 })
  const onPrimaryAction = vi.fn()
  const board = () => (
    <GameBoard
      controller={controller}
      hud={controller.getHud()}
      boardRef={createRef<HTMLDivElement>()}
      overlay={<p>Overlay slot</p>}
      onPrimaryAction={onPrimaryAction}
    />
  )
  const view = render(board())
  controller.startRun({ seed: 11 })
  const rerender = () => view.rerender(board())
  rerender()
  const canvas = view.container.querySelector('canvas')
  if (!canvas) throw new Error('canvas missing')
  return { controller, canvas, rerender, onPrimaryAction }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** A point well away from every orb, in canvas pixels. */
function freePoint(controller: GameController): { x: number; y: number } {
  const state = controller.getState()
  if (!state) throw new Error('no game')
  const scale = 1000 / state.grid.cols
  for (let col = 10; col < state.grid.cols - 10; col += 7) {
    const clear = state.balls.every((ball) => Math.abs(ball.x - col) > 12)
    if (clear) return { x: (col + 0.5) * scale, y: 250 }
  }
  throw new Error('no free column')
}

describe('GameBoard input', () => {
  it('builds a wall where the mouse clicks', () => {
    const { controller, canvas } = renderBoard()
    const { x, y } = freePoint(controller)

    fireEvent.pointerDown(canvas, { pointerType: 'mouse', button: 0, clientX: x, clientY: y })

    expect(controller.getState()?.walls).toHaveLength(2)
    expect(controller.getState()?.walls[0]?.orientation).toBe('vertical')
  })

  it('rotates the wall direction on right-click without building', () => {
    const { controller, canvas } = renderBoard()

    fireEvent.pointerDown(canvas, { pointerType: 'mouse', button: 2, clientX: 400, clientY: 200 })

    expect(controller.getHud().orientation).toBe('horizontal')
    expect(controller.getState()?.walls).toHaveLength(0)
  })

  it('builds with the swipe direction on touch screens', () => {
    const { controller, canvas } = renderBoard()
    const { x, y } = freePoint(controller)

    fireEvent.pointerDown(canvas, { pointerType: 'touch', pointerId: 7, clientX: x, clientY: y })
    fireEvent.pointerMove(canvas, { pointerType: 'touch', pointerId: 7, clientX: x + 60, clientY: y + 4 })
    fireEvent.pointerUp(canvas, { pointerType: 'touch', pointerId: 7, clientX: x + 60, clientY: y + 4 })

    expect(controller.getHud().orientation).toBe('horizontal')
    expect(controller.getState()?.walls[0]?.orientation).toBe('horizontal')
  })

  it('treats a short touch as a tap in the current direction', () => {
    const { controller, canvas } = renderBoard()
    const { x, y } = freePoint(controller)

    fireEvent.pointerDown(canvas, { pointerType: 'touch', pointerId: 3, clientX: x, clientY: y })
    fireEvent.pointerMove(canvas, { pointerType: 'touch', pointerId: 3, clientX: x + 4, clientY: y + 2 })
    fireEvent.pointerUp(canvas, { pointerType: 'touch', pointerId: 3, clientX: x + 4, clientY: y + 2 })

    expect(controller.getState()?.walls[0]?.orientation).toBe('vertical')
  })

  it('ignores a second finger while a swipe is in progress', () => {
    const { controller, canvas } = renderBoard()
    const { x, y } = freePoint(controller)
    const expectedLine = Math.floor(x / (1000 / (controller.getState()?.grid.cols ?? 1)))

    fireEvent.pointerDown(canvas, { pointerType: 'touch', pointerId: 1, clientX: x, clientY: y })
    fireEvent.pointerDown(canvas, { pointerType: 'touch', pointerId: 2, clientX: 40, clientY: 40 })
    fireEvent.pointerUp(canvas, { pointerType: 'touch', pointerId: 2, clientX: 40, clientY: 40 })
    expect(controller.getState()?.walls).toHaveLength(0)

    fireEvent.pointerUp(canvas, { pointerType: 'touch', pointerId: 1, clientX: x, clientY: y })
    expect(controller.getState()?.walls[0]?.line).toBe(expectedLine)
  })

  it('forgets a touch that the browser cancels', () => {
    const { controller, canvas } = renderBoard()

    fireEvent.pointerDown(canvas, { pointerType: 'touch', pointerId: 5, clientX: 300, clientY: 200 })
    fireEvent.pointerCancel(canvas, { pointerType: 'touch', pointerId: 5 })
    fireEvent.pointerUp(canvas, { pointerType: 'touch', pointerId: 5, clientX: 300, clientY: 200 })

    expect(controller.getState()?.walls).toHaveLength(0)
  })

  it('suppresses the context menu on the board', () => {
    const { canvas } = renderBoard()

    const allowed = fireEvent.contextMenu(canvas)

    expect(allowed).toBe(false)
  })

  it('runs the main action with Enter while no level is in play', () => {
    const { controller, rerender, onPrimaryAction } = renderBoard()
    controller.pause()
    rerender()

    fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })

    expect(onPrimaryAction).toHaveBeenCalledOnce()
  })

  it('builds at the keyboard cursor with Enter and turns walls with Space while playing', () => {
    const { controller, onPrimaryAction } = renderBoard()
    const board = screen.getByRole('application')

    fireEvent.keyDown(board, { key: ' ' })
    expect(controller.getHud().orientation).toBe('horizontal')

    fireEvent.keyDown(board, { key: 'ArrowDown' })
    fireEvent.keyDown(board, { key: 'Enter' })
    expect(controller.getState()?.walls.length).toBeGreaterThan(0)
    expect(onPrimaryAction).not.toHaveBeenCalled()
  })

  it('shows the overlay slot on top of the field', () => {
    renderBoard()

    expect(screen.getByText('Overlay slot')).toBeInTheDocument()
  })
})
