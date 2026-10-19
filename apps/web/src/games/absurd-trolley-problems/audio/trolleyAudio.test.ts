import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrolleyAudio, noteFrequency, type SfxName } from './trolleyAudio'

/** An AudioParam that remembers where it was last sent. */
class FakeParam {
  value = 0
  target: number | null = null
  setValueAtTime(value: number): this {
    this.value = value
    return this
  }
  exponentialRampToValueAtTime(): this {
    return this
  }
  linearRampToValueAtTime(): this {
    return this
  }
  setTargetAtTime(value: number): this {
    this.target = value
    return this
  }
  cancelScheduledValues(): this {
    return this
  }
}

const node = () => ({ connect: vi.fn() })

/** Just enough Web Audio to follow what the game schedules. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state: AudioContextState = 'suspended'
  currentTime = 0
  readonly sampleRate = 8000
  readonly destination = {}
  readonly oscillators: { frequency: FakeParam; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  readonly sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  readonly gains: { gain: FakeParam }[] = []
  readonly close = vi.fn(() => Promise.resolve())

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  resume(): Promise<void> {
    this.state = 'running'
    return Promise.resolve()
  }
  createDynamicsCompressor() {
    return { ...node(), threshold: new FakeParam(), ratio: new FakeParam() }
  }
  createGain() {
    const gain = { ...node(), gain: new FakeParam() }
    this.gains.push(gain)
    return gain
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
  createPeriodicWave() {
    return {}
  }
  createOscillator() {
    const oscillator = { ...node(), type: 'sine', frequency: new FakeParam(), setPeriodicWave: vi.fn(), start: vi.fn(), stop: vi.fn() }
    this.oscillators.push(oscillator)
    return oscillator
  }
  createBufferSource() {
    const source = { ...node(), buffer: null, loop: false, start: vi.fn(), stop: vi.fn() }
    this.sources.push(source)
    return source
  }
  createBiquadFilter() {
    return { ...node(), type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() }
  }

  static latest(): FakeAudioContext {
    const context = FakeAudioContext.instances.at(-1)
    if (!context) throw new Error('No audio context was made')
    return context
  }
}

/** Lets promise callbacks (the resume) run. */
const settle = () => vi.advanceTimersByTimeAsync(0)

/** Moves both clocks on: the scheduler's interval and the audio context's time. */
async function advance(context: FakeAudioContext, seconds: number): Promise<void> {
  for (let t = 0; t < seconds; t += 0.025) {
    context.currentTime += 0.025
    await vi.advanceTimersByTimeAsync(25)
  }
}

/** The master volume is the first gain node made, right after the compressor. */
const master = (context: FakeAudioContext) => context.gains[0]?.gain as FakeParam
/** …then the effects bus, then the music bus. */
const musicBus = (context: FakeAudioContext) => context.gains[2]?.gain as FakeParam

beforeEach(() => {
  FakeAudioContext.instances = []
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('noteFrequency', () => {
  it('tunes notes to A440', () => {
    expect(noteFrequency('A4')).toBe(440)
    expect(noteFrequency('A5')).toBe(880)
    expect(noteFrequency('C4')).toBeCloseTo(261.63, 1)
    expect(noteFrequency('G#4')).toBeCloseTo(415.3, 1)
    expect(noteFrequency('H2')).toBe(0)
  })
})

describe('createTrolleyAudio', () => {
  it('stays silent until unlocked by a gesture', async () => {
    const audio = createTrolleyAudio(true, true)
    audio.play('bell')
    expect(FakeAudioContext.instances).toHaveLength(0)

    audio.unlock()
    await settle()
    const context = FakeAudioContext.latest()
    expect(context.state).toBe('running')
    expect(master(context).value).toBe(0.8)
  })

  it('plays the tune on a loop once unlocked, and ducks it during a run', async () => {
    const audio = createTrolleyAudio(true, true)
    audio.unlock()
    await settle()
    const context = FakeAudioContext.latest()
    expect(musicBus(context).target).toBe(0.26)

    await advance(context, 2)
    const notes = context.oscillators.length
    expect(notes).toBeGreaterThan(20)
    // The first melody note is A4.
    expect(context.oscillators.some((oscillator) => oscillator.frequency.value === 440)).toBe(true)

    audio.duck(true)
    expect(musicBus(context).target).toBe(0.11)
    audio.duck(false)
    expect(musicBus(context).target).toBe(0.26)

    audio.setMusic(false)
    expect(musicBus(context).target).toBe(0)
    const stopped = context.oscillators.length
    await advance(context, 1)
    expect(context.oscillators.length).toBe(stopped)
    audio.dispose()
    expect(context.close).toHaveBeenCalled()
  })

  it('plays every effect on the effects bus', async () => {
    const audio = createTrolleyAudio(true, false)
    audio.unlock()
    await settle()
    const context = FakeAudioContext.latest()
    const names: SfxName[] = ['click', 'bell', 'horn', 'lever', 'impact', 'meow', 'woof', 'quack', 'neigh', 'crunch', 'brake', 'drift', 'push', 'cheer', 'reveal', 'whoosh', 'chapter', 'gavel', 'roar', 'flatline', 'zap', 'splash', 'boom', 'heal', 'creak']
    for (const name of names) {
      const before = context.oscillators.length + context.sources.length
      audio.play(name)
      expect(context.oscillators.length + context.sources.length, name).toBeGreaterThan(before)
    }
    // Without music wanted, nothing else was scheduled.
    expect(musicBus(context).value).toBe(0)
  })

  it('mutes everything with the site’s sound switch', async () => {
    const audio = createTrolleyAudio(true, true)
    audio.unlock()
    await settle()
    const context = FakeAudioContext.latest()
    audio.startRumble()
    const rumble = context.sources.at(-1)

    audio.setEnabled(false)
    expect(master(context).target).toBe(0)
    expect(rumble?.stop).toHaveBeenCalled()
    const made = context.oscillators.length
    audio.play('impact')
    await advance(context, 1)
    expect(context.oscillators.length).toBe(made)

    audio.setEnabled(true)
    expect(master(context).target).toBe(0.8)
    expect(musicBus(context).target).toBe(0.26)
  })

  it('rattles over the rail joints while the tram runs', async () => {
    const audio = createTrolleyAudio(true, false)
    audio.unlock()
    await settle()
    const context = FakeAudioContext.latest()

    audio.startRumble()
    audio.startRumble()
    const rumble = context.sources[0]
    expect(rumble?.start).toHaveBeenCalledTimes(1)
    await advance(context, 1)
    // Two clacks every 0.3 s, each a burst of noise.
    expect(context.sources.length).toBeGreaterThan(5)

    audio.stopRumble()
    expect(rumble?.stop).toHaveBeenCalled()
    const after = context.sources.length
    await advance(context, 1)
    expect(context.sources.length).toBe(after)
  })

  it('starts muted when the site is muted', async () => {
    const audio = createTrolleyAudio(false, true)
    audio.unlock()
    await settle()
    const context = FakeAudioContext.latest()
    expect(master(context).value).toBe(0)
    audio.play('bell')
    audio.startRumble()
    expect(context.oscillators).toHaveLength(0)
    expect(context.sources).toHaveLength(0)
  })

  it('falls back to the prefixed context, and copes with none at all', async () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', FakeAudioContext)
    const prefixed = createTrolleyAudio(true, false)
    prefixed.unlock()
    await settle()
    expect(FakeAudioContext.instances).toHaveLength(1)

    vi.stubGlobal('webkitAudioContext', undefined)
    const none = createTrolleyAudio(true, true)
    expect(() => {
      none.unlock()
      none.play('bell')
      none.startRumble()
      none.duck(true)
      none.setMusic(false)
      none.dispose()
    }).not.toThrow()
  })

  it('carries on silently when the browser refuses to make a context', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('not allowed')
        }
      },
    )
    const audio = createTrolleyAudio(true, true)
    expect(() => {
      audio.unlock()
      audio.play('lever')
    }).not.toThrow()
  })
})
