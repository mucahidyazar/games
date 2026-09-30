import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { SoundPlayer } from '../audio/sfx'
import { GameController, INITIAL_HUD, type HudSnapshot } from '../controller/GameController'
import { GameHeader } from './GameHeader'

const fakeSound = (): SoundPlayer => ({ play: vi.fn(), unlock: vi.fn(), setEnabled: vi.fn() })

type HeaderProps = ComponentProps<typeof GameHeader>

function setup(hud: Partial<HudSnapshot>, props: Partial<HeaderProps> = {}) {
  const controller = new GameController({ sound: fakeSound(), seed: 1 })
  const handlers = {
    onPrimaryAction: vi.fn(),
    onEndRun: vi.fn(),
    onAfterAction: vi.fn(),
  }
  render(
    <GameHeader
      hud={{ ...INITIAL_HUD, status: 'ready', ...hud }}
      controller={controller}
      primaryAction="play"
      isBusy={false}
      {...handlers}
      {...props}
    />,
  )
  return { controller, handlers, user: userEvent.setup() }
}

describe('GameHeader', () => {
  it.each([
    ['play', 'Play'],
    ['continue', 'Continue'],
    ['pause', 'Pause'],
    ['resume', 'Resume'],
    ['next', 'Next'],
    ['playAgain', 'Again'],
  ] as const)('the %s action reads "%s" and runs on click', async (primaryAction, label) => {
    const { handlers, user } = setup({}, { primaryAction })

    await user.click(screen.getByRole('button', { name: label }))

    expect(handlers.onPrimaryAction).toHaveBeenCalledOnce()
    expect(handlers.onAfterAction).toHaveBeenCalled()
  })

  it('disables the main button while a run is starting', () => {
    setup({}, { isBusy: true })

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
  })

  it('offers to restart the level in practice modes', async () => {
    const { controller, user } = setup({ mode: 'zen', rankedMode: false, inRun: true, status: 'playing' })
    const spy = vi.spyOn(controller, 'restartLevel')

    await user.click(screen.getByRole('button', { name: 'Restart level' }))

    expect(spy).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'End run' })).not.toBeInTheDocument()
  })

  it('offers to end the run in ranked modes instead', async () => {
    const { handlers, user } = setup({ mode: 'classic', rankedMode: true, inRun: true, status: 'paused' })

    await user.click(screen.getByRole('button', { name: 'End run' }))

    expect(handlers.onEndRun).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Restart level' })).not.toBeInTheDocument()
  })

  it('disables restarting and ending outside a run', () => {
    setup({ mode: 'zen', rankedMode: false, inRun: false, status: 'ready' })

    expect(screen.getByRole('button', { name: 'Restart level' })).toBeDisabled()
  })

  it('shows the level, the orbs in play and the target', () => {
    setup({ level: 7, mode: 'timeAttack', orbCount: 3, orbTiers: [2, 1, 0], targetPercent: 75 })

    expect(screen.getByRole('heading', { name: 'Level 7' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Orbs: 1 calm, 1 quick, 1 fast' })).toBeInTheDocument()
    expect(screen.getByText('3 orbs · clear at 75%')).toBeInTheDocument()
  })

  it('says "orb" for a single orb', () => {
    setup({ orbCount: 1, orbTiers: [0], targetPercent: 60 })

    expect(screen.getByText('1 orb · clear at 60%')).toBeInTheDocument()
  })

  it('switches the wall direction', async () => {
    const { controller, user } = setup({ orientation: 'vertical' })
    const spy = vi.spyOn(controller, 'toggleOrientation')

    await user.click(screen.getByRole('button', { name: /Wall direction: vertical/ }))

    expect(spy).toHaveBeenCalledOnce()
  })
})
