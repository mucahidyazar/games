import { BoxGeometry, Group, Mesh, MeshToonMaterial, Vector3, type BufferAttribute } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { BRANCH, LAYOUT, MAIN, type Path } from './layout'
import { findMaterial, SwitchRails } from './switchRails'

/** A stand-in for the loaded set: a track mesh with the rail material, and the lever's rod. */
function set() {
  const root = new Group()
  const rail = new MeshToonMaterial({ name: 'rail' })
  root.add(new Mesh(new BoxGeometry(), [new MeshToonMaterial({ name: 'ballast' }), rail]))
  const rod = new Group()
  rod.name = 'switch_rod'
  rod.position.set(1, 0, 2)
  root.add(rod)
  return { root, rail, rod }
}

const vertices = (rails: SwitchRails): Vector3[] => {
  const position = rails.mesh.geometry.getAttribute('position') as BufferAttribute
  return Array.from({ length: position.count }, (_, i) => new Vector3(position.getX(i), position.getY(i), position.getZ(i)))
}

/** The top of each rail's head, `distance` along a track. */
function railHeads(path: Path, distance: number): Vector3[] {
  const centre = path.pointAt(distance)
  const along = path.pointAt(distance + 0.1).sub(path.pointAt(distance - 0.1)).normalize()
  const across = new Vector3(along.z, 0, -along.x)
  return [-1, 1].map((side) => centre.clone().addScaledVector(across, (side * LAYOUT.gauge) / 2).setY(0.23))
}

/** How close the rails come to a point. */
const reach = (rails: SwitchRails, point: Vector3): number => Math.min(...vertices(rails).map((vertex) => vertex.distanceTo(point)))

/** Where the tracks part, their inner rails almost touch: the outer rail head tells them apart. */
function outerHead(path: Path, other: Path, distance: number): Vector3 {
  const otherCentre = other.pointAt(distance)
  const [first, second] = railHeads(path, distance) as [Vector3, Vector3]
  return first.distanceTo(otherCentre) > second.distanceTo(otherCentre) ? first : second
}

describe('SwitchRails', () => {
  const end = LAYOUT.switchRails

  it('lie on the main line until the lever moves', () => {
    const rails = new SwitchRails(set().root)
    expect(rails.progress).toBe(0)
    for (const head of railHeads(MAIN, end)) expect(reach(rails, head)).toBeLessThan(0.05)
    expect(reach(rails, outerHead(BRANCH, MAIN, end))).toBeGreaterThan(0.6)
  })

  it('swing over to the branch, staying joined at the junction', () => {
    const rails = new SwitchRails(set().root)
    for (const progress of [0.5, 1]) {
      rails.update(progress)
      for (const head of railHeads(MAIN, 0)) expect(reach(rails, head)).toBeLessThan(0.05)
    }
    for (const head of railHeads(BRANCH, end)) expect(reach(rails, head)).toBeLessThan(0.05)
    expect(reach(rails, outerHead(MAIN, BRANCH, end))).toBeGreaterThan(0.6)
  })

  it('follow every step of the lever, rebuilding only when it moves', () => {
    const rails = new SwitchRails(set().root)
    const position = rails.mesh.geometry.getAttribute('position') as BufferAttribute
    const version = position.version
    rails.update(0.3)
    expect(position.version).toBe(version + 1)
    // Easing the last hair towards the stop changes nothing on screen, so nothing is rebuilt.
    rails.update(0.30004)
    expect(position.version).toBe(version + 1)
    // Halfway, the far end hangs between the two tracks.
    const [mainHead] = railHeads(MAIN, end)
    const [branchHead] = railHeads(BRANCH, end)
    const between = (mainHead as Vector3).clone().lerp(branchHead as Vector3, 0.3)
    expect(reach(rails, between)).toBeLessThan(0.05)
    rails.update(4)
    expect(rails.progress).toBe(1)
    rails.update(-2)
    expect(rails.progress).toBe(0)
  })

  it('face outwards, with the rail heads lit from above', () => {
    const rails = new SwitchRails(set().root)
    const normal = rails.mesh.geometry.getAttribute('normal') as BufferAttribute
    const points = vertices(rails)
    // The flat tops: every vertex of their triangles sits at the head's height.
    for (let i = 0; i < points.length; i += 3) {
      if ([0, 1, 2].every((k) => Math.abs((points[i + k] as Vector3).y - 0.23) < 1e-6)) expect(normal.getY(i)).toBeGreaterThan(0.99)
    }
  })

  it('borrow the set’s rail material and slide the lever’s rod', () => {
    const { root, rail, rod } = set()
    const rails = new SwitchRails(root)
    expect(rails.mesh.material).toBe(rail)
    expect(rails.mesh.castShadow).toBe(true)
    expect(rod.position.toArray()).toEqual([1, 0, 2])

    rails.update(1)
    const moved = rod.position.clone().sub(new Vector3(1, 0, 2))
    expect(moved.length()).toBeCloseTo(0.16)
    // Along the rod, from the lever towards the switch machine by the junction.
    const [leverX, , leverZ] = LAYOUT.lever
    const machine = MAIN.pointAt(0).add(new Vector3(-0.5, 0, 1.32))
    expect(moved.normalize().dot(machine.sub(new Vector3(leverX, 0, leverZ)).normalize())).toBeCloseTo(1)
    rails.update(0)
    expect(rod.position.toArray()).toEqual([1, 0, 2])

    const dispose = vi.spyOn(rails.mesh.geometry, 'dispose')
    rails.dispose()
    expect(dispose).toHaveBeenCalled()
  })

  it('manage without the set’s rail material or rod', () => {
    const rails = new SwitchRails(new Group())
    expect((rails.mesh.material as MeshToonMaterial).name).toBe('rail')
    expect(() => rails.update(1)).not.toThrow()
  })
})

describe('findMaterial', () => {
  it('finds a material by name, inside multi-material meshes too', () => {
    const { root, rail } = set()
    expect(findMaterial(root, 'rail')).toBe(rail)
    expect(findMaterial(root, 'chrome')).toBeNull()
  })
})
