import { Matrix4, Vector3, type InstancedMesh } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { Fireflies, Particles, type BurstKind } from './effects'

const matrix = new Matrix4()

/** Instances drawn at a visible size. */
function visible(mesh: InstancedMesh): number[] {
  const shown: number[] = []
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix)
    if (new Vector3().setFromMatrixScale(matrix).x > 0) shown.push(i)
  }
  return shown
}

function positions(mesh: InstancedMesh): Vector3[] {
  return visible(mesh).map((i) => {
    mesh.getMatrixAt(i, matrix)
    return new Vector3().setFromMatrixPosition(matrix)
  })
}

describe('Particles', () => {
  it('starts with nothing on screen', () => {
    const particles = new Particles(40)
    expect(particles.mesh.count).toBe(0)
    expect(visible(particles.mesh)).toEqual([])
  })

  it('draws up to the last live particle and no further', () => {
    const particles = new Particles(40)
    particles.burst('sparks', new Vector3(0, 0.5, 0))
    particles.update(1 / 60)
    expect(particles.mesh.count).toBe(3)
    particles.burst('poof', new Vector3(0, 0.5, 0))
    particles.update(1 / 60)
    expect(particles.mesh.count).toBe(21)

    // The sparks die first; the puff, further along, keeps everything up to it drawn.
    for (let i = 0; i < 30; i++) particles.update(1 / 60)
    expect(visible(particles.mesh).every((index) => index >= 3)).toBe(true)
    expect(particles.mesh.count).toBeGreaterThan(3)

    particles.clear()
    expect(particles.mesh.count).toBe(0)
  })

  it.each<[BurstKind, number]>([
    ['poof', 18],
    ['stars', 7],
    ['sparks', 3],
    ['debris', 10],
  ])('bursts %s into %i cubes that fade away', (kind, count) => {
    const particles = new Particles(60)
    particles.burst(kind, new Vector3(0, 0.5, 0))
    particles.update(1 / 60)
    expect(visible(particles.mesh)).toHaveLength(count)

    for (let i = 0; i < 120; i++) particles.update(1 / 60)
    expect(visible(particles.mesh)).toEqual([])
  })

  it('scales a burst with its strength', () => {
    const particles = new Particles(80)
    particles.burst('poof', new Vector3(), new Vector3(1, 0, 0), 2)
    particles.update(1 / 60)
    expect(visible(particles.mesh)).toHaveLength(36)
  })

  it('bounces off the ground instead of sinking through it', () => {
    const particles = new Particles(30)
    particles.burst('debris', new Vector3(0, 0.1, 0))
    for (let i = 0; i < 20; i++) {
      particles.update(1 / 30)
      // Instance matrices are 32-bit floats.
      for (const position of positions(particles.mesh)) expect(position.y).toBeGreaterThan(0.0199)
    }
  })

  it('reuses the oldest cubes when it runs out', () => {
    const particles = new Particles(5)
    particles.burst('poof', new Vector3())
    particles.update(1 / 60)
    expect(visible(particles.mesh)).toHaveLength(5)
  })

  it('clears and disposes', () => {
    const particles = new Particles(20)
    particles.burst('stars', new Vector3())
    particles.update(1 / 60)
    particles.clear()
    expect(visible(particles.mesh)).toEqual([])

    const dispose = vi.spyOn(particles.mesh.geometry, 'dispose')
    particles.dispose()
    expect(dispose).toHaveBeenCalled()
  })
})

describe('Fireflies', () => {
  const homes = [new Vector3(0, 1, 0), new Vector3(3, 1.2, -1), new Vector3(-2, 0.8, 2), new Vector3(5, 1, 1)]

  it('drift around their bushes and blink', () => {
    const flies = new Fireflies(homes)
    const seen = new Set<number>()
    for (let t = 0; t < 8; t += 0.25) {
      flies.update(t)
      for (const i of visible(flies.mesh)) {
        seen.add(i)
        flies.mesh.getMatrixAt(i, matrix)
        const position = new Vector3().setFromMatrixPosition(matrix)
        const home = homes[i] as Vector3
        expect(Math.abs(position.x - home.x)).toBeLessThan(0.5001)
        expect(Math.abs(position.y - home.y)).toBeLessThan(0.2501)
        expect(Math.abs(position.z - home.z)).toBeLessThan(0.4001)
      }
    }
    // Every firefly lights up at some point.
    expect(seen.size).toBe(homes.length)

    const dispose = vi.spyOn(flies.mesh.geometry, 'dispose')
    flies.dispose()
    expect(dispose).toHaveBeenCalled()
  })
})
