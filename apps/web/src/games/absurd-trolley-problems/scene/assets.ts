import {
  DataTexture,
  Group,
  InstancedMesh,
  Mesh,
  MeshToonMaterial,
  NearestFilter,
  PerspectiveCamera,
  RedFormat,
  Vector3,
  type BufferGeometry,
  type Material,
  type Matrix4,
  type MeshStandardMaterial,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import actorsUrl from '../assets/actors.glb?url'
import envUrl from '../assets/env.glb?url'

/**
 * Loads the Blender-made models (see apps/web/blender/absurd-trolley-problems)
 * and swaps their PBR materials for flat toon ones, which band the light into
 * a few steps like hand-shaded pixel art.
 */

const FAR_NAMES = new Set(['far_city', 'far_bridge'])
const NO_SHADOW = new Set(['ground', 'far_city', 'far_bridge'])

/** Light falls off in four bands. */
function toonRamp(levels: readonly number[]): DataTexture {
  const data = new Uint8Array(levels.map((level) => Math.round(level * 255)))
  const texture = new DataTexture(data, levels.length, 1, RedFormat)
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

export const TOON_RAMP = toonRamp([0.36, 0.58, 0.8, 1.0])

const toonCache = new Map<string, MeshToonMaterial>()

/** Blender's emission strengths, tamed for the bloom pass. */
const EMISSIVE_SCALE: Readonly<Record<string, number>> = {
  tram_window: 0.45,
  tram_cab: 0.5,
  tram_headlight: 0.55,
  phone_screen: 0.45,
  lamp_glass: 0.55,
  window_warm: 0.7,
  window_amber: 0.7,
  window_cool: 0.6,
  bridge_light: 0.6,
}

/** One toon material per source material name, shared by every model that uses it. */
export function toToon(source: Material): MeshToonMaterial {
  const cached = toonCache.get(source.name)
  if (cached) return cached
  const standard = source as MeshStandardMaterial
  const toon = new MeshToonMaterial({ name: source.name, gradientMap: TOON_RAMP })
  if (standard.color) toon.color.copy(standard.color)
  if (standard.emissive && (standard.emissive.r > 0 || standard.emissive.g > 0 || standard.emissive.b > 0)) {
    toon.emissive.copy(standard.emissive)
    toon.emissiveIntensity = (standard.emissiveIntensity ?? 1) * (EMISSIVE_SCALE[source.name] ?? 0.75)
  }
  toonCache.set(source.name, toon)
  return toon
}

function convertMaterials(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(toToon) : toToon(mesh.material)
  })
}

export interface EnvAssets {
  readonly near: readonly Object3D[]
  readonly far: readonly Object3D[]
  /** Source models for scattered grass, flowers and pebbles. */
  readonly scatter: ReadonlyMap<string, Object3D>
  readonly mainCamera: PerspectiveCamera
  readonly farCamera: PerspectiveCamera
  readonly lamp: Vector3
}

export interface SceneAssets {
  /** Asset roots by name: person, cat, tram, lever, prop_server, … */
  readonly templates: ReadonlyMap<string, Object3D>
  readonly env: EnvAssets
}

function cameraFrom(object: Object3D | undefined, fallback: Vector3): PerspectiveCamera {
  const camera = new PerspectiveCamera(20, 2.8, 0.5, 160)
  if (!object) {
    camera.position.copy(fallback)
    camera.lookAt(0, 0, 0)
    return camera
  }
  object.updateWorldMatrix(true, false)
  object.getWorldPosition(camera.position)
  object.getWorldQuaternion(camera.quaternion)
  const source = object as PerspectiveCamera
  if (source.isPerspectiveCamera) camera.fov = source.fov
  else {
    const child = object.children.find((c) => (c as PerspectiveCamera).isPerspectiveCamera) as PerspectiveCamera | undefined
    if (child) {
      camera.fov = child.fov
      child.getWorldQuaternion(camera.quaternion)
    }
  }
  camera.updateProjectionMatrix()
  return camera
}

export async function loadSceneAssets(): Promise<SceneAssets> {
  const loader = new GLTFLoader()
  const [actors, env] = await Promise.all([loader.loadAsync(actorsUrl), loader.loadAsync(envUrl)])
  convertMaterials(actors.scene)
  convertMaterials(env.scene)

  const templates = new Map<string, Object3D>()
  for (const child of [...actors.scene.children]) {
    child.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    templates.set(child.name, child)
  }

  const near: Object3D[] = []
  const far: Object3D[] = []
  const scatter = new Map<string, Object3D>()
  let mainCameraNode: Object3D | undefined
  let farCameraNode: Object3D | undefined
  const lamp = new Vector3(5.4, 3.05, -0.95)
  for (const child of [...env.scene.children]) {
    if (child.name === 'camera_main') mainCameraNode = child
    else if (child.name === 'camera_far') farCameraNode = child
    else if (child.name === 'lamp_light') lamp.copy(child.position)
    else if (child.name.startsWith('scatter_')) scatter.set(child.name, child)
    else if (FAR_NAMES.has(child.name)) far.push(child)
    else near.push(child)
    child.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      mesh.receiveShadow = !FAR_NAMES.has(child.name)
      mesh.castShadow = !NO_SHADOW.has(child.name)
    })
  }

  return {
    templates,
    env: {
      near,
      far,
      scatter,
      mainCamera: cameraFrom(mainCameraNode, new Vector3(-2.75, 8, 17)),
      farCamera: cameraFrom(farCameraNode, new Vector3(-2.75, 1.6, 16)),
      lamp,
    },
  }
}

/** The parts of a (possibly multi-material) model, each with its offset inside the model baked into its geometry. */
function modelParts(source: Object3D): { readonly geometry: BufferGeometry; readonly material: Mesh['material'] }[] {
  const parts: { readonly geometry: BufferGeometry; readonly material: Mesh['material'] }[] = []
  source.updateWorldMatrix(true, true)
  source.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const geometry = (mesh.geometry as BufferGeometry).clone()
    geometry.applyMatrix4(mesh.matrixWorld.clone().premultiply(source.matrixWorld.clone().invert()))
    parts.push({ geometry, material: mesh.material })
  })
  return parts
}

/** Instanced copies of a (possibly multi-material) model, one draw call per material. */
export function instanced(source: Object3D, matrices: readonly Matrix4[]): Group {
  const group = new Group()
  group.name = `${source.name}_instances`
  for (const { geometry, material } of modelParts(source)) {
    const copies = new InstancedMesh(geometry, material, matrices.length)
    matrices.forEach((matrix, index) => copies.setMatrixAt(index, matrix))
    copies.instanceMatrix.needsUpdate = true
    copies.castShadow = false
    copies.receiveShadow = true
    copies.computeBoundingSphere()
    group.add(copies)
  }
  return group
}

/**
 * The same copies baked into one plain mesh per material. Software WebGL works
 * through every instance of an instanced mesh much like a draw call of its
 * own; one bigger mesh costs it a fraction of that.
 */
export function merged(source: Object3D, matrices: readonly Matrix4[]): Group {
  const group = new Group()
  group.name = `${source.name}_merged`
  if (matrices.length === 0) return group
  for (const { geometry, material } of modelParts(source)) {
    // Copies of one geometry always merge.
    const copies = new Mesh(mergeGeometries(matrices.map((matrix) => geometry.clone().applyMatrix4(matrix)))!, material)
    copies.castShadow = false
    copies.receiveShadow = true
    group.add(copies)
  }
  return group
}

export function disposeToonMaterials(): void {
  for (const material of toonCache.values()) material.dispose()
  toonCache.clear()
}
