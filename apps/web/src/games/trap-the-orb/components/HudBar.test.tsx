import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { INITIAL_HUD, type HudSnapshot } from '../controller/GameController'
import { HudBar } from './HudBar'

const renderHud = (hud: Partial<HudSnapshot>) => render(<HudBar hud={{ ...INITIAL_HUD, status: 'playing', ...hud }} />)

describe('HudBar', () => {
  it('warns when the last life is left', () => {
    renderHud({ lives: 1, maxLives: 4 })

    expect(screen.getByLabelText('1 of 4')).toHaveClass('text-coral-600')
  })

  it('shows unlimited lives as ∞', () => {
    renderHud({ infiniteLives: true, lives: 3 })

    expect(screen.getByLabelText('Unlimited')).toHaveTextContent('∞')
  })

  it('shows the fastest orb’s speed and tier', () => {
    renderHud({ topSpeedFactor: 1.4, orbTiers: [2, 0] })

    expect(screen.getByLabelText('Fastest orb 1.40×, fast')).toBeInTheDocument()
  })

  it('counts down in timed levels and turns red near the end', () => {
    renderHud({ timeLeftMs: 8000, elapsedMs: 40_000 })

    expect(screen.getByText('Left')).toBeInTheDocument()
    expect(screen.getByLabelText('00:08 left')).toHaveClass('text-coral-600')
  })

  it('shows elapsed time when there is no timer', () => {
    renderHud({ timeLeftMs: null, elapsedMs: 65_000 })

    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('01:05')).toBeInTheDocument()
  })

  it('adds a walls counter when walls are limited', () => {
    const { container } = renderHud({ wallsLeft: 2, wallBudget: 10 })

    expect(screen.getByLabelText('2 of 10 walls left')).toHaveClass('text-coral-600')
    expect(container.querySelector('dl')).toHaveClass('grid-cols-6')
  })

  it('has no walls counter otherwise', () => {
    const { container } = renderHud({ wallsLeft: null, wallBudget: null })

    expect(screen.queryByText('Walls')).not.toBeInTheDocument()
    expect(container.querySelector('dl')).toHaveClass('grid-cols-5')
  })
})
