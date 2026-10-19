import { Box3, Color, Euler, Group, MathUtils, Mesh, Sprite, SpriteMaterial, Vector3, type Material, type MeshToonMaterial, type Object3D } from 'three'
import type { Actor, Lang, Marker, PersonActor, Pose } from '../content/types'
import { LAYOUT, RIG } from './layout'
import { markerSprite } from './sprites'

/**
 * Builds the people, animals and things on the tracks from the Blender
 * templates: one body with the right hair and accessories, recoloured and
 * posed. Recoloured materials are shared between actors that look alike.
 */

export type ActorState = 'idle' | 'panic' | 'cheer' | 'flying' | 'gone'

export interface ActorRig {
  readonly spec: Actor
  /** On the track; the body inside it bobs, panics and flies. */
  readonly root: Group
  readonly body: Object3D
  readonly armR: Object3D | null
  readonly armL: Object3D | null
  readonly restR: Euler
  readonly restL: Euler
  readonly tail: Object3D | null
  readonly marker: Sprite | null
  readonly markerBase: number
  /** Distance along the tram's route where it reaches this actor. */
  readonly routeDistance: number
  readonly track: 'A' | 'B'
  readonly height: number
  readonly baseScale: number
  readonly phase: number
  state: ActorState
  readonly velocity: Vector3
  readonly spin: Vector3
  timer: number
}

const PERSON_HEIGHT = 1.1
const HEIGHTS: Readonly<Record<string, number>> = {
  cat: 0.62,
  dog: 0.66,
  duck: 0.45,
  horse: 1.2,
  server: 1.36,
  cookie: 1.2,
  teapot: 0.94,
  phone: 1.3,
  coffeePlant: 1.15,
}

const HAND_ITEMS = new Set(['acc_phone', 'acc_mug', 'acc_boombox', 'acc_cane', 'acc_book', 'acc_moneybag'])

const materialCache = new Map<string, MeshToonMaterial>()

function recolored(material: MeshToonMaterial, color: string): MeshToonMaterial {
  const key = `${material.name}:${color}`
  const cached = materialCache.get(key)
  if (cached) return cached
  const copy = material.clone()
  copy.color.set(color)
  materialCache.set(key, copy)
  return copy
}

function recolor(root: Object3D, colors: Readonly<Record<string, string>>): void {
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const material = mesh.material as MeshToonMaterial
    const color = colors[material.name]
    if (color) mesh.material = recolored(material, color)
  })
}

function darker(hex: string, amount: number): string {
  const color = new Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  color.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), hsl.l * amount)
  return `#${color.getHexString()}`
}

/** Blender's XYZ Euler (Z-up) as a three.js rotation (Y-up). */
export function poseEuler(degrees: readonly [number, number, number]): Euler {
  const [x, y, z] = degrees.map((d) => MathUtils.degToRad(d)) as [number, number, number]
  return new Euler(x, z, -y, 'YZX')
}

export function poseFor(pose: Pose, side: 'R' | 'L'): Euler {
  const angles = RIG.poses[pose]?.[side] ?? RIG.poses.stand?.[side] ?? [0, 0, 0]
  return poseEuler(angles)
}

function buildPerson(template: Object3D, spec: PersonActor): Object3D {
  const body = template.clone(true)
  const keep = new Set(['person_body', 'arm_R', 'arm_L'])
  if (spec.hair !== 'bald') keep.add(`hair_${spec.hair}`)
  for (const accessory of spec.accessories) keep.add(`acc_${accessory}`)
  if (spec.alien) {
    keep.add('acc_alien_eyes')
    keep.add('acc_antenna')
  }
  for (const child of [...body.children]) if (!keep.has(child.name)) child.removeFromParent()
  for (const arm of body.children.filter((child) => child.name.startsWith('arm_'))) {
    for (const item of [...arm.children]) if (HAND_ITEMS.has(item.name) && !keep.has(item.name)) item.removeFromParent()
  }
  recolor(body, {
    skin: spec.skin,
    top: spec.top,
    bottom: spec.bottom,
    shoes: spec.shoes,
    hair: spec.hairColor,
    hat: spec.hatColor ?? '#e0475a',
  })
  return body
}

function markerFor(marker: Marker | undefined, lang: Lang): Sprite | null {
  if (!marker) return null
  const { texture, width, height } = markerSprite(marker, lang)
  const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, fog: false })
  const sprite = new Sprite(material)
  // About 30 art pixels across for a 14-pixel icon.
  const unit = 0.034
  sprite.scale.set(width * unit, height * unit, 1)
  sprite.center.set(0.5, 0)
  sprite.renderOrder = 10
  return sprite
}

export interface BuildOptions {
  readonly templates: ReadonlyMap<string, Object3D>
  readonly lang: Lang
  readonly track: 'A' | 'B'
  readonly routeDistance: number
  readonly position: Vector3
  /** Facing angle around Y (0 faces the camera). */
  readonly yaw: number
  readonly seed: number
}

export function buildActor(spec: Actor, options: BuildOptions): ActorRig {
  const { templates } = options
  let body: Object3D
  let height: number
  let scale: number
  let tail: Object3D | null = null

  if (spec.kind === 'person') {
    const template = templates.get('person')
    if (!template) throw new Error('Missing person template')
    body = buildPerson(template, spec)
    scale = LAYOUT.actorScale.person * (spec.scale ?? 1)
    height = PERSON_HEIGHT
  } else if (spec.kind === 'cat' || spec.kind === 'dog' || spec.kind === 'duck' || spec.kind === 'horse') {
    const template = templates.get(spec.kind)
    if (!template) throw new Error(`Missing ${spec.kind} template`)
    body = template.clone(true)
    recolor(body, { coat: spec.coat, accent: spec.accent, stripe: darker(spec.coat, 0.72) })
    tail = body.getObjectByName(`${spec.kind}_tail`) ?? null
    scale = LAYOUT.actorScale[spec.kind] * (spec.scale ?? 1)
    height = HEIGHTS[spec.kind] ?? 0.6
  } else {
    const template = templates.get(`prop_${spec.kind}`)
    if (!template) throw new Error(`Missing prop_${spec.kind} template`)
    body = template.clone(true)
    scale = LAYOUT.actorScale.prop * (spec.scale ?? 1)
    height = HEIGHTS[spec.kind] ?? 1
  }

  body.scale.setScalar(scale)
  body.rotation.y = options.yaw
  const root = new Group()
  root.name = `actor_${spec.kind}`
  root.position.copy(options.position)
  root.add(body)

  const armR = body.getObjectByName('arm_R') ?? null
  const armL = body.getObjectByName('arm_L') ?? null
  const pose = spec.kind === 'person' ? spec.pose : 'stand'
  const restR = poseFor(pose, 'R')
  const restL = poseFor(pose, 'L')
  armR?.rotation.copy(restR)
  armL?.rotation.copy(restL)

  // The scene keeps markers in its overlay layer and moves them with the actor.
  const marker = markerFor(spec.marker, options.lang)
  const markerBase = height * scale + (spec.kind === 'person' && spec.accessories.some((a) => a === 'tophat' || a === 'partyhat') ? 0.55 : 0.18)

  const random = Math.sin(options.seed * 12.9898) * 43758.5453
  return {
    spec,
    root,
    body,
    armR,
    armL,
    restR,
    restL,
    tail,
    marker,
    markerBase,
    routeDistance: options.routeDistance,
    track: options.track,
    height: height * scale,
    baseScale: scale,
    phase: (random - Math.floor(random)) * Math.PI * 2,
    state: 'idle',
    velocity: new Vector3(),
    spin: new Vector3(),
    timer: 0,
  }
}

/** World-space height of a model, for placing things on top of it. */
export function measureHeight(object: Object3D): number {
  return new Box3().setFromObject(object).max.y
}

export function disposeActorMaterials(): void {
  for (const material of materialCache.values()) material.dispose()
  materialCache.clear()
}

export function disposeMarker(rig: ActorRig): void {
  ;(rig.marker?.material as Material | undefined)?.dispose()
}
