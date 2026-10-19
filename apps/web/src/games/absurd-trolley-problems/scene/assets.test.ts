import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BoxGeometry, Color, Euler, Group, InstancedMesh, MathUtils, Matrix4, Mesh, MeshStandardMaterial, MeshToonMaterial, Vector3, type Material, type Object3D } from 'three'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { cat, CLOTH, COATS, INFLUENCERS, person, prop } from '../content/cast'
import type { Actor, Pose } from '../content/types'
import { buildActor, disposeActorMaterials, disposeMarker, measureHeight, poseEuler, poseFor, type BuildOptions } from './actors'
import { disposeToonMaterials, instanced, loadSceneAssets, merged, TOON_RAMP, toToon, type SceneAssets } from './assets'
import { LAYOUT, MAIN, RIG } from './layout'

/*
 * These load the real models exported from Blender (apps/web/blender), so a
 * re-export that drops a part the game relies on fails here, not in a browser.
 */

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')

let assets: SceneAssets

beforeAll(async () => {
  // jsdom has no fetch for relative URLs: serve the two model files from disk.
  vi.stubGlobal(
    'Request',
    class {
      readonly url: string
      constructor(url: string) {
        this.url = url
      }
    },
  )
  vi.stubGlobal('fetch', async (request: { url: string }) => new Response(await readFile(join(ASSETS, request.url.split('/').pop()?.split('?')[0] ?? ''))))
  assets = await loadSceneAssets()
}, 30_000)

afterAll(() => {
  vi.unstubAllGlobals()
  disposeActorMaterials()
  disposeToonMaterials()
})

function meshes(root: Object3D): Mesh[] {
  const found: Mesh[] = []
  root.traverse((object) => {
    if ((object as Mesh).isMesh) found.push(object as Mesh)
  })
  return found
}

const materialOf = (root: Object3D, name: string): MeshToonMaterial | undefined =>
  meshes(root)
    .map((mesh) => mesh.material as MeshToonMaterial)
    .find((material) => material.name === name)

const at = (options: Partial<BuildOptions> = {}): BuildOptions => ({
  templates: assets.templates,
  lang: 'en',
  track: 'A',
  routeDistance: 4,
  position: new Vector3(1, 0, 2),
  yaw: 0.2,
  seed: 3,
  ...options,
})

describe('the Blender models', () => {
  it('hold every template the dilemmas use', () => {
    const names = [...assets.templates.keys()]
    for (const name of ['person', 'cat', 'dog', 'duck', 'horse', 'tram', 'lever', 'prop_server', 'prop_cookie', 'prop_teapot', 'prop_phone', 'prop_coffeePlant', 'sofa', 'signal_stop', 'signal_walk', 'footbridge']) {
      expect(names).toContain(name)
    }
    const lever = assets.templates.get('lever') as Object3D
    expect(lever.getObjectByName('lever_arm')).toBeDefined()
    expect(assets.templates.get('tram')?.getObjectByName('tram_light_L')).toBeDefined()
  })

  it('swap PBR for shared toon materials that cast shadows', () => {
    const tram = assets.templates.get('tram') as Object3D
    for (const mesh of meshes(tram)) {
      expect(mesh.material).toBeInstanceOf(MeshToonMaterial)
      expect((mesh.material as MeshToonMaterial).gradientMap).toBe(TOON_RAMP)
      expect(mesh.castShadow).toBe(true)
    }
    // One material per name, wherever it is used.
    const skins = [...assets.templates.values()].flatMap(meshes).map((mesh) => mesh.material as Material).filter((material) => material.name === 'skin')
    expect(new Set(skins).size).toBe(1)
    // Glowing parts keep their glow, tamed for the bloom pass.
    const headlight = materialOf(tram, 'tram_headlight')
    expect(headlight?.emissiveIntensity).toBeGreaterThan(0)
  })

  it('split the set: near, far, scattered bits, the lamp and two cameras', () => {
    const { env } = assets
    expect(env.far.map((object) => object.name).sort()).toEqual(['far_bridge', 'far_city'])
    expect([...env.scatter.keys()].sort()).toEqual(['scatter_flower_orange', 'scatter_flower_pink', 'scatter_flower_yellow', 'scatter_pebble', 'scatter_tuft'])
    const near = env.near.map((object) => object.name)
    expect(near).toEqual(expect.arrayContaining(['ground', 'tracks', 'wall', 'trees', 'switch_rod']))
    // The switch's rails are the game's to bend: the set's own rails leave a gap past the junction.
    const tracks = env.near.find((object) => object.name === 'tracks') as Object3D
    const rails = meshes(tracks).find((mesh) => (mesh.material as Material).name === 'rail') as Mesh
    const position = rails.geometry.getAttribute('position')
    const junction = MAIN.pointAt(0)
    const ahead = MAIN.tangentAt(0)
    const inSwitch = Array.from({ length: position.count }, (_, i) => new Vector3(position.getX(i), 0, position.getZ(i)).sub(junction)).filter(
      (offset) => offset.dot(ahead) > 0.3 && offset.length() < LAYOUT.switchRails - 0.4,
    )
    expect(inSwitch).toEqual([])
    expect(near).not.toContain('camera_main')
    const ground = env.near.find((object) => object.name === 'ground') as Object3D
    expect(meshes(ground).every((mesh) => !mesh.castShadow && mesh.receiveShadow)).toBe(true)
    expect(meshes(env.far[0] as Object3D).every((mesh) => !mesh.receiveShadow)).toBe(true)
    expect(env.lamp.y).toBeGreaterThan(2)
    // Both cameras look down the set from in front of it.
    for (const camera of [env.mainCamera, env.farCamera]) {
      const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      expect(forward.z).toBeLessThan(0)
      expect(camera.fov).toBeGreaterThan(5)
    }
  })
})

describe('toToon', () => {
  it('carries colour and glow over, scaled per material', () => {
    const lamp = toToon(new MeshStandardMaterial({ name: 'lamp_glass_test', color: '#ff0000', emissive: '#ffffff', emissiveIntensity: 2 }))
    expect(lamp.color.getHexString()).toBe('ff0000')
    expect(lamp.emissiveIntensity).toBeCloseTo(1.5)
    const dull = toToon(new MeshStandardMaterial({ name: 'dull_test', color: '#00ff00' }))
    expect(dull.emissive.getHex()).toBe(0)
    expect(toToon(new MeshStandardMaterial({ name: 'dull_test', color: '#0000ff' }))).toBe(dull)
  })
})

describe('instanced', () => {
  it('copies a multi-part model in one draw call per part, offsets baked in', () => {
    const source = new Group()
    source.name = 'tuft'
    const blade = new Mesh(new BoxGeometry(1, 1, 1), new MeshToonMaterial())
    blade.position.set(0, 2, 0)
    source.add(blade, new Mesh(new BoxGeometry(1, 1, 1), new MeshToonMaterial()))
    const spots = [new Matrix4().makeTranslation(5, 0, 0), new Matrix4().makeTranslation(-5, 0, 0), new Matrix4()]

    const copies = instanced(source, spots)

    expect(copies.name).toBe('tuft_instances')
    expect(copies.children).toHaveLength(2)
    const first = copies.children[0] as InstancedMesh
    expect(first.count).toBe(3)
    first.geometry.computeBoundingBox()
    expect(first.geometry.boundingBox?.min.y).toBeCloseTo(1.5)
    const second = new Matrix4()
    first.getMatrixAt(1, second)
    expect(new Vector3().setFromMatrixPosition(second).x).toBe(-5)
  })
})

describe('merged', () => {
  it('bakes the same copies into one plain mesh per part', () => {
    const source = new Group()
    source.name = 'tuft'
    const blade = new Mesh(new BoxGeometry(1, 1, 1), new MeshToonMaterial())
    blade.position.set(0, 2, 0)
    const stone = new Mesh(new BoxGeometry(1, 1, 1), new MeshToonMaterial())
    source.add(blade, stone)
    const spots = [new Matrix4().makeTranslation(5, 0, 0), new Matrix4().makeTranslation(-5, 0, 0), new Matrix4()]

    const copies = merged(source, spots)

    expect(copies.name).toBe('tuft_merged')
    expect(copies.children).toHaveLength(2)
    const first = copies.children[0] as Mesh
    expect((first as Partial<InstancedMesh>).isInstancedMesh).toBeUndefined()
    expect(first.material).toBe(blade.material)
    expect(first.castShadow).toBe(false)
    expect(first.receiveShadow).toBe(true)
    expect(first.geometry.getAttribute('position').count).toBe(3 * blade.geometry.getAttribute('position').count)
    first.geometry.computeBoundingBox()
    expect(first.geometry.boundingBox?.min.x).toBeCloseTo(-5.5)
    expect(first.geometry.boundingBox?.max.x).toBeCloseTo(5.5)
    expect(first.geometry.boundingBox?.min.y).toBeCloseTo(1.5)
  })

  it('makes nothing of no copies', () => {
    expect(merged(new Mesh(new BoxGeometry(1, 1, 1), new MeshToonMaterial()), []).children).toEqual([])
  })
})

describe('buildActor', () => {
  it('dresses a person: their hair and things only, recoloured and posed', () => {
    const influencer = INFLUENCERS[0] as Actor
    const rig = buildActor(influencer, at())

    const kept = (name: string): boolean => rig.body.getObjectByName(name) !== undefined
    expect(['person_body', 'hair_short', 'acc_cap', 'acc_phone'].every(kept)).toBe(true)
    expect(['hair_long', 'acc_mug', 'acc_tophat', 'acc_alien_eyes'].some(kept)).toBe(false)
    expect(materialOf(rig.body, 'top')?.color.getHexString()).toBe(new Color(CLOTH.pink).getHexString())
    expect(rig.armR?.rotation.x).toBeCloseTo(poseFor('phone', 'R').x)
    expect(rig.root.position.toArray()).toEqual([1, 0, 2])
    expect(rig.body.rotation.y).toBeCloseTo(0.2)
    expect(rig.baseScale).toBeCloseTo(LAYOUT.actorScale.person)
    expect(rig.marker).not.toBeNull()
    expect(rig.markerBase).toBeCloseTo(rig.height + 0.18)
    expect(rig.state).toBe('idle')
    expect(rig.phase).toBeGreaterThanOrEqual(0)
  })

  it('makes room above hats and dresses aliens', () => {
    const tall = buildActor(person({ top: CLOTH.black, accessories: ['tophat'] }), at())
    expect(tall.markerBase).toBeCloseTo(tall.height + 0.55)
    expect(tall.marker).toBeNull()
    const bald = buildActor(person({ top: CLOTH.white, hair: 'bald', alien: true, scale: 1.2 }), at())
    expect(bald.body.children.some((child) => child.name.startsWith('hair_'))).toBe(false)
    expect(bald.body.getObjectByName('acc_antenna')).toBeDefined()
    expect(bald.baseScale).toBeCloseTo(LAYOUT.actorScale.person * 1.2)
  })

  it('shares recoloured materials between look-alikes', () => {
    const a = buildActor(person({ top: CLOTH.teal }), at())
    const b = buildActor(person({ top: CLOTH.teal }), at({ seed: 9 }))
    expect(materialOf(a.body, 'top')).toBe(materialOf(b.body, 'top'))
    expect(a.phase).not.toBe(b.phase)
  })

  it('builds animals with a wagging tail and a darker stripe', () => {
    const kitty = buildActor(cat(COATS.orange, '#ffffff', 'heart'), at({ track: 'B' }))
    expect(kitty.tail?.name).toBe('cat_tail')
    expect(kitty.track).toBe('B')
    expect(materialOf(kitty.body, 'coat')?.color.getHexString()).toBe(new Color(COATS.orange).getHexString())
    const stripe = materialOf(kitty.body, 'stripe')?.color
    expect(stripe && stripe.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(new Color(COATS.orange).getHSL({ h: 0, s: 0, l: 0 }).l)
    expect(kitty.armR).toBeNull()
    expect(kitty.marker).not.toBeNull()
  })

  it('places props at their own size', () => {
    const server = buildActor(prop('server', undefined, 1.1), at())
    expect(server.height).toBeCloseTo(1.36 * LAYOUT.actorScale.prop * 1.1)
    expect(server.root.name).toBe('actor_server')
  })

  it('refuses specs whose model is missing', () => {
    const empty = at({ templates: new Map() })
    expect(() => buildActor(person({ top: CLOTH.red }), empty)).toThrow('Missing person template')
    expect(() => buildActor(cat('#000000'), empty)).toThrow('Missing cat template')
    expect(() => buildActor(prop('teapot'), empty)).toThrow('Missing prop_teapot template')
  })

  it('lets go of marker and shared materials', () => {
    const rig = buildActor(cat(COATS.black, '#ffffff', 'zzz'), at())
    const material = rig.marker?.material as Material
    const dispose = vi.spyOn(material, 'dispose')
    disposeMarker(rig)
    expect(dispose).toHaveBeenCalled()

    const before = materialOf(buildActor(person({ top: CLOTH.orange }), at()).body, 'top')
    disposeActorMaterials()
    expect(materialOf(buildActor(person({ top: CLOTH.orange }), at()).body, 'top')).not.toBe(before)
  })
})

describe('poses', () => {
  it('turn Blender’s Z-up angles into three.js rotations', () => {
    const euler = poseEuler([90, 30, 45])
    expect(euler).toBeInstanceOf(Euler)
    expect(euler.order).toBe('YZX')
    expect(euler.x).toBeCloseTo(MathUtils.degToRad(90))
    expect(euler.y).toBeCloseTo(MathUtils.degToRad(45))
    expect(euler.z).toBeCloseTo(MathUtils.degToRad(-30))
  })

  it('fall back to standing for an unknown pose', () => {
    expect(poseFor('nope' as Pose, 'L')).toEqual(poseEuler(RIG.poses.stand?.L ?? [0, 0, 0]))
  })

  it('measure how tall a model stands', () => {
    const box = new Mesh(new BoxGeometry(1, 2, 1))
    box.position.y = 1
    box.updateMatrixWorld()
    expect(measureHeight(box)).toBeCloseTo(2)
  })
})
