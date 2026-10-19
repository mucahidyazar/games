import { BufferGeometry, CanvasTexture, Mesh, MeshToonMaterial, NearestFilter, PlaneGeometry, Vector3, type Matrix4 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { distanceToPath, distanceToTracks, paintGround, scatterSpots, seededRandom } from './ground'
import { LAYOUT, MAIN, Path } from './layout'

const at = (matrix: Matrix4): Vector3 => new Vector3().setFromMatrixPosition(matrix)

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = seededRandom(7)
    const b = seededRandom(7)
    const first = Array.from({ length: 5 }, a)
    expect(Array.from({ length: 5 }, b)).toEqual(first)
    expect(Array.from({ length: 5 }, seededRandom(8))).not.toEqual(first)
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('distances on the ground', () => {
  const path = new Path([new Vector3(0, 0, 0), new Vector3(4, 0, 0), new Vector3(4, 0, 0), new Vector3(4, 0, 3)])

  it('measures to the nearest point of a path, ignoring height', () => {
    expect(distanceToPath(2, 0, path)).toBe(0)
    expect(distanceToPath(2, 1.5, path)).toBe(1.5)
    expect(distanceToPath(-3, 4, path)).toBe(5)
    expect(distanceToPath(6, 3, path)).toBe(2)
  })

  it('finds the closest of the three tracks', () => {
    const onMain = MAIN.pointAt(6)
    expect(distanceToTracks(onMain.x, onMain.z)).toBeCloseTo(0, 5)
    expect(distanceToTracks(onMain.x, onMain.z + 40)).toBeGreaterThan(20)
  })
})

describe('scatterSpots', () => {
  const spots = scatterSpots()
  const [leverX, , leverZ] = LAYOUT.lever

  it('is the same every visit', () => {
    const again = scatterSpots()
    expect(again.tufts.map(at)).toEqual(spots.tufts.map(at))
    expect(scatterSpots(8).tufts.map(at)).not.toEqual(spots.tufts.map(at))
  })

  it('keeps grass and flowers off the tracks and away from the lever', () => {
    expect(spots.tufts.length).toBeGreaterThan(100)
    expect(spots.tufts.length).toBeLessThanOrEqual(340)
    for (const tuft of spots.tufts.map(at)) {
      expect(distanceToTracks(tuft.x, tuft.z)).toBeGreaterThanOrEqual(1.25)
      expect(Math.hypot(tuft.x - leverX, tuft.z - leverZ)).toBeGreaterThan(1.1)
      expect(tuft.y).toBe(0)
    }
    expect(spots.flowers).toHaveLength(3)
    // Flowers come in clumps of three.
    expect(spots.flowers.flat().length % 3).toBe(0)
  })

  it('lines the gravel beds with pebbles', () => {
    expect(spots.pebbles.length).toBeGreaterThan(50)
    for (const pebble of spots.pebbles.map(at)) {
      const distance = distanceToTracks(pebble.x, pebble.z)
      expect(distance).toBeGreaterThanOrEqual(0.95)
      expect(distance).toBeLessThanOrEqual(2.4)
    }
  })
})

/** A 2D context backed by real pixels: blue-grey on the left half (gravel), green on the right (grass). */
function pixelContext(canvas: HTMLCanvasElement) {
  const state: Record<PropertyKey, unknown> = {}
  const painted: { data?: Uint8ClampedArray } = {}
  const context = new Proxy(state, {
    get(target, property) {
      if (property in target) return target[property]
      if (property === 'getImageData') {
        return (_x: number, _y: number, width: number, height: number) => {
          const data = new Uint8ClampedArray(width * height * 4)
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const i = (y * width + x) * 4
              data.set(x < width / 2 ? [52, 68, 90, 255] : [44, 74, 64, 255], i)
            }
          }
          return { data, width, height }
        }
      }
      if (property === 'putImageData') return (image: { data: Uint8ClampedArray }) => (painted.data = image.data)
      return () => undefined
    },
    set(target, property, value) {
      target[property] = value
      return true
    },
  })
  return { context, painted, canvas }
}

describe('paintGround', () => {
  afterEach(() => vi.restoreAllMocks())

  it('maps the plane to a crisp painted texture of gravel and grass', () => {
    let painted: ReturnType<typeof pixelContext>['painted'] = {}
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      const fake = pixelContext(this)
      painted = fake.painted
      return fake.context
    } as unknown as HTMLCanvasElement['getContext'])
    const geometry = new PlaneGeometry(4, 2).rotateX(-Math.PI / 2)
    const source = new MeshToonMaterial({ color: '#ff0000' })
    const ground = new Mesh(geometry, source)

    paintGround(ground)

    const uv = (ground.geometry as BufferGeometry).getAttribute('uv')
    const corners = Array.from({ length: uv.count }, (_, i) => [uv.getX(i), uv.getY(i)])
    expect(corners).toEqual(expect.arrayContaining([[0, 0], [1, 1]]))
    const material = ground.material as MeshToonMaterial
    expect(material).not.toBe(source)
    expect(material.color.getHexString()).toBe('ffffff')
    expect(material.map).toBeInstanceOf(CanvasTexture)
    expect(material.map?.magFilter).toBe(NearestFilter)
    expect(material.map?.flipY).toBe(false)
    const image = material.map?.image as HTMLCanvasElement
    expect([image.width, image.height]).toEqual([56, 28])

    // Pixel noise: some of the gravel turns into stones, some of the grass into darker clumps.
    const data = painted.data as Uint8ClampedArray
    const colors = new Set<string>()
    for (let i = 0; i < data.length; i += 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`)
    expect(colors.has('70,86,110')).toBe(true)
    expect(colors.has('51,86,71')).toBe(true)
  })

  it('leaves the plane alone without a 2D canvas', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const ground = new Mesh(new PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new MeshToonMaterial())

    paintGround(ground)

    expect((ground.material as MeshToonMaterial).map).toBeInstanceOf(CanvasTexture)
  })
})
