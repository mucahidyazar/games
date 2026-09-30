import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSoundPlayer } from './sfx'

const param = () => ({ value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
const node = () => ({ connect: vi.fn() })

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state: AudioContextState = 'suspended'
  currentTime = 0
  destination = {}
  oscillators = 0
  resume = vi.fn(async () => {
    this.state = 'running'
  })

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createGain() {
    return { ...node(), gain: param() }
  }

  createOscillator() {
    this.oscillators++
    return { ...node(), type: 'sine', frequency: param(), start: vi.fn(), stop: vi.fn() }
  }

  createBiquadFilter() {
    return { ...node(), type: 'lowpass', frequency: param() }
  }
}

beforeEach(() => {
  FakeAudioContext.instances = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createSoundPlayer', () => {
  it('stays silent until a user gesture unlocks audio', () => {
    const player = createSoundPlayer(true)

    player.play('capture')

    expect(FakeAudioContext.instances).toHaveLength(0)
  })

  it('creates and resumes the audio context on unlock, then plays tones', async () => {
    const player = createSoundPlayer(true)

    player.unlock()
    const context = FakeAudioContext.instances[0]
    expect(context?.resume).toHaveBeenCalled()
    await Promise.resolve()

    player.play('capture')
    player.play('break')
    player.play('level')
    expect(context?.oscillators).toBe(3 + 1 + 4)
  })

  it('does not create or use audio while muted', async () => {
    const player = createSoundPlayer(false)

    player.unlock()
    expect(FakeAudioContext.instances).toHaveLength(0)

    player.setEnabled(true)
    player.unlock()
    await Promise.resolve()
    player.setEnabled(false)
    player.play('build')

    expect(FakeAudioContext.instances[0]?.oscillators).toBe(0)
  })

  it('plays every sound effect without errors', async () => {
    const player = createSoundPlayer(true)
    player.unlock()
    await Promise.resolve()

    for (const name of ['start', 'build', 'wall', 'capture', 'break', 'blocked', 'level', 'gameOver'] as const) {
      expect(() => player.play(name)).not.toThrow()
    }
  })

  it('degrades gracefully when the browser has no Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined)
    const player = createSoundPlayer(true)

    expect(() => player.unlock()).not.toThrow()
    expect(() => player.play('start')).not.toThrow()
  })
})

describe('haptics', () => {
  it('vibrates for the big moments on devices that support it', () => {
    const vibrate = vi.fn()
    const player = createSoundPlayer(true, vibrate)

    player.play('build')
    player.play('break')
    player.play('level')

    expect(vibrate).toHaveBeenCalledTimes(2)
    expect(vibrate).toHaveBeenNthCalledWith(1, [45])
    expect(vibrate).toHaveBeenNthCalledWith(2, [30, 50, 30])
  })

  it('stays still while muted', () => {
    const vibrate = vi.fn()
    const player = createSoundPlayer(false, vibrate)

    player.play('break')
    player.play('gameOver')

    expect(vibrate).not.toHaveBeenCalled()
  })
})
