import type { CellRun } from '@games/trap-the-orb-engine'

/** A confetti-like speck thrown up when territory is captured. Units: cells and cells/second. */
export interface Particle {
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly size: number
  /** Index into the renderer's particle colours. */
  readonly tone: 0 | 1 | 2
}

export interface ParticleFrame {
  readonly x: number
  readonly y: number
  readonly alpha: number
}

export const PARTICLE_LIFETIME_MS = 850
export const MAX_PARTICLES = 42
const MIN_PARTICLES = 8
/** One particle per this many captured cells, on top of the minimum. */
const CELLS_PER_PARTICLE = 260
const GRAVITY = 70

/**
 * Scatters particles over the captured runs, weighted by run length, each
 * flying up and out. `random` returns values in [0, 1).
 */
export function createCaptureParticles(runs: readonly CellRun[], random: () => number): Particle[] {
  const total = runs.reduce((sum, run) => sum + (run.end - run.start), 0)
  if (total === 0) return []

  const count = Math.min(MAX_PARTICLES, MIN_PARTICLES + Math.floor(total / CELLS_PER_PARTICLE))
  const particles: Particle[] = []

  for (let i = 0; i < count; i++) {
    let target = random() * total
    const run = runs.find((candidate) => {
      target -= candidate.end - candidate.start
      return target < 0
    }) ?? runs[runs.length - 1]
    if (!run) break

    const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 0.9
    const speed = 18 + random() * 26
    particles.push({
      x: run.start + random() * (run.end - run.start),
      y: run.row + random(),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 0.6 + random() * 0.9,
      tone: (i % 3) as Particle['tone'],
    })
  }
  return particles
}

/** Where a particle is, and how visible, `elapsedMs` after it was spawned. */
export function particleAt(particle: Particle, elapsedMs: number): ParticleFrame {
  const t = Math.max(0, elapsedMs) / 1000
  const life = Math.min(1, Math.max(0, elapsedMs / PARTICLE_LIFETIME_MS))
  return {
    x: particle.x + particle.vx * t,
    y: particle.y + particle.vy * t + 0.5 * GRAVITY * t * t,
    alpha: 1 - life * life,
  }
}
