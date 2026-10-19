import { describe, expect, it, vi } from 'vitest'
import type { TrolleyAudio } from '../audio/trolleyAudio'
import { playSceneSound } from './sceneSounds'

function fakeAudio(): TrolleyAudio {
  return { unlock: vi.fn(), setEnabled: vi.fn(), setMusic: vi.fn(), play: vi.fn(), startRumble: vi.fn(), stopRumble: vi.fn(), duck: vi.fn(), dispose: vi.fn() }
}

describe('playSceneSound', () => {
  it('gives every scene event its sound', () => {
    const audio = fakeAudio()
    for (const event of ['arrive', 'bell', 'lever', 'push', 'brake', 'drift', 'cheer', 'gavel', 'roar', 'boom', 'heal', 'creak', 'zap', 'splash'] as const) playSceneSound(audio, event)
    expect(vi.mocked(audio.play).mock.calls.map(([name]) => name)).toEqual(['whoosh', 'bell', 'lever', 'push', 'brake', 'drift', 'cheer', 'gavel', 'roar', 'boom', 'heal', 'creak', 'zap', 'splash'])
  })

  it('rumbles while the tram runs', () => {
    const audio = fakeAudio()
    expect(playSceneSound(audio, 'depart')).toBe(false)
    expect(audio.play).toHaveBeenCalledWith('horn')
    expect(audio.startRumble).toHaveBeenCalled()
    playSceneSound(audio, 'stop')
    expect(audio.stopRumble).toHaveBeenCalled()
  })

  it('counts a life only when one is hit', () => {
    const audio = fakeAudio()
    expect(playSceneSound(audio, 'impact', { kind: 'person' })).toBe(true)
    expect(playSceneSound(audio, 'impact', { kind: 'cat' })).toBe(true)
    expect(audio.play).toHaveBeenCalledWith('meow')
    expect(playSceneSound(audio, 'impact', { kind: 'teapot' })).toBe(false)
    expect(audio.play).toHaveBeenCalledWith('crunch')
    expect(playSceneSound(audio, 'impact')).toBe(false)
  })

  it('sounds a life lost away from the tracks its own way, and still counts it', () => {
    const audio = fakeAudio()
    expect(playSceneSound(audio, 'impact', { kind: 'person', how: 'flatline' })).toBe(true)
    expect(playSceneSound(audio, 'impact', { kind: 'person', how: 'drown' })).toBe(true)
    expect(vi.mocked(audio.play).mock.calls.map(([name]) => name)).toEqual(['flatline', 'splash'])
  })
})
