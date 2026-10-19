import { BufferAttribute, CanvasTexture, Matrix4, NearestFilter, Quaternion, SRGBColorSpace, Vector3, type BufferGeometry, type Mesh, type MeshToonMaterial } from 'three'
import { BRANCH, INCOMING, LAYOUT, MAIN, type Path } from './layout'

/**
 * Paints the ground like the key frame: blue-grey gravel around the tracks,
 * teal grass with darker clumps, all speckled pixel by pixel; and picks spots
 * for the grass tufts, flowers and pebbles the scene scatters on top.
 */

const PIXELS_PER_METRE = 14

/** A small, seedable random generator so the set looks the same every visit. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Bounds {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T
}

/** Shortest distance from a point to a path (on the ground plane). */
export function distanceToPath(x: number, z: number, path: Path): number {
  let best = Infinity
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1] as Vector3
    const b = path.points[i] as Vector3
    const dx = b.x - a.x
    const dz = b.z - a.z
    const lengthSq = dx * dx + dz * dz
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq))
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)))
  }
  return best
}

export function distanceToTracks(x: number, z: number): number {
  return Math.min(distanceToPath(x, z, INCOMING), distanceToPath(x, z, MAIN), distanceToPath(x, z, BRANCH))
}

function paint(bounds: Bounds): HTMLCanvasElement {
  const width = Math.round((bounds.maxX - bounds.minX) * PIXELS_PER_METRE)
  const height = Math.round((bounds.maxZ - bounds.minZ) * PIXELS_PER_METRE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const random = seededRandom(1967)
  const px = (x: number): number => (x - bounds.minX) * PIXELS_PER_METRE
  const pz = (z: number): number => (z - bounds.minZ) * PIXELS_PER_METRE

  // Grass.
  ctx.fillStyle = '#2c4a40'
  ctx.fillRect(0, 0, width, height)
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = pick(random, ['#335647', '#24403a', '#2f5244', '#3a5e4a', '#203834'])
    const r = 2 + random() * 9
    ctx.beginPath()
    ctx.ellipse(random() * width, random() * height, r * 1.6, r, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Gravel beds under the tracks and a wider yard around the switch and the lever.
  const bed = (path: Path, metres: number, color: string): void => {
    ctx.strokeStyle = color
    ctx.lineWidth = metres * PIXELS_PER_METRE
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    path.points.forEach((point, index) => (index === 0 ? ctx.moveTo(px(point.x), pz(point.z)) : ctx.lineTo(px(point.x), pz(point.z))))
    ctx.stroke()
  }
  for (const path of [INCOMING, MAIN, BRANCH]) bed(path, 3.6, '#34445a')
  const [leverX, , leverZ] = LAYOUT.lever
  ctx.fillStyle = '#34445a'
  ctx.beginPath()
  ctx.ellipse(px(leverX + 1.6), pz(leverZ - 1.1), 4.2 * PIXELS_PER_METRE, 2.3 * PIXELS_PER_METRE, -0.35, 0, Math.PI * 2)
  ctx.fill()
  for (const path of [INCOMING, MAIN, BRANCH]) bed(path, 2.5, '#3c4b62')

  // Ragged edges: grass creeping into the gravel, gravel spilling into the grass.
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data
  const gravel = ['#46566e', '#3c4b62', '#33415a', '#52627a', '#2e3a50']
  const grass = ['#2c4a40', '#335647', '#24403a', '#3a5e4a']
  const hex = (color: string): readonly [number, number, number] => [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)]
  const gravelRgb = gravel.map(hex)
  const grassRgb = grass.map(hex)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const isGravel = (data[i + 2] as number) > (data[i + 1] as number) + 4
      const roll = random()
      let rgb: readonly [number, number, number] | null = null
      if (isGravel) rgb = roll < 0.55 ? pick(random, gravelRgb) : roll < 0.6 ? pick(random, grassRgb) : null
      else if (roll < 0.22) rgb = pick(random, grassRgb)
      if (rgb) {
        data[i] = rgb[0]
        data[i + 1] = rgb[1]
        data[i + 2] = rgb[2]
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

/** Gives the ground plane texture coordinates and its painted texture. */
export function paintGround(ground: Mesh): void {
  const geometry = ground.geometry as BufferGeometry
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return
  const bounds: Bounds = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z }
  const position = geometry.getAttribute('position')
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) - bounds.minX) / (bounds.maxX - bounds.minX)
    uv[i * 2 + 1] = (position.getZ(i) - bounds.minZ) / (bounds.maxZ - bounds.minZ)
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  const texture = new CanvasTexture(paint(bounds))
  texture.flipY = false
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  const material = (ground.material as MeshToonMaterial).clone()
  material.color.set('#ffffff')
  material.map = texture
  ground.material = material
}

export interface ScatterSpots {
  readonly tufts: readonly Matrix4[]
  readonly flowers: readonly (readonly Matrix4[])[]
  readonly pebbles: readonly Matrix4[]
}

const UP = new Vector3(0, 1, 0)

function spot(x: number, z: number, scale: number, angle: number): Matrix4 {
  return new Matrix4().compose(new Vector3(x, 0, z), new Quaternion().setFromAxisAngle(UP, angle), new Vector3(scale, scale, scale))
}

/** Where grass, flowers and pebbles go: on the visible ground, off the tracks, clear of the lever. */
export function scatterSpots(seed = 7): ScatterSpots {
  const random = seededRandom(seed)
  const [leverX, , leverZ] = LAYOUT.lever
  const inView = (x: number, z: number): boolean => x > -13.5 && x < 9.5 && z > -1.05 && z < 8.5
  const clearOfLever = (x: number, z: number): boolean => Math.hypot(x - leverX, z - leverZ) > 1.1

  const tufts: Matrix4[] = []
  for (let tries = 0; tufts.length < 340 && tries < 6000; tries++) {
    const x = -13.5 + random() * 23
    const z = -1.05 + random() * 9.5
    if (!inView(x, z) || !clearOfLever(x, z) || distanceToTracks(x, z) < 1.25) continue
    tufts.push(spot(x, z, 0.9 + random() * 1.1, random() * Math.PI * 2))
  }

  const flowers: Matrix4[][] = [[], [], []]
  for (let tries = 0; flowers.flat().length < 80 && tries < 4000; tries++) {
    const x = -13 + random() * 22
    const z = -0.9 + random() * 9
    if (!inView(x, z) || !clearOfLever(x, z) || distanceToTracks(x, z) < 1.6) continue
    // Flowers grow in little clumps.
    const clump = flowers[Math.floor(random() * 3)] as Matrix4[]
    for (let k = 0; k < 3; k++) clump.push(spot(x + (random() - 0.5) * 0.6, z + (random() - 0.5) * 0.4, 0.9 + random() * 0.6, random() * Math.PI * 2))
  }

  const pebbles: Matrix4[] = []
  for (let tries = 0; pebbles.length < 150 && tries < 5000; tries++) {
    const x = -13 + random() * 22
    const z = -1.0 + random() * 9
    const d = distanceToTracks(x, z)
    if (!inView(x, z) || d < 0.95 || d > 2.4) continue
    pebbles.push(spot(x, z, 0.6 + random() * 0.9, random() * Math.PI * 2))
  }
  return { tufts, flowers, pebbles }
}
