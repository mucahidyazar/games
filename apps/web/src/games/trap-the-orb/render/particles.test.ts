import { describe, expect, it } from 'vitest'
import { nextRandom } from '@games/trap-the-orb-engine'
import { createCaptureParticles, MAX_PARTICLES, particleAt, PARTICLE_LIFETIME_MS } from './particles'

/** Deterministic random source for tests. */
const seeded = (seed: number) => {
  let state = seed
  return () => {
    const [value, next] = nextRandom(state)
    state = next
    return value
  }
}

describe('createCaptureParticles', () => {
  const runs = [
    { row: 10, start: 20, end: 60 },
    { row: 11, start: 20, end: 60 },
  ]

  it('spawns particles inside the captured cells', () => {
    const particles = createCaptureParticles(runs, seeded(1))

    expect(particles.length).toBeGreaterThan(0)
    for (const particle of particles) {
      expect(particle.x).toBeGreaterThanOrEqual(20)
      expect(particle.x).toBeLessThanOrEqual(60)
      expect(particle.y).toBeGreaterThanOrEqual(10)
      expect(particle.y).toBeLessThanOrEqual(12)
    }
  })

  it('scales with the captured area but stays capped', () => {
    const small = createCaptureParticles([{ row: 1, start: 1, end: 5 }], seeded(2))
    const huge = createCaptureParticles(
      Array.from({ length: 200 }, (_, row) => ({ row, start: 0, end: 300 })),
      seeded(3),
    )

    expect(small.length).toBeLessThan(huge.length)
    expect(huge).toHaveLength(MAX_PARTICLES)
  })

  it('returns nothing for an empty capture', () => {
    expect(createCaptureParticles([], seeded(4))).toEqual([])
  })
})

describe('particleAt', () => {
  it('flies out, falls with gravity and fades away', () => {
    const particle = { x: 10, y: 10, vx: 20, vy: -30, size: 0.8, tone: 0 as const }

    const start = particleAt(particle, 0)
    const later = particleAt(particle, 400)
    const end = particleAt(particle, PARTICLE_LIFETIME_MS)

    expect(start).toMatchObject({ x: 10, y: 10, alpha: 1 })
    expect(later.x).toBeGreaterThan(10)
    expect(later.alpha).toBeLessThan(1)
    expect(end.alpha).toBe(0)
  })
})
