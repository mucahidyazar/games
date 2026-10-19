import { BoxGeometry, Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three'
import { seededRandom } from './ground'

/**
 * Chunky pixel particles: puffs of smoke when the tram hits something, stars
 * that fly out of the puff, sparks under the wheels and fireflies by the
 * bushes. Every particle is one cube in a single instanced draw call.
 */

export type BurstKind = 'poof' | 'stars' | 'sparks' | 'debris'

interface Particle {
  alive: boolean
  readonly position: Vector3
  readonly velocity: Vector3
  size: number
  life: number
  maxLife: number
  gravity: number
  drag: number
  readonly color: Color
}

const POOF = ['#f4f1ea', '#d9dce4', '#b9c0cc', '#9aa3b2']
const STARS = ['#ffd34d', '#ffe9a3', '#ffb347']
const SPARKS = ['#ffcf6b', '#ffb347', '#fff1c4']

export class Particles {
  readonly mesh: InstancedMesh
  private readonly particles: Particle[]
  private readonly random = seededRandom(42)
  private readonly matrix = new Matrix4()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()
  private cursor = 0

  constructor(capacity = 420) {
    // Drawn after the set and without writing depth, so they never punch holes in the outlines.
    const material = new MeshBasicMaterial({ toneMapped: false, transparent: true, depthWrite: false, fog: false })
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, capacity)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.frustumCulled = false
    // Only up to the last live particle is drawn: software WebGL pays for every instance, even an empty one.
    this.mesh.count = 0
    this.particles = Array.from({ length: capacity }, () => ({
      alive: false,
      position: new Vector3(),
      velocity: new Vector3(),
      size: 0,
      life: 0,
      maxLife: 1,
      gravity: 0,
      drag: 0,
      color: new Color(),
    }))
    for (let i = 0; i < capacity; i++) {
      this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0))
      this.mesh.setColorAt(i, new Color(0, 0, 0))
    }
  }

  private next(): Particle {
    const particle = this.particles[this.cursor] as Particle
    this.cursor = (this.cursor + 1) % this.particles.length
    return particle
  }

  private spawn(position: Vector3, velocity: Vector3, size: number, life: number, gravity: number, drag: number, color: string, glow = 1): void {
    const p = this.next()
    p.alive = true
    p.position.copy(position)
    p.velocity.copy(velocity)
    p.size = size
    p.life = life
    p.maxLife = life
    p.gravity = gravity
    p.drag = drag
    p.color.set(color).multiplyScalar(glow)
  }

  burst(kind: BurstKind, at: Vector3, direction = new Vector3(1, 0, 0), strength = 1): void {
    const r = this.random
    const v = new Vector3()
    if (kind === 'poof') {
      for (let i = 0; i < Math.round(18 * strength); i++) {
        v.set(r() - 0.5, r() * 0.8 + 0.2, r() - 0.5).normalize().multiplyScalar(1.4 + r() * 2.4).addScaledVector(direction, 1.2)
        this.spawn(at.clone().add(new Vector3((r() - 0.5) * 0.4, r() * 0.6, (r() - 0.5) * 0.4)), v, 0.16 + r() * 0.2, 0.45 + r() * 0.45, -1.2, 3.2, POOF[Math.floor(r() * POOF.length)] as string)
      }
    } else if (kind === 'stars') {
      for (let i = 0; i < Math.round(7 * strength); i++) {
        v.set((r() - 0.5) * 3, 4 + r() * 3, (r() - 0.5) * 3).addScaledVector(direction, 1.5)
        this.spawn(at, v, 0.1 + r() * 0.06, 0.7 + r() * 0.3, -11, 0.6, STARS[Math.floor(r() * STARS.length)] as string, 1.6)
      }
    } else if (kind === 'sparks') {
      for (let i = 0; i < Math.round(3 * strength); i++) {
        v.set((r() - 0.5) * 1.6, 1.2 + r() * 2.2, (r() - 0.5) * 1.6).addScaledVector(direction, -2 - r() * 2)
        this.spawn(at, v, 0.05 + r() * 0.04, 0.22 + r() * 0.2, -14, 0.4, SPARKS[Math.floor(r() * SPARKS.length)] as string, 2.2)
      }
    } else {
      for (let i = 0; i < Math.round(10 * strength); i++) {
        v.set(r() - 0.5, r() * 1.2 + 0.4, r() - 0.5).normalize().multiplyScalar(2 + r() * 3).addScaledVector(direction, 2)
        this.spawn(at, v, 0.08 + r() * 0.08, 0.6 + r() * 0.4, -12, 0.5, ['#4a3324', '#6b4a33', '#8a94a6', '#c9ccd3'][Math.floor(r() * 4)] as string)
      }
    }
  }

  update(dt: number): void {
    const { mesh, matrix, quaternion, scale } = this
    let last = -1
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i] as Particle
      if (!p.alive) continue
      p.life -= dt
      if (p.life <= 0) {
        p.alive = false
        mesh.setMatrixAt(i, matrix.makeScale(0, 0, 0))
        continue
      }
      last = i
      p.velocity.y += p.gravity * dt
      p.velocity.multiplyScalar(Math.exp(-p.drag * dt))
      p.position.addScaledVector(p.velocity, dt)
      if (p.position.y < 0.02) {
        p.position.y = 0.02
        p.velocity.y *= -0.3
      }
      const t = p.life / p.maxLife
      scale.setScalar(p.size * Math.min(1, t * 2.2))
      mesh.setMatrixAt(i, matrix.compose(p.position, quaternion, scale))
      mesh.setColorAt(i, p.color)
    }
    mesh.count = last + 1
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  clear(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i] as Particle
      p.alive = false
      this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0))
    }
    this.mesh.count = 0
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as MeshBasicMaterial).dispose()
    this.mesh.dispose()
  }
}

/** A few fireflies drifting over the grass, blinking on and off. */
export class Fireflies {
  readonly mesh: InstancedMesh
  private readonly homes: Vector3[]
  private readonly phases: number[]
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly scale = new Vector3()
  private readonly quaternion = new Quaternion()

  constructor(spots: readonly Vector3[]) {
    const material = new MeshBasicMaterial({ color: new Color('#e8ff9a').multiplyScalar(2.4), toneMapped: false, transparent: true, depthWrite: false, fog: false })
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, spots.length)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.homes = spots.map((spot) => spot.clone())
    const random = seededRandom(99)
    this.phases = spots.map(() => random() * Math.PI * 2)
  }

  update(time: number): void {
    this.homes.forEach((home, i) => {
      const phase = this.phases[i] as number
      this.position.set(home.x + Math.sin(time * 0.6 + phase) * 0.5, home.y + Math.sin(time * 0.9 + phase * 2) * 0.25, home.z + Math.cos(time * 0.5 + phase) * 0.4)
      const blink = Math.max(0, Math.sin(time * 1.7 + phase * 3))
      this.scale.setScalar(blink > 0.35 ? 0.06 : 0)
      this.mesh.setMatrixAt(i, this.matrix.compose(this.position, this.quaternion, this.scale))
    })
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as MeshBasicMaterial).dispose()
    this.mesh.dispose()
  }
}
