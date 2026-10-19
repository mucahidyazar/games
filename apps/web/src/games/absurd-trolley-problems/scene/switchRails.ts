import { BufferAttribute, BufferGeometry, Mesh, MeshToonMaterial, Vector3, type Material, type Object3D } from 'three'
import { BRANCH, LAYOUT, MAIN } from './layout'

/**
 * The switch: the first metres of rail past the junction, which the lever
 * bends from the main line over to the branch. The Blender set leaves a gap
 * there; these rails are rebuilt whenever the lever moves, so they follow it
 * while it is dragged, and the rod from the lever slides with them.
 */

/** A rail's cross-section (offset across the track, height), the same as the set's rails. */
const SECTION: readonly (readonly [number, number])[] = [
  [-0.06, 0.13],
  [-0.035, 0.16],
  [-0.035, 0.23],
  [0.035, 0.23],
  [0.035, 0.16],
  [0.06, 0.13],
]
const SAMPLES = 14
/** How far the rod from the lever slides when the lever is pulled all the way. */
const ROD_THROW = 0.16

export function findMaterial(root: Object3D, name: string): Material | null {
  let found: Material | null = null
  root.traverse((object) => {
    const mesh = object as Mesh
    if (found || !mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    found = materials.find((material) => material.name === name) ?? null
  })
  return found
}

export class SwitchRails {
  readonly mesh: Mesh
  private readonly positions: Float32Array
  private readonly rod: Object3D | null
  private readonly rodRest = new Vector3()
  private readonly rodDirection: Vector3
  private shown = Number.NaN

  /** `set` is the loaded set: the rails borrow its rail material and move its `switch_rod`. */
  constructor(set: Object3D) {
    const vertices = 2 * (SAMPLES - 1) * (SECTION.length - 1) * 6
    this.positions = new Float32Array(vertices * 3)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    this.mesh = new Mesh(geometry, findMaterial(set, 'rail') ?? new MeshToonMaterial({ name: 'rail', color: '#9aa3b2' }))
    this.mesh.name = 'switch_rails'
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true

    this.rod = set.getObjectByName('switch_rod') ?? null
    if (this.rod) this.rodRest.copy(this.rod.position)
    // The rod runs from the lever to the switch machine beside the junction.
    const [leverX, , leverZ] = LAYOUT.lever
    const junction = MAIN.pointAt(0)
    this.rodDirection = new Vector3(junction.x - 0.5 - leverX, 0, junction.z + 1.32 - leverZ).normalize()
    this.update(0)
  }

  /** How far over the switch is: 0 on the main line, 1 on the branch. */
  get progress(): number {
    return this.shown
  }

  /** Sets the switch: 0 lies on the main line, 1 on the branch, anything between is on its way. */
  update(progress: number): void {
    // In thousandths: the lever eases towards its stop forever, but the rails settle (and stop being rebuilt).
    const s = Math.round(Math.min(1, Math.max(0, progress)) * 1000) / 1000
    if (s === this.shown) return
    this.shown = s

    // Each rail's cross-section at every sample, the centre line blended between the two tracks.
    const centreAt = (distance: number): Vector3 => MAIN.pointAt(distance).lerp(BRANCH.pointAt(distance), s)
    const rings: Vector3[][][] = [[], []]
    for (let i = 0; i < SAMPLES; i++) {
      const distance = (LAYOUT.switchRails * i) / (SAMPLES - 1)
      const centre = centreAt(distance)
      const along = centreAt(distance + 0.1).sub(centreAt(distance - 0.1)).normalize()
      const across = new Vector3(along.z, 0, -along.x)
      ;[-1, 1].forEach((side, rail) => {
        const offset = (side * LAYOUT.gauge) / 2
        ;(rings[rail] as Vector3[][]).push(SECTION.map(([shift, height]) => centre.clone().addScaledVector(across, offset + shift).setY(height)))
      })
    }

    // Two triangles per quad between neighbouring sections, wound to face outwards.
    let k = 0
    const put = (point: Vector3): void => {
      this.positions[k++] = point.x
      this.positions[k++] = point.y
      this.positions[k++] = point.z
    }
    for (const rail of rings) {
      for (let i = 0; i < SAMPLES - 1; i++) {
        const a = rail[i] as Vector3[]
        const b = rail[i + 1] as Vector3[]
        for (let j = 0; j < SECTION.length - 1; j++) {
          const [a0, b0, b1, a1] = [a[j], b[j], b[j + 1], a[j + 1]] as Vector3[]
          for (const point of [a0, b0, b1, a0, b1, a1] as Vector3[]) put(point)
        }
      }
    }
    const geometry = this.mesh.geometry
    geometry.getAttribute('position').needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    this.rod?.position.copy(this.rodRest).addScaledVector(this.rodDirection, s * ROD_THROW)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
  }
}
