import { logger } from '@/lib/logger'

/**
 * Everything the game sounds like, synthesised with the Web Audio API (no
 * audio files): an 8-bit tune, a tram that rings, honks and rattles, a lever
 * that clunks and a cartoon "bonk" for whatever is on the wrong track; for
 * Philippa Foot's judge, a gavel and a crowd that roars.
 */

export type SfxName =
  | 'click'
  | 'bell'
  | 'horn'
  | 'lever'
  | 'impact'
  | 'meow'
  | 'woof'
  | 'quack'
  | 'neigh'
  | 'crunch'
  | 'brake'
  | 'drift'
  | 'push'
  | 'cheer'
  | 'reveal'
  | 'whoosh'
  | 'chapter'
  | 'gavel'
  | 'roar'
  | 'flatline'
  | 'zap'
  | 'splash'
  | 'boom'
  | 'heal'
  | 'creak'

export interface TrolleyAudio {
  /** Creates or resumes the audio context; call from a user gesture. */
  unlock(): void
  /** The site-wide sound switch: mutes music and effects together. */
  setEnabled(enabled: boolean): void
  setMusic(enabled: boolean): void
  play(name: SfxName): void
  startRumble(): void
  stopRumble(): void
  /** Turns the music down while the tram runs, so the effects carry. */
  duck(ducked: boolean): void
  dispose(): void
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

const NOTE_INDEX: Readonly<Record<string, number>> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }

/** "A4" → 440 Hz. */
export function noteFrequency(note: string): number {
  const match = /^([A-G]#?)(\d)$/.exec(note)
  if (!match) return 0
  const semitone = (NOTE_INDEX[match[1] as string] ?? 0) + (Number(match[2]) + 1) * 12
  return 440 * Math.pow(2, (semitone - 69) / 12)
}

// ------------------------------------------------------------------ the tune
// 108 BPM, sixteenth-note steps, A minor. Section A then section B, looped.

const TEMPO = 108
const STEP = 60 / TEMPO / 4

type Bar = readonly (string | null)[]
const bar = (notes: string): Bar => notes.split(' ').map((n) => (n === '.' ? null : n))

const MELODY: readonly Bar[] = [
  bar('A4 . C5 . E5 . D5 C5 B4 . A4 . E4 . . .'),
  bar('F4 . A4 . C5 . B4 A4 G4 . F4 . A4 . . .'),
  bar('E4 . G4 . C5 . D5 E5 D5 . C5 . G4 . . .'),
  bar('D5 . B4 . G4 . A4 B4 D5 . . . . . . .'),
  bar('A4 . C5 . E5 . A5 . G5 . E5 . C5 . . .'),
  bar('F5 . E5 . C5 . A4 . C5 . D5 . E5 . . .'),
  bar('D5 . F5 . A5 . F5 . E5 . D5 . C5 . B4 .'),
  bar('G#4 . B4 . E5 . D5 . B4 . G#4 . E4 . . .'),
  bar('C5 C5 . A4 . C5 . F5 . E5 . C5 . A4 . .'),
  bar('D5 D5 . B4 . D5 . G5 . F5 . D5 . B4 . .'),
  bar('E5 . G5 . B5 . G5 . E5 . B4 . G4 . . .'),
  bar('A4 . . C5 . . E5 . A5 . . . . . . .'),
  bar('F5 . E5 . D5 . C5 . A4 . C5 . F5 . . .'),
  bar('G5 . F5 . E5 . D5 . B4 . D5 . G5 . . .'),
  bar('G#5 . . E5 . . B4 . G#4 . . B4 . . E5 .'),
  bar('E5 . D5 . C5 . B4 . G#4 . . . . . . .'),
]

/** Root note and chord tones (semitones above the root) per bar. */
const CHORDS: readonly (readonly [string, readonly number[]])[] = [
  ['A2', [0, 3, 7]], ['F2', [0, 4, 7]], ['C3', [0, 4, 7]], ['G2', [0, 4, 7]],
  ['A2', [0, 3, 7]], ['F2', [0, 4, 7]], ['D3', [0, 3, 7]], ['E2', [0, 4, 7]],
  ['F2', [0, 4, 7]], ['G2', [0, 4, 7]], ['E2', [0, 3, 7]], ['A2', [0, 3, 7]],
  ['F2', [0, 4, 7]], ['G2', [0, 4, 7]], ['E2', [0, 4, 7]], ['E2', [0, 4, 7]],
]

const BASS_PATTERN = [0, null, null, null, 12, null, null, null, 0, null, null, 7, 12, null, 7, null] as const
const KICK = new Set([0, 8, 10])
const SNARE = new Set([4, 12])

function pulseWave(context: AudioContext, duty: number): PeriodicWave {
  const harmonics = 32
  const real = new Float32Array(harmonics)
  const imag = new Float32Array(harmonics)
  for (let n = 1; n < harmonics; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
  return context.createPeriodicWave(real, imag)
}

export function createTrolleyAudio(initiallyEnabled: boolean, initialMusic: boolean): TrolleyAudio {
  let enabled = initiallyEnabled
  let musicWanted = initialMusic
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let sfxBus: GainNode | null = null
  let musicBus: GainNode | null = null
  let noise: AudioBuffer | null = null
  let lead: PeriodicWave | null = null
  let thin: PeriodicWave | null = null
  let schedulerId: ReturnType<typeof setInterval> | null = null
  let nextStepTime = 0
  let step = 0
  let rumble: { readonly stop: () => void } | null = null
  let ducked = false

  const ensure = (): AudioContext | null => {
    if (context) return context
    if (typeof window === 'undefined') return null
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
    if (!Ctor) return null
    try {
      context = new Ctor()
      const compressor = context.createDynamicsCompressor()
      compressor.threshold.value = -14
      compressor.ratio.value = 4
      compressor.connect(context.destination)
      master = context.createGain()
      master.gain.value = enabled ? 0.8 : 0
      master.connect(compressor)
      sfxBus = context.createGain()
      sfxBus.gain.value = 0.9
      sfxBus.connect(master)
      musicBus = context.createGain()
      musicBus.gain.value = 0
      musicBus.connect(master)
      noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      lead = pulseWave(context, 0.25)
      thin = pulseWave(context, 0.125)
    } catch (error: unknown) {
      logger.warn('Audio is unavailable', error)
      context = null
    }
    return context
  }

  const ready = (): boolean => Boolean(context && master && sfxBus && musicBus && context.state === 'running')

  // ---------------------------------------------------------------- voices

  interface ToneOptions {
    readonly type?: OscillatorType
    readonly wave?: PeriodicWave | null
    readonly frequency: number
    readonly to?: number
    readonly start: number
    readonly duration: number
    readonly gain: number
    readonly attack?: number
    readonly output: AudioNode
    readonly vibrato?: { readonly rate: number; readonly depth: number }
  }

  const tone = (o: ToneOptions): void => {
    const ctx = context as AudioContext
    const osc = ctx.createOscillator()
    if (o.wave) osc.setPeriodicWave(o.wave)
    else osc.type = o.type ?? 'square'
    osc.frequency.setValueAtTime(o.frequency, o.start)
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, o.start + o.duration)
    const env = ctx.createGain()
    const attack = o.attack ?? 0.006
    env.gain.setValueAtTime(0.0001, o.start)
    env.gain.exponentialRampToValueAtTime(o.gain, o.start + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, o.start + o.duration)
    osc.connect(env)
    env.connect(o.output)
    if (o.vibrato) {
      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.frequency.value = o.vibrato.rate
      depth.gain.value = o.vibrato.depth
      lfo.connect(depth)
      depth.connect(osc.frequency)
      lfo.start(o.start)
      lfo.stop(o.start + o.duration + 0.05)
    }
    osc.start(o.start)
    osc.stop(o.start + o.duration + 0.05)
  }

  interface NoiseOptions {
    readonly start: number
    readonly duration: number
    readonly gain: number
    readonly filter: BiquadFilterType
    readonly frequency: number
    readonly to?: number
    readonly q?: number
    readonly output: AudioNode
    readonly attack?: number
  }

  const burst = (o: NoiseOptions): void => {
    const ctx = context as AudioContext
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = o.filter
    filter.frequency.setValueAtTime(o.frequency, o.start)
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, o.start + o.duration)
    filter.Q.value = o.q ?? 1
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, o.start)
    env.gain.exponentialRampToValueAtTime(o.gain, o.start + (o.attack ?? 0.004))
    env.gain.exponentialRampToValueAtTime(0.0001, o.start + o.duration)
    source.connect(filter)
    filter.connect(env)
    env.connect(o.output)
    source.start(o.start, Math.random() * 0.5)
    source.stop(o.start + o.duration + 0.05)
  }

  const bellStrike = (t: number, base: number, gain: number, out: AudioNode): void => {
    ;[1, 2.42, 3.86, 5.31].forEach((ratio, index) =>
      tone({ type: 'sine', frequency: base * ratio, start: t, duration: 1.1 - index * 0.2, gain: gain / (index + 1.4), attack: 0.002, output: out }),
    )
  }

  const recipes: Record<SfxName, (t: number, out: AudioNode) => void> = {
    click: (t, out) => tone({ wave: lead, frequency: 880, to: 660, start: t, duration: 0.05, gain: 0.06, output: out }),
    bell: (t, out) => {
      bellStrike(t, 1318, 0.16, out)
      bellStrike(t + 0.2, 1318, 0.14, out)
    },
    horn: (t, out) => {
      const ctx = context as AudioContext
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1400
      filter.connect(out)
      for (const frequency of [311, 392]) tone({ type: 'sawtooth', frequency, start: t, duration: 0.55, gain: 0.07, attack: 0.03, output: filter, vibrato: { rate: 6, depth: 3 } })
    },
    lever: (t, out) => {
      tone({ type: 'square', frequency: 2400, start: t, duration: 0.02, gain: 0.05, output: out })
      for (let i = 0; i < 3; i++) burst({ start: t + i * 0.035, duration: 0.03, gain: 0.12, filter: 'bandpass', frequency: 3200, q: 4, output: out })
      burst({ start: t + 0.12, duration: 0.12, gain: 0.3, filter: 'bandpass', frequency: 1800, q: 2.5, output: out })
      tone({ type: 'sine', frequency: 150, to: 55, start: t + 0.12, duration: 0.16, gain: 0.35, output: out })
      tone({ type: 'triangle', frequency: 1250, start: t + 0.13, duration: 0.25, gain: 0.04, output: out })
    },
    impact: (t, out) => {
      tone({ type: 'sine', frequency: 420, to: 70, start: t, duration: 0.2, gain: 0.45, output: out })
      tone({ type: 'square', frequency: 220, to: 90, start: t, duration: 0.1, gain: 0.06, output: out })
      burst({ start: t, duration: 0.12, gain: 0.25, filter: 'lowpass', frequency: 1600, output: out })
      burst({ start: t + 0.05, duration: 0.45, gain: 0.12, filter: 'highpass', frequency: 900, to: 3000, output: out, attack: 0.03 })
    },
    meow: (t, out) => {
      const ctx = context as AudioContext
      const formant = ctx.createBiquadFilter()
      formant.type = 'bandpass'
      formant.Q.value = 3
      formant.frequency.setValueAtTime(900, t)
      formant.frequency.linearRampToValueAtTime(1700, t + 0.18)
      formant.frequency.linearRampToValueAtTime(1000, t + 0.5)
      formant.connect(out)
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(520, t)
      osc.frequency.linearRampToValueAtTime(800, t + 0.16)
      osc.frequency.linearRampToValueAtTime(540, t + 0.5)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, t)
      env.gain.exponentialRampToValueAtTime(0.3, t + 0.05)
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.52)
      osc.connect(env)
      env.connect(formant)
      osc.start(t)
      osc.stop(t + 0.55)
    },
    woof: (t, out) => {
      for (const offset of [0, 0.2]) {
        tone({ type: 'square', frequency: 240, to: 120, start: t + offset, duration: 0.12, gain: 0.12, output: out })
        burst({ start: t + offset, duration: 0.1, gain: 0.18, filter: 'lowpass', frequency: 900, output: out })
      }
    },
    quack: (t, out) => {
      const ctx = context as AudioContext
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1300
      filter.Q.value = 6
      filter.connect(out)
      tone({ type: 'sawtooth', frequency: 380, to: 300, start: t, duration: 0.22, gain: 0.4, output: filter, vibrato: { rate: 30, depth: 40 } })
    },
    neigh: (t, out) => tone({ type: 'square', frequency: 1200, to: 1700, start: t, duration: 0.35, gain: 0.04, output: out, vibrato: { rate: 22, depth: 120 } }),
    crunch: (t, out) => {
      for (let i = 0; i < 4; i++) burst({ start: t + i * 0.05, duration: 0.06, gain: 0.22, filter: 'bandpass', frequency: 2400 + i * 400, q: 2, output: out })
      tone({ type: 'sine', frequency: 180, to: 60, start: t, duration: 0.18, gain: 0.3, output: out })
    },
    brake: (t, out) => {
      const ctx = context as AudioContext
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2200
      filter.Q.value = 9
      filter.connect(out)
      tone({ type: 'sawtooth', frequency: 2100, to: 1500, start: t, duration: 0.8, gain: 0.12, output: filter, vibrato: { rate: 13, depth: 60 } })
      burst({ start: t, duration: 0.8, gain: 0.08, filter: 'highpass', frequency: 2500, output: out })
    },
    drift: (t, out) => {
      recipes.brake(t, out)
      burst({ start: t, duration: 0.6, gain: 0.15, filter: 'bandpass', frequency: 500, to: 2500, q: 1.2, output: out, attack: 0.05 })
    },
    push: (t, out) => {
      tone({ type: 'square', frequency: 210, to: 140, start: t, duration: 0.12, gain: 0.08, output: out })
      burst({ start: t + 0.15, duration: 0.5, gain: 0.12, filter: 'bandpass', frequency: 2400, to: 400, q: 1, output: out, attack: 0.05 })
    },
    cheer: (t, out) => {
      ;['C5', 'E5', 'G5', 'C6'].forEach((note, index) =>
        tone({ wave: thin, frequency: noteFrequency(note), start: t + index * 0.07, duration: 0.18, gain: 0.05, output: out }),
      )
    },
    reveal: (t, out) => {
      ;['A4', 'C5', 'E5', 'A5', 'C6'].forEach((note, index) =>
        tone({ wave: lead, frequency: noteFrequency(note), start: t + index * 0.06, duration: 0.12, gain: 0.05, output: out }),
      )
      tone({ type: 'triangle', frequency: noteFrequency('E6'), start: t + 0.32, duration: 0.4, gain: 0.07, output: out })
    },
    gavel: (t, out) => {
      for (const offset of [0, 0.17]) {
        burst({ start: t + offset, duration: 0.05, gain: 0.32, filter: 'bandpass', frequency: 1150, q: 3, output: out })
        tone({ type: 'sine', frequency: 280, to: 90, start: t + offset, duration: 0.1, gain: 0.42, output: out })
      }
    },
    roar: (t, out) => {
      burst({ start: t, duration: 1.2, gain: 0.15, filter: 'bandpass', frequency: 360, to: 900, q: 0.8, output: out, attack: 0.25 })
      ;[150, 185, 230].forEach((frequency, index) =>
        tone({ type: 'sawtooth', frequency, to: frequency * 1.25, start: t + index * 0.07, duration: 0.95, gain: 0.025, attack: 0.2, output: out, vibrato: { rate: 7, depth: 9 } }),
      )
    },
    flatline: (t, out) => {
      tone({ type: 'sine', frequency: 1000, start: t, duration: 0.09, gain: 0.08, output: out })
      tone({ type: 'sine', frequency: 1000, start: t + 0.16, duration: 0.9, gain: 0.07, attack: 0.01, output: out })
    },
    zap: (t, out) => {
      tone({ type: 'sawtooth', frequency: 90, to: 60, start: t, duration: 0.45, gain: 0.06, output: out, vibrato: { rate: 50, depth: 30 } })
      for (let i = 0; i < 5; i++) burst({ start: t + i * 0.07, duration: 0.05, gain: 0.16, filter: 'highpass', frequency: 3000, output: out })
    },
    splash: (t, out) => {
      burst({ start: t, duration: 0.5, gain: 0.2, filter: 'lowpass', frequency: 1800, to: 500, output: out, attack: 0.01 })
      for (let i = 0; i < 4; i++) tone({ type: 'sine', frequency: 700 + i * 160, to: 300, start: t + 0.05 + i * 0.06, duration: 0.08, gain: 0.04, output: out })
    },
    boom: (t, out) => {
      tone({ type: 'sine', frequency: 120, to: 32, start: t, duration: 0.9, gain: 0.6, output: out })
      burst({ start: t, duration: 1.1, gain: 0.35, filter: 'lowpass', frequency: 1400, to: 200, output: out, attack: 0.005 })
    },
    heal: (t, out) => {
      ;['E5', 'G#5', 'B5', 'E6'].forEach((note, index) =>
        tone({ type: 'sine', frequency: noteFrequency(note), start: t + index * 0.08, duration: 0.5, gain: 0.05, output: out }),
      )
    },
    creak: (t, out) => tone({ type: 'sawtooth', frequency: 160, to: 110, start: t, duration: 0.5, gain: 0.05, output: out, vibrato: { rate: 18, depth: 14 } }),
    whoosh: (t, out) => burst({ start: t, duration: 0.35, gain: 0.16, filter: 'bandpass', frequency: 400, to: 2600, q: 1.3, output: out, attack: 0.08 }),
    chapter: (t, out) => {
      ;['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((note, index) =>
        tone({ wave: lead, frequency: noteFrequency(note), start: t + index * 0.11, duration: index === 5 ? 0.6 : 0.14, gain: 0.07, output: out }),
      )
      ;['C3', 'G3', 'C4'].forEach((note, index) => tone({ type: 'triangle', frequency: noteFrequency(note), start: t + index * 0.22, duration: 0.3, gain: 0.12, output: out }))
    },
  }

  // ----------------------------------------------------------------- music

  const scheduleStep = (time: number): void => {
    const out = musicBus as GainNode
    const barIndex = Math.floor(step / 16) % MELODY.length
    const index = step % 16
    const note = MELODY[barIndex]?.[index]
    if (note) tone({ wave: lead, frequency: noteFrequency(note), start: time, duration: STEP * 1.8, gain: 0.085, output: out })
    const [root, chord] = CHORDS[barIndex] ?? ['A2', [0, 3, 7]]
    const rootFrequency = noteFrequency(root)
    const bass = BASS_PATTERN[index]
    if (bass !== null && bass !== undefined) tone({ type: 'triangle', frequency: rootFrequency * Math.pow(2, bass / 12), start: time, duration: STEP * 1.6, gain: 0.16, output: out })
    if (index % 2 === 1) {
      const interval = chord[Math.floor(index / 2) % chord.length] ?? 0
      tone({ wave: thin, frequency: rootFrequency * 4 * Math.pow(2, interval / 12), start: time, duration: STEP * 0.9, gain: 0.025, output: out })
    }
    if (KICK.has(index)) tone({ type: 'sine', frequency: 140, to: 45, start: time, duration: 0.12, gain: 0.3, output: out })
    if (SNARE.has(index)) {
      burst({ start: time, duration: 0.1, gain: 0.12, filter: 'bandpass', frequency: 1800, q: 0.8, output: out })
      tone({ type: 'triangle', frequency: 190, start: time, duration: 0.06, gain: 0.06, output: out })
    }
    if (index % 2 === 0) burst({ start: time, duration: 0.03, gain: 0.035, filter: 'highpass', frequency: 7000, output: out })
    // A drum fill at the end of each half.
    if (barIndex % 8 === 7 && index >= 12) burst({ start: time, duration: 0.07, gain: 0.08, filter: 'bandpass', frequency: 1200 + index * 120, q: 1, output: out })
    step += 1
  }

  const startMusic = (): void => {
    if (!ready() || schedulerId !== null) return
    const ctx = context as AudioContext
    nextStepTime = ctx.currentTime + 0.08
    schedulerId = setInterval(() => {
      if (!context) return
      while (nextStepTime < context.currentTime + 0.12) {
        scheduleStep(nextStepTime)
        nextStepTime += STEP
      }
    }, 25)
    const bus = musicBus as GainNode
    bus.gain.cancelScheduledValues(ctx.currentTime)
    bus.gain.setTargetAtTime(ducked ? 0.11 : 0.26, ctx.currentTime, 0.6)
  }

  const stopMusic = (): void => {
    if (schedulerId !== null) clearInterval(schedulerId)
    schedulerId = null
    if (context && musicBus) musicBus.gain.setTargetAtTime(0, context.currentTime, 0.15)
  }

  const syncMusic = (): void => {
    if (enabled && musicWanted) startMusic()
    else stopMusic()
  }

  return {
    unlock() {
      const ctx = ensure()
      if (!ctx) return
      const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
      void resume.then(syncMusic).catch((error: unknown) => logger.warn('Could not start audio', error))
    },
    setEnabled(next) {
      enabled = next
      if (context && master) master.gain.setTargetAtTime(next ? 0.8 : 0, context.currentTime, 0.05)
      if (!next) this.stopRumble()
      syncMusic()
    },
    setMusic(next) {
      musicWanted = next
      syncMusic()
    },
    play(name) {
      if (!enabled || !ready()) return
      const ctx = context as AudioContext
      recipes[name](ctx.currentTime + 0.005, sfxBus as GainNode)
    },
    startRumble() {
      if (!enabled || !ready() || rumble) return
      const ctx = context as AudioContext
      const out = sfxBus as GainNode
      const source = ctx.createBufferSource()
      source.buffer = noise
      source.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 260
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, ctx.currentTime)
      env.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.4)
      source.connect(filter)
      filter.connect(env)
      env.connect(out)
      source.start()
      // Clackety-clack over the rail joints.
      let clack = ctx.currentTime + 0.2
      const timer = setInterval(() => {
        if (!context) return
        while (clack < context.currentTime + 0.15) {
          burst({ start: clack, duration: 0.04, gain: 0.16, filter: 'bandpass', frequency: 900, q: 3, output: out })
          burst({ start: clack + 0.09, duration: 0.04, gain: 0.13, filter: 'bandpass', frequency: 800, q: 3, output: out })
          clack += 0.3
        }
      }, 40)
      rumble = {
        stop: () => {
          clearInterval(timer)
          const now = ctx.currentTime
          env.gain.cancelScheduledValues(now)
          env.gain.setTargetAtTime(0.0001, now, 0.15)
          source.stop(now + 0.8)
        },
      }
    },
    stopRumble() {
      rumble?.stop()
      rumble = null
    },
    duck(next) {
      ducked = next
      if (context && musicBus && schedulerId !== null) musicBus.gain.setTargetAtTime(next ? 0.11 : 0.26, context.currentTime, 0.25)
    },
    dispose() {
      stopMusic()
      rumble?.stop()
      rumble = null
      void context?.close().catch(() => undefined)
      context = null
    },
  }
}
