import { logger } from '@/lib/logger'

export type SoundName = 'start' | 'build' | 'wall' | 'capture' | 'break' | 'blocked' | 'level' | 'gameOver'

/** Plays a vibration pattern (milliseconds on/off). */
export type Vibrate = (pattern: readonly number[]) => void

/** Short vibrations for the moments that matter; phones without support simply ignore them. */
const HAPTICS: Partial<Record<SoundName, readonly number[]>> = {
  break: [45],
  level: [30, 50, 30],
  gameOver: [90, 60, 140],
}

const deviceVibrate: Vibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([...pattern])
}

/** Game feedback: synthesised sound plus haptics, both behind the same on/off switch. */
export interface SoundPlayer {
  play(name: SoundName): void
  /** Creates or resumes the audio context; call from a user gesture. */
  unlock(): void
  /** Mutes or unmutes; never creates the audio context by itself. */
  setEnabled(enabled: boolean): void
}

interface ToneOptions {
  readonly frequency: number
  readonly endFrequency?: number
  readonly type: OscillatorType
  readonly start: number
  readonly duration: number
  readonly gain: number
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

const NOTES = { C4: 261.63, E4: 329.63, G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 } as const

/** Small synthesised sound effects — no audio files to download. */
export function createSoundPlayer(initiallyEnabled: boolean, vibrate: Vibrate = deviceVibrate): SoundPlayer {
  let enabled = initiallyEnabled
  let context: AudioContext | null = null
  let master: GainNode | null = null

  const ensureContext = (): AudioContext | null => {
    if (context) return context
    if (typeof window === 'undefined') return null
    const AudioCtor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
    if (!AudioCtor) return null
    try {
      context = new AudioCtor()
      master = context.createGain()
      master.gain.value = 0.55
      master.connect(context.destination)
    } catch (error: unknown) {
      logger.warn('Audio is unavailable', error)
      context = null
    }
    return context
  }

  const tone = (ctx: AudioContext, output: AudioNode, options: ToneOptions): void => {
    const oscillator = ctx.createOscillator()
    const envelope = ctx.createGain()
    const end = options.start + options.duration

    oscillator.type = options.type
    oscillator.frequency.setValueAtTime(options.frequency, options.start)
    if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, end)

    envelope.gain.setValueAtTime(0.0001, options.start)
    envelope.gain.exponentialRampToValueAtTime(options.gain, options.start + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0001, end)

    oscillator.connect(envelope)
    envelope.connect(output)
    oscillator.start(options.start)
    oscillator.stop(end + 0.02)
  }

  const arpeggio = (ctx: AudioContext, output: AudioNode, t: number, notes: readonly number[], spacing: number): void => {
    notes.forEach((frequency, index) =>
      tone(ctx, output, { frequency, type: 'triangle', start: t + index * spacing, duration: 0.2, gain: 0.16 }),
    )
  }

  const recipes: Record<SoundName, (ctx: AudioContext, output: AudioNode, t: number) => void> = {
    start: (ctx, out, t) => arpeggio(ctx, out, t, [NOTES.C5, NOTES.G5], 0.07),
    build: (ctx, out, t) =>
      tone(ctx, out, { frequency: 900, endFrequency: 620, type: 'sine', start: t, duration: 0.07, gain: 0.12 }),
    wall: (ctx, out, t) =>
      tone(ctx, out, { frequency: 320, endFrequency: 210, type: 'sine', start: t, duration: 0.1, gain: 0.18 }),
    capture: (ctx, out, t) => arpeggio(ctx, out, t, [NOTES.C5, NOTES.E5, NOTES.G5], 0.045),
    break: (ctx, out, t) => {
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1400
      filter.connect(out)
      tone(ctx, filter, { frequency: 240, endFrequency: 80, type: 'sawtooth', start: t, duration: 0.24, gain: 0.14 })
    },
    blocked: (ctx, out, t) =>
      tone(ctx, out, { frequency: 180, type: 'square', start: t, duration: 0.05, gain: 0.04 }),
    level: (ctx, out, t) => arpeggio(ctx, out, t, [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6], 0.075),
    gameOver: (ctx, out, t) => arpeggio(ctx, out, t, [NOTES.G4, NOTES.E4, NOTES.C4], 0.13),
  }

  return {
    play(name) {
      if (!enabled) return
      const pattern = HAPTICS[name]
      if (pattern) vibrate(pattern)
      // Only play through a context that a user gesture already unlocked.
      if (!context || !master || context.state !== 'running') return
      recipes[name](context, master, context.currentTime + 0.005)
    },
    unlock() {
      if (!enabled) return
      const ctx = ensureContext()
      if (ctx?.state === 'suspended') {
        ctx.resume().catch((error: unknown) => logger.warn('Could not resume audio', error))
      }
    },
    setEnabled(next) {
      enabled = next
    },
  }
}
