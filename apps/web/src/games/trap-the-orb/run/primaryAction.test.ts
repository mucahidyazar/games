import { describe, expect, it } from 'vitest'
import { INITIAL_HUD, type HudSnapshot } from '../controller/GameController'
import { primaryActionFor } from './primaryAction'

const hud = (patch: Partial<HudSnapshot>): HudSnapshot => ({ ...INITIAL_HUD, ...patch })

describe('primaryActionFor', () => {
  it('follows the game state', () => {
    expect(primaryActionFor(hud({ status: 'ready' }), false, false)).toBe('play')
    expect(primaryActionFor(hud({ status: 'ready' }), false, true)).toBe('continue')
    expect(primaryActionFor(hud({ status: 'playing', inRun: true }), false, false)).toBe('pause')
    expect(primaryActionFor(hud({ status: 'paused', inRun: true }), false, false)).toBe('resume')
    expect(primaryActionFor(hud({ status: 'levelComplete', inRun: true }), false, false)).toBe('next')
    expect(primaryActionFor(hud({ status: 'gameOver', inRun: true }), false, false)).toBe('playAgain')
    expect(primaryActionFor(hud({ status: 'loading' }), false, false)).toBe('play')
  })

  it('offers another go while a result is shown', () => {
    expect(primaryActionFor(hud({ status: 'ready', inRun: false }), true, true)).toBe('playAgain')
    expect(primaryActionFor(hud({ status: 'playing', inRun: true }), true, false)).toBe('pause')
  })
})
