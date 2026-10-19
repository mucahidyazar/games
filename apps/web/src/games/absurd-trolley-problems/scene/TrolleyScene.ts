import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  SpotLight,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type MeshToonMaterial,
} from 'three'
import type { Actor, AnyDilemma, Lang, TrolleyChoice } from '../content/types'
import { hitTracks } from '../state/run'
import { buildActor, disposeActorMaterials, disposeMarker, type ActorRig } from './actors'
import { disposeToonMaterials, instanced, loadSceneAssets, merged, type SceneAssets } from './assets'
import { Fireflies, Particles } from './effects'
import { paintGround, scatterSpots, seededRandom } from './ground'
import { BRANCH, LAYOUT, MAIN, RAIL_TOP, ROUTES, STAND_HEIGHT, SWITCH_AT, slotsA, slotsB, type Path } from './layout'
import { leverAngle, moveDrag, releaseChoice, startDrag, type LeverDrag, type ScreenPoint } from './leverControl'
import { PixelPipeline } from './pixelPipeline'
import { renderQuality, tooSoon, type RenderQuality } from './quality'
import { disposeMarkerSprites, leverLabel, markerSprite } from './sprites'
import { SwitchRails } from './switchRails'

export type SceneEvent =
  | 'arrive'
  | 'bell'
  | 'lever'
  | 'push'
  | 'depart'
  | 'impact'
  | 'brake'
  | 'drift'
  | 'stop'
  | 'cheer'
  // Only Philippa Foot's cases, drawn in motion.
  | 'gavel'
  | 'roar'
  | 'boom'
  | 'heal'
  | 'creak'
  | 'zap'
  | 'splash'

export interface SceneEventDetail {
  /** What was hit: a person, a cat, a prop… */
  readonly kind?: Actor['kind']
  /** How a life was lost, when it was not a tram: it changes the sound, not the count. */
  readonly how?: 'flatline' | 'zap' | 'drown' | 'blast'
}

export interface TrolleySceneOptions {
  readonly canvas: HTMLCanvasElement
  readonly lang: Lang
  readonly reducedMotion: boolean
  readonly onEvent?: (event: SceneEvent, detail?: SceneEventDetail) => void
  /** The player let go of the lever in the scene: what they decided. */
  readonly onLever?: (choice: TrolleyChoice) => void
}

const TRAM_HALF = 2.6 * LAYOUT.tramScale
const BOGIE = 1.55 * LAYOUT.tramScale
const TRAM_Y = RAIL_TOP - 0.02 * LAYOUT.tramScale
const CAMERA_DISTANCE = 17.4
const OVERLAY_LAYER = 1
const LEVER_REST = MathUtils.degToRad(30)
/** The lever model: the arm turns about a pivot this high, with the knob this far up the stick. */
const ARM_PIVOT = 0.25
const KNOB_REACH = 0.76
/** The words beside the lever sit this many art pixels off the knob, each of their pixels this many art pixels big. */
const LABEL_GAP = 7
const LABEL_PIXEL = 2
/** The skyline is seen through a longer lens than the set. */
const BACK_FOV_RATIO = 0.72
/** The backdrop is aimed so the far bridge's deck sits just above the wall. */
const WALL_TOP = new Vector3(1.5, 2.1, -1.5)
const BRIDGE_DECK = { y: 3.65, z: -17 }
const FOOTBRIDGE_AT = 1.7
const FOOTBRIDGE_SCALE = 1.18
const FOOTBRIDGE_DECK = 2.84 * FOOTBRIDGE_SCALE

type RunPhase = 'prepare' | 'roll' | 'after'

interface Run {
  readonly choice: TrolleyChoice
  readonly route: Path
  readonly drift: boolean
  readonly push: boolean
  phase: RunPhase
  time: number
  speed: number
  front: number
  driftAngle: number
  /** The footbridge's victim stops the tram here. */
  stopAt: number | null
  braking: boolean
  readonly resolve: () => void
}

interface Arrival {
  time: number
  readonly from: number
  readonly duration: number
}

function skyTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 128)
    gradient.addColorStop(0, '#060f24')
    gradient.addColorStop(0.55, '#0c1a38')
    gradient.addColorStop(1, '#1a2c52')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 2, 128)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function stars(): Points {
  const random = seededRandom(5)
  const positions = new Float32Array(160 * 3)
  for (let i = 0; i < 160; i++) {
    positions[i * 3] = -60 + random() * 120
    positions[i * 3 + 1] = 8 + random() * 30
    positions[i * 3 + 2] = -70 - random() * 10
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  const material = new PointsMaterial({ color: new Color('#dfe8ff').multiplyScalar(1.6), size: 1, sizeAttenuation: false, toneMapped: false })
  return new Points(geometry, material)
}

/**
 * The 3D stage: loads the Blender set once, then swaps the actors for each
 * dilemma and plays the tram's run when the player decides.
 */
export class TrolleyScene {
  private readonly renderer: WebGLRenderer
  /** All of the look on a GPU; a lighter scene when WebGL runs on the CPU. */
  private readonly quality: RenderQuality
  private readonly pipeline: PixelPipeline
  private readonly main = new Scene()
  private readonly back = new Scene()
  private readonly overlay = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly backCamera: PerspectiveCamera
  private readonly baseCamera: { readonly position: Vector3; readonly target: Vector3; readonly fov: number }
  private readonly baseBack: { readonly position: Vector3; readonly target: Vector3; readonly fov: number }
  private readonly assets: SceneAssets
  private readonly tram: Object3D
  private readonly lever: Object3D
  private readonly leverArm: Object3D | null
  /** The rails past the junction, which bend with the lever. */
  private readonly switchRails: SwitchRails
  private readonly extras = new Group()
  private readonly particles = new Particles()
  private readonly fireflies: Fireflies
  private readonly markers = new Group()
  private readonly glowMaterials: { readonly material: MeshToonMaterial; readonly base: number; readonly kind: 'led' | 'beacon' | 'window' }[] = []
  private readonly onEvent: TrolleySceneOptions['onEvent']
  private readonly onLever: TrolleySceneOptions['onLever']
  /** An invisible box round the lever's whole swing: what a click or a drag grabs. */
  private readonly leverHit: Mesh
  private readonly leverLabels: Readonly<Record<TrolleyChoice, Sprite>>
  private readonly raycaster = new Raycaster()
  private interactive = false
  private leverHover = false
  private drag: { readonly pointerId: number; readonly state: LeverDrag } | null = null
  private actors: ActorRig[] = []
  private dilemma: AnyDilemma | null = null
  private lang: Lang
  private reducedMotion: boolean
  private run: Run | null = null
  private arrival: Arrival | null = null
  private leverTarget = LEVER_REST
  private leverAngle = LEVER_REST
  private tramFront = LAYOUT.tramStart
  private tramVisible = true
  private aspect = 2.8
  private cameraLift = 0
  private shake = 0
  private readonly pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  private time = 0
  private lastFrame = 0
  private visible = true
  private disposed = false
  private nextBell = 4

  static async create(options: TrolleySceneOptions): Promise<TrolleyScene> {
    const renderer = new WebGLRenderer({ canvas: options.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
    try {
      const assets = await loadSceneAssets()
      return new TrolleyScene(renderer, assets, options)
    } catch (error) {
      renderer.dispose()
      throw error
    }
  }

  private constructor(renderer: WebGLRenderer, assets: SceneAssets, options: TrolleySceneOptions) {
    this.renderer = renderer
    this.assets = assets
    this.lang = options.lang
    this.reducedMotion = options.reducedMotion
    this.onEvent = options.onEvent
    this.onLever = options.onLever
    this.quality = renderQuality(renderer.getContext())
    renderer.shadowMap.enabled = this.quality.shadowMapSize > 0
    renderer.shadowMap.type = PCFShadowMap
    this.pipeline = new PixelPipeline(renderer, this.quality)

    // Cameras: the key frame's view, and a lower one for the skyline behind the wall.
    this.camera = assets.env.mainCamera
    this.backCamera = assets.env.farCamera
    const forward = (camera: PerspectiveCamera): Vector3 => new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    this.baseCamera = { position: this.camera.position.clone(), target: this.camera.position.clone().addScaledVector(forward(this.camera), CAMERA_DISTANCE), fov: this.camera.fov }
    this.baseBack = { position: this.backCamera.position.clone(), target: this.backCamera.position.clone().addScaledVector(forward(this.backCamera), 30), fov: this.backCamera.fov }
    this.camera.near = 0.5
    this.camera.far = 90

    this.buildBackdrop()
    this.buildSet()
    this.switchRails = new SwitchRails(this.main)
    this.main.add(this.switchRails.mesh)

    const tramTemplate = assets.templates.get('tram')
    const leverTemplate = assets.templates.get('lever')
    if (!tramTemplate || !leverTemplate) throw new Error('The tram or the lever is missing from the assets')
    this.tram = tramTemplate.clone(true)
    this.tram.scale.setScalar(LAYOUT.tramScale)
    this.addTramLights()
    this.main.add(this.tram)

    this.lever = leverTemplate.clone(true)
    this.lever.scale.setScalar(LAYOUT.leverScale)
    const [lx, , lz] = LAYOUT.lever
    this.lever.position.set(lx, 0, lz)
    // The rod runs from the lever towards the switch machine by the junction.
    const junction = ROUTES.A.pointAt(SWITCH_AT)
    const towards = new Vector3(junction.x - 0.4 - lx, 0, junction.z + 1.32 - lz)
    this.lever.rotation.y = Math.atan2(-towards.z, towards.x)
    this.leverArm = this.lever.getObjectByName('lever_arm') ?? null
    this.leverHit = new Mesh(new BoxGeometry(1.3, 1.3, 0.8), new MeshBasicMaterial())
    this.leverHit.position.set(0, 0.62, 0)
    this.leverHit.visible = false
    this.lever.add(this.leverHit)
    this.leverLabels = { pull: this.makeLeverLabel('pull'), stay: this.makeLeverLabel('stay') }
    this.main.add(this.lever)
    this.main.add(this.extras)

    // Markers and particles are depth-tested against the set but kept out of the
    // outline pass (layer 1), so the tram hides them without drawing edges round them.
    this.camera.layers.enable(OVERLAY_LAYER)
    this.main.add(this.markers)
    this.particles.mesh.layers.set(OVERLAY_LAYER)
    this.main.add(this.particles.mesh)
    const random = seededRandom(3)
    const fireflySpots = Array.from({ length: 16 }, () => new Vector3(-12 + random() * 20, 0.4 + random() * 1.2, 0.5 + random() * 7))
    this.fireflies = new Fireflies(fireflySpots)
    this.fireflies.mesh.layers.set(OVERLAY_LAYER)
    this.main.add(this.fireflies.mesh)

    this.placeTram(LAYOUT.tramStart, ROUTES.A)
    options.canvas.addEventListener('pointermove', this.onPointerMove)
    options.canvas.addEventListener('pointerleave', this.onPointerLeave)
    options.canvas.addEventListener('pointerdown', this.onPointerDown)
    options.canvas.addEventListener('pointerup', this.onPointerUp)
    options.canvas.addEventListener('pointercancel', this.onPointerCancel)
    renderer.setAnimationLoop(this.frame)
  }

  /** A word beside the lever, kept in the overlay layer like the markers. */
  private makeLeverLabel(choice: TrolleyChoice): Sprite {
    const label = new Sprite(new SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false }))
    // The pull label reads rightwards from beside the pulled knob, the other leftwards from the resting one.
    label.center.set(choice === 'pull' ? 0 : 1, 0.5)
    label.layers.set(OVERLAY_LAYER)
    label.renderOrder = 11
    label.visible = false
    this.main.add(label)
    this.paintLeverLabel(label, choice)
    return label
  }

  private paintLeverLabel(label: Sprite, choice: TrolleyChoice): void {
    label.material.map = leverLabel(choice, this.lang).texture
    label.material.needsUpdate = true
  }

  // ------------------------------------------------------------------ set

  private buildBackdrop(): void {
    this.back.background = skyTexture()
    this.back.fog = new FogExp2('#13254a', 0.011)
    this.back.add(stars())
    this.back.add(new HemisphereLight('#5d72b5', '#141d33', 1.4))
    for (const object of this.assets.env.far) this.back.add(object)
    this.collectGlow(this.back)
  }

  private buildSet(): void {
    const { env } = this.assets
    this.main.fog = new FogExp2('#0e1c38', 0.014)
    for (const object of env.near) {
      if (object.name === 'ground') {
        object.traverse((child) => {
          if ((child as Mesh).isMesh) paintGround(child as Mesh)
        })
      }
      this.main.add(object)
    }

    const spots = scatterSpots()
    const copies = this.quality.instancing ? instanced : merged
    const tuft = env.scatter.get('scatter_tuft')
    const pebble = env.scatter.get('scatter_pebble')
    if (tuft) this.main.add(copies(tuft, spots.tufts))
    if (pebble) this.main.add(copies(pebble, spots.pebbles))
    ;['scatter_flower_yellow', 'scatter_flower_orange', 'scatter_flower_pink'].forEach((name, index) => {
      const flower = env.scatter.get(name)
      const matrices = spots.flowers[index]
      if (flower && matrices && matrices.length > 0) this.main.add(copies(flower, matrices))
    })

    const hemi = new HemisphereLight('#7086c9', '#1b2a30', 1.45)
    this.main.add(hemi)
    const moon = new DirectionalLight('#b3c4ff', 2.1)
    moon.position.set(-9, 15, 11)
    moon.target.position.set(-1, 0, 1)
    moon.castShadow = this.quality.shadowMapSize > 0
    moon.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize)
    moon.shadow.camera.left = -16
    moon.shadow.camera.right = 14
    moon.shadow.camera.top = 12
    moon.shadow.camera.bottom = -10
    moon.shadow.camera.near = 1
    moon.shadow.camera.far = 60
    moon.shadow.bias = -0.0006
    moon.shadow.normalBias = 0.03
    this.main.add(moon, moon.target)

    const lamp = new PointLight('#ffc670', 6, 9, 1.4)
    lamp.position.copy(env.lamp)
    this.main.add(lamp)
    this.collectGlow(this.main)
  }

  private collectGlow(scene: Scene): void {
    const seen = new Set<Material>()
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const material = mesh.material as MeshToonMaterial
      if (seen.has(material) || !material.emissive) return
      seen.add(material)
      const kind = material.name.startsWith('led_') ? 'led' : material.name === 'beacon' ? 'beacon' : material.name.startsWith('window_') ? 'window' : null
      if (kind) this.glowMaterials.push({ material, base: material.emissiveIntensity, kind })
    })
  }

  private addTramLights(): void {
    const interior = new PointLight('#ffcf7a', 2.2, 5, 1.5)
    interior.position.set(0, 1.5, 0)
    this.tram.add(interior)
    for (const name of ['tram_light_L', 'tram_light_R']) {
      const anchor = this.tram.getObjectByName(name)
      if (!anchor) continue
      const spot = new SpotLight('#fff1c8', 11, 15, 0.42, 0.65, 1.3)
      const target = new Object3D()
      target.position.set(0, -0.6, 8)
      anchor.add(spot, target)
      spot.target = target
    }
  }

  // -------------------------------------------------------------- actors

  /** Shows a dilemma. `trackA` replaces the dilemma's own (the finale's survivors). */
  setDilemma(dilemma: AnyDilemma, trackA: readonly Actor[], settled: TrolleyChoice | null = null): void {
    this.clearActors()
    this.finishRun()
    this.drag = null
    this.setCursor('')
    this.dilemma = dilemma
    this.particles.clear()
    const special = dilemma.special
    const offsetA = special === 'footbridge' ? 0.9 : 0
    const slotA = slotsA(trackA.length).map((d) => d + offsetA)
    const slotB = slotsB(dilemma.trackB.length)
    let seed = 1
    trackA.forEach((spec, index) => {
      const distance = slotA[index] as number
      this.addActor(spec, 'A', SWITCH_AT + distance, MAIN.pointAt(distance), seed++)
    })
    dilemma.trackB.forEach((spec, index) => {
      if (special === 'footbridge') {
        const at = MAIN.pointAt(FOOTBRIDGE_AT)
        at.y = FOOTBRIDGE_DECK - STAND_HEIGHT
        this.addActor(spec, 'B', SWITCH_AT + FOOTBRIDGE_AT, at, seed++)
        return
      }
      const distance = slotB[index] as number
      this.addActor(spec, 'B', SWITCH_AT + distance, BRANCH.pointAt(distance), seed++)
    })
    this.buildExtras(dilemma)
    this.lever.visible = special !== 'footbridge'
    this.cameraLift = special === 'footbridge' ? 1.9 : 0

    this.leverTarget = LEVER_REST
    this.leverAngle = LEVER_REST
    if (settled) {
      // Coming back to a decided dilemma: the tram has gone and so have its victims.
      const hit = hitTracks(dilemma, settled)
      for (const actor of this.actors) {
        if (hit.includes(actor.track) && !(special === 'footbridge' && settled === 'stay' && actor.track === 'B')) {
          actor.state = 'gone'
          actor.root.visible = false
          if (actor.marker) actor.marker.visible = false
        }
      }
      if (settled === 'pull' && special !== 'footbridge') this.leverTarget = this.leverAngle = -LEVER_REST
      this.tramVisible = false
      this.tram.visible = false
      this.arrival = null
      return
    }
    this.tramVisible = true
    this.tram.visible = true
    if (this.reducedMotion) {
      this.arrival = null
      this.placeTram(LAYOUT.tramStart, ROUTES.A)
    } else {
      this.arrival = { time: 0, from: LAYOUT.tramStart - 9, duration: 1.6 }
      this.placeTram(LAYOUT.tramStart - 9, ROUTES.A)
      this.onEvent?.('arrive')
    }
    this.nextBell = this.time + 6 + Math.random() * 4
  }

  private addActor(spec: Actor, track: 'A' | 'B', routeDistance: number, position: Vector3, seed: number): void {
    position.y = Math.max(position.y, 0) + STAND_HEIGHT
    const yaw = spec.kind === 'horse' ? -Math.PI / 2 + 0.25 : spec.kind === 'duck' ? -0.55 : (Math.sin(seed * 7.1) * 0.12)
    const rig = buildActor(spec, { templates: this.assets.templates, lang: this.lang, track, routeDistance, position, yaw, seed })
    this.main.add(rig.root)
    if (rig.marker) {
      rig.marker.position.set(position.x, position.y + rig.markerBase, position.z)
      rig.marker.layers.set(OVERLAY_LAYER)
      this.markers.add(rig.marker)
    }
    this.actors.push(rig)
  }

  private buildExtras(dilemma: AnyDilemma): void {
    const { templates } = this.assets
    const add = (name: string, position: Vector3, yaw: number, scale = 1): void => {
      const template = templates.get(name)
      if (!template) return
      const object = template.clone(true)
      object.position.copy(position)
      object.rotation.y = yaw
      object.scale.setScalar(scale)
      this.extras.add(object)
    }
    if (dilemma.special === 'footbridge') {
      const at = MAIN.pointAt(FOOTBRIDGE_AT)
      const along = MAIN.tangentAt(FOOTBRIDGE_AT)
      add('footbridge', at, Math.atan2(along.x, along.z), FOOTBRIDGE_SCALE)
    } else if (dilemma.special === 'couch') {
      const [lx, , lz] = LAYOUT.lever
      add('sofa', new Vector3(lx - 2.1, 0, lz + 0.7), 0.55, 1.15)
    } else if (dilemma.special === 'crosswalk') {
      const [first] = slotsA(1)
      const a = MAIN.pointAt(first ?? 5)
      add('signal_walk', new Vector3(a.x + 1.1, 0, a.z - 0.95), 0, 1.1)
      const b = BRANCH.pointAt((slotsB(5)[0] ?? 4.4) - 0.6)
      add('signal_stop', new Vector3(b.x - 0.6, 0, b.z + 1.2), 0, 1.1)
    }
  }

  private clearActors(): void {
    for (const actor of this.actors) {
      actor.root.removeFromParent()
      if (actor.marker) {
        actor.marker.removeFromParent()
        disposeMarker(actor)
      }
    }
    this.actors = []
    for (const child of [...this.extras.children]) child.removeFromParent()
  }

  setLang(lang: Lang): void {
    if (lang === this.lang) return
    this.lang = lang
    for (const choice of ['pull', 'stay'] as const) this.paintLeverLabel(this.leverLabels[choice], choice)
    for (const actor of this.actors) {
      if (actor.spec.marker !== 'you' || !actor.marker) continue
      const { texture, width, height } = markerSprite('you', lang)
      actor.marker.material.map = texture
      actor.marker.scale.set(width * 0.034, height * 0.034, 1)
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced
  }

  /** Lets the player grab the lever, while a dilemma waits for an answer. */
  setInteractive(enabled: boolean): void {
    this.interactive = enabled
    if (enabled) return
    // A choice made some other way (a key, a button) ends a drag; the run moves the lever itself.
    if (this.drag && !this.run) this.leverTarget = LEVER_REST
    this.drag = null
    this.leverHover = false
    this.setCursor('')
  }

  // --------------------------------------------------------------- lever

  private canGrab(): boolean {
    return this.interactive && this.lever.visible && !this.run && !this.disposed
  }

  private setCursor(cursor: string): void {
    this.renderer.domElement.style.cursor = cursor
  }

  /** Keeps a drag's events coming even off the canvas; a pointer that is already gone just can't be held. */
  private hold(pointerId: number, held: boolean): void {
    const canvas = this.renderer.domElement
    try {
      if (held) canvas.setPointerCapture(pointerId)
      else if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
    } catch {
      // Nothing to hold on to: the drag still works while the pointer stays over the canvas.
    }
  }

  private pointerAt(event: PointerEvent): ScreenPoint {
    const rect = this.renderer.domElement.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  private overLever(point: ScreenPoint): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    this.raycaster.setFromCamera(new Vector2((point.x / rect.width) * 2 - 1, 1 - (point.y / rect.height) * 2), this.camera)
    return this.raycaster.intersectObject(this.leverHit, false).length > 0
  }

  /** Where the knob is, in the world, with the arm at `angle`. */
  private knobAt(angle: number): Vector3 {
    this.lever.updateWorldMatrix(true, false)
    return this.lever.localToWorld(new Vector3(-Math.sin(angle) * KNOB_REACH, ARM_PIVOT + Math.cos(angle) * KNOB_REACH, 0))
  }

  /** Where the knob is on screen with the arm at `angle`. */
  private knobOnScreen(angle: number): ScreenPoint {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const knob = this.knobAt(angle).project(this.camera)
    return { x: ((knob.x + 1) / 2) * rect.width, y: ((1 - knob.y) / 2) * rect.height }
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.canGrab()) return
    const point = this.pointerAt(event)
    if (!this.overLever(point)) return
    event.preventDefault()
    this.hold(event.pointerId, true)
    this.drag = { pointerId: event.pointerId, state: startDrag(point, this.knobOnScreen(LEVER_REST), this.knobOnScreen(-LEVER_REST)) }
    this.setCursor('grabbing')
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    const drag = this.drag
    if (!drag || drag.pointerId !== event.pointerId) return
    this.drag = null
    this.hold(event.pointerId, false)
    const choice = releaseChoice(drag.state)
    this.leverTarget = choice === 'pull' ? -LEVER_REST : LEVER_REST
    this.setCursor(this.leverHover ? 'grab' : '')
    this.onLever?.(choice)
  }

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return
    this.drag = null
    this.leverTarget = LEVER_REST
    this.setCursor('')
  }

  /**
   * The words beside the lever: shown while it can be grabbed, each next to
   * where the knob goes for it, level on screen and sized in whole art pixels.
   */
  private updateLeverLabels(): void {
    const show = this.canGrab()
    const progress = this.drag?.state.moved ? this.drag.state.progress : null
    const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion)
    const up = new Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion)
    // Narrow frames see the set from further off: one label pixel per art pixel keeps the words on screen.
    const pixel = this.aspect < 1.6 ? 1 : LABEL_PIXEL
    this.camera.updateMatrixWorld()
    for (const choice of ['pull', 'stay'] as const) {
      const label = this.leverLabels[choice]
      label.visible = show
      if (!show) continue
      const knob = this.knobAt(choice === 'pull' ? -LEVER_REST : LEVER_REST)
      const artPixel = (2 * this.camera.position.distanceTo(knob) * Math.tan(MathUtils.degToRad(this.camera.fov) / 2)) / Math.max(1, this.pipeline.height)
      const { width, height } = leverLabel(choice, this.lang)
      label.scale.set(width * pixel * artPixel, height * pixel * artPixel, 1)
      const side = choice === 'pull' ? 1 : -1
      label.center.set(choice === 'pull' ? 0 : 1, 0.5)
      label.position.copy(knob).addScaledVector(right, side * LABEL_GAP * artPixel)
      // Where the word would run off the frame beside the knob, it hangs above it instead.
      const end = label.position.clone().addScaledVector(right, side * width * pixel * artPixel).project(this.camera)
      if (Math.abs(end.x) > 0.97) {
        label.center.set(0.5, 0)
        label.position.copy(knob).addScaledVector(up, LABEL_GAP * artPixel)
      }
      const bob = this.reducedMotion ? 0 : Math.sin(this.time * 2.4 + (choice === 'pull' ? 0 : Math.PI)) * artPixel
      label.position.addScaledVector(up, bob)
      const lit = choice === 'pull' ? progress : progress === null ? null : 1 - progress
      label.material.opacity = lit === null ? (this.leverHover || this.drag ? 1 : 0.85) : 0.35 + 0.65 * lit
    }
  }

  // ----------------------------------------------------------------- run

  /** Plays the outcome of a choice; resolves once the dust settles. */
  play(choice: TrolleyChoice): Promise<void> {
    if (!this.dilemma) return Promise.resolve()
    if (this.run) return Promise.resolve()
    this.drag = null
    this.setCursor('')
    const special = this.dilemma.special
    const drift = special === 'drift' && choice === 'pull'
    const push = special === 'footbridge' && choice === 'pull'
    const route = special === 'footbridge' || choice === 'stay' ? ROUTES.A : ROUTES.B
    if (this.arrival) {
      this.arrival = null
      this.placeTram(LAYOUT.tramStart, ROUTES.A)
    }
    return new Promise((resolve) => {
      this.run = {
        choice,
        route,
        drift,
        push,
        phase: 'prepare',
        time: 0,
        speed: 0,
        front: LAYOUT.tramStart,
        driftAngle: 0,
        stopAt: null,
        braking: false,
        resolve,
      }
      if (choice === 'pull' && !push) {
        this.leverTarget = -LEVER_REST
        this.onEvent?.('lever')
      }
      if (push) this.onEvent?.('push')
    })
  }

  private finishRun(): void {
    const run = this.run
    this.run = null
    run?.resolve()
  }

  private updateRun(dt: number): void {
    const run = this.run
    if (!run) return
    run.time += dt
    if (run.phase === 'prepare') {
      if (run.push) this.updatePush(run.time)
      if (run.time >= (run.choice === 'pull' ? 0.5 : 0.3)) {
        run.phase = 'roll'
        run.time = 0
        this.onEvent?.('depart')
      }
      return
    }

    if (run.phase === 'roll') {
      if (run.push) this.updatePush(run.time + 0.5)
      if (run.braking) run.speed = Math.max(0, run.speed - 26 * dt)
      else run.speed = Math.min(11, run.speed + 7 * dt)
      run.front += run.speed * dt
      if (run.stopAt !== null) run.front = Math.min(run.front, run.stopAt)

      if (run.drift) {
        const into = run.front - (SWITCH_AT - 0.4)
        const target = into > 0 ? MathUtils.degToRad(72) : 0
        run.driftAngle = MathUtils.damp(run.driftAngle, target, 7, dt)
        if (into > 0 && into < 0.3) this.onEvent?.('drift')
      }
      this.placeTram(run.front, run.route, run.drift)

      if (run.speed > 4 && !this.reducedMotion && Math.random() < 0.9) {
        const wheel = run.route.pointAt(run.front - TRAM_HALF + 0.6)
        wheel.y = RAIL_TOP
        this.particles.burst('sparks', wheel, run.route.tangentAt(run.front), run.drift ? 3 : 1)
      }
      this.checkImpacts(run)

      const lastHit = Math.max(0, ...this.actors.filter((a) => a.state !== 'gone' && hitTracks(this.dilemma as AnyDilemma, run.choice).includes(a.track)).map((a) => a.routeDistance))
      const stopped = run.braking && run.speed === 0
      if (stopped || run.front > Math.max(lastHit + 10, run.route.length - 1)) {
        run.phase = 'after'
        run.time = 0
        this.onEvent?.('stop')
        if (!stopped) {
          this.tramVisible = false
          this.tram.visible = false
        }
        // Whoever the tram missed celebrates.
        let survivors = 0
        for (const actor of this.actors) {
          if (actor.state !== 'idle' && actor.state !== 'panic') continue
          actor.state = actor.spec.kind === 'person' || actor.spec.kind === 'cat' || actor.spec.kind === 'dog' || actor.spec.kind === 'duck' || actor.spec.kind === 'horse' ? 'cheer' : 'idle'
          if (actor.state === 'cheer') survivors += 1
        }
        if (survivors > 0) this.onEvent?.('cheer')
      }
      return
    }

    if (run.time > 0.75 && this.actors.every((a) => a.state !== 'flying')) this.finishRun()
  }

  /** The footbridge: the big man tips over the railing and drops onto the track. */
  private updatePush(time: number): void {
    const man = this.actors.find((actor) => actor.track === 'B')
    if (!man || man.state === 'flying' || man.state === 'gone') return
    const fall = MathUtils.clamp((time - 0.25) / 0.45, 0, 1)
    const top = FOOTBRIDGE_DECK
    man.root.position.y = MathUtils.lerp(top, STAND_HEIGHT, fall * fall)
    man.body.rotation.x = MathUtils.lerp(0, 0.5, Math.min(1, time / 0.3)) * (1 - fall) + fall * 0.15
    if (fall >= 1 && this.run && this.run.stopAt === null) {
      // The tram will stop just behind him.
      this.run.stopAt = man.routeDistance + 0.9
      if (man.marker) man.marker.visible = false
    }
  }

  private checkImpacts(run: Run): void {
    const dilemma = this.dilemma
    if (!dilemma) return
    const hit = hitTracks(dilemma, run.choice)
    const direction = run.route.tangentAt(run.front)
    for (const actor of this.actors) {
      if (actor.state === 'flying' || actor.state === 'gone') continue
      let onPath = hit.includes(actor.track)
      if (dilemma.special === 'footbridge') onPath = actor.track === 'A' ? !run.push : run.push
      if (!onPath) continue
      if (dilemma.special === 'footbridge' && actor.track === 'B' && actor.root.position.y > STAND_HEIGHT + 0.2) continue
      const reach = run.drift ? 1.2 : 0.3
      if (run.front >= actor.routeDistance - reach) {
        this.knock(actor, direction, run.speed)
        if (dilemma.special === 'footbridge' && actor.track === 'B') {
          run.braking = true
          this.onEvent?.('brake')
        }
      } else if (actor.routeDistance - run.front < 7 && actor.state === 'idle') {
        actor.state = 'panic'
      }
    }
  }

  private knock(actor: ActorRig, direction: Vector3, speed: number): void {
    const at = actor.root.position.clone()
    at.y += actor.height * 0.45
    this.particles.burst('poof', at, direction, actor.spec.kind === 'duck' ? 2 : 1)
    this.particles.burst('stars', at, direction)
    if (actor.spec.kind === 'server' || actor.spec.kind === 'phone' || actor.spec.kind === 'cookie' || actor.spec.kind === 'teapot' || actor.spec.kind === 'coffeePlant') {
      this.particles.burst('debris', at, direction, 1.5)
    }
    if (actor.marker) actor.marker.visible = false
    this.onEvent?.('impact', { kind: actor.spec.kind })
    if (!this.reducedMotion) this.shake = Math.min(0.35, this.shake + 0.22)
    if (this.reducedMotion) {
      actor.state = 'gone'
      actor.root.visible = false
      return
    }
    const sideways = new Vector3(-direction.z, 0, direction.x).multiplyScalar((Math.random() - 0.5) * 3)
    actor.velocity.copy(direction).multiplyScalar(speed * 0.55 + 2.5).add(sideways)
    actor.velocity.y = 5 + Math.random() * 2.5
    actor.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14)
    actor.state = 'flying'
    actor.timer = 0
  }

  // ---------------------------------------------------------------- tram

  private placeTram(front: number, route: Path, drift = false): void {
    this.tramFront = front
    let frontBogie: Vector3
    let rearBogie: Vector3
    if (drift && front > SWITCH_AT - 0.4) {
      // Sliding sideways between both tracks.
      const a = ROUTES.A.pointAt(front - (TRAM_HALF - BOGIE))
      const b = ROUTES.B.pointAt(front - (TRAM_HALF - BOGIE))
      frontBogie = a.add(b).multiplyScalar(0.5)
      const ra = ROUTES.A.pointAt(front - (TRAM_HALF + BOGIE))
      const rb = ROUTES.B.pointAt(front - (TRAM_HALF + BOGIE))
      rearBogie = ra.add(rb).multiplyScalar(0.5)
    } else {
      frontBogie = route.pointAt(front - (TRAM_HALF - BOGIE))
      rearBogie = route.pointAt(front - (TRAM_HALF + BOGIE))
    }
    this.tram.position.addVectors(frontBogie, rearBogie).multiplyScalar(0.5)
    this.tram.position.y = TRAM_Y
    const yaw = Math.atan2(frontBogie.x - rearBogie.x, frontBogie.z - rearBogie.z)
    this.tram.rotation.set(0, yaw + (this.run?.drift ? -this.run.driftAngle : 0), 0)
  }

  // --------------------------------------------------------------- frame

  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    this.pipeline.setSize(cssWidth, cssHeight, devicePixelRatio)
    this.aspect = cssWidth / Math.max(1, cssHeight)
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible || this.disposed) return
    this.visible = visible
    this.renderer.setAnimationLoop(visible ? this.frame : null)
    this.lastFrame = 0
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.drag) {
      if (event.pointerId === this.drag.pointerId) this.leverTarget = leverAngle(moveDrag(this.drag.state, this.pointerAt(event)), LEVER_REST)
      return
    }
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    this.pointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    this.pointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    if (event.pointerType !== 'mouse') return
    const hover = this.canGrab() && this.overLever(this.pointerAt(event))
    if (hover === this.leverHover) return
    this.leverHover = hover
    this.setCursor(hover ? 'grab' : '')
  }

  private readonly onPointerLeave = (): void => {
    this.pointer.tx = 0
    this.pointer.ty = 0
    if (this.drag || !this.leverHover) return
    this.leverHover = false
    this.setCursor('')
  }

  private updateCamera(dt: number): void {
    const aspect = this.aspect
    // Narrow frames keep the essentials (tram front to the last victim) and crop the tram's tail.
    const t = MathUtils.clamp((aspect - 1.0) / 1.8, 0, 1)
    const coverage = MathUtils.lerp(12.4, 17.2, t)
    const shiftX = MathUtils.lerp(2.3, 0, t)
    const fov = aspect >= 2.8 ? this.baseCamera.fov : MathUtils.radToDeg(2 * Math.atan(coverage / 2 / (CAMERA_DISTANCE * aspect)))

    const motion = this.reducedMotion ? 0 : 1
    this.pointer.x = MathUtils.damp(this.pointer.x, this.pointer.tx * motion, 3, dt)
    this.pointer.y = MathUtils.damp(this.pointer.y, this.pointer.ty * motion, 3, dt)
    const swayX = Math.sin(this.time * 0.31) * 0.18 * motion + this.pointer.x * 0.45
    const swayY = Math.sin(this.time * 0.23) * 0.08 * motion - this.pointer.y * 0.22
    const shake = this.shake * motion
    const shakeX = (Math.random() - 0.5) * shake
    const shakeY = (Math.random() - 0.5) * shake
    this.shake = Math.max(0, this.shake - dt * 1.4)

    let follow = 0
    if (this.run && this.run.phase !== 'prepare' && !this.reducedMotion) follow = MathUtils.clamp((this.tramFront - LAYOUT.tramStart) * 0.06, 0, 0.9)
    const lift = this.cameraLift

    const { position, target } = this.baseCamera
    this.camera.position.set(position.x + shiftX + swayX + follow + shakeX, position.y + swayY + lift + shakeY, position.z)
    this.camera.lookAt(target.x + shiftX + swayX * 0.3 + follow, target.y + lift * 0.9, target.z)
    this.camera.aspect = aspect
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()

    // Aim the backdrop so the bridge deck sits just above the wall, whatever the frame's shape.
    const wallNdc = WALL_TOP.clone().project(this.camera).y
    const back = this.baseBack
    const backFov = fov * BACK_FOV_RATIO
    const eye = new Vector3(back.position.x + shiftX * 0.6 + swayX * 0.35, back.position.y + swayY * 0.25, back.position.z)
    const toDeck = Math.atan2(BRIDGE_DECK.y - eye.y, eye.z - BRIDGE_DECK.z)
    const pitch = toDeck - Math.atan(Math.min(0.95, wallNdc + 0.07) * Math.tan(MathUtils.degToRad(backFov) / 2))
    this.backCamera.position.copy(eye)
    this.backCamera.lookAt(eye.x + swayX * 0.1, eye.y + Math.tan(pitch) * 30, eye.z - 30)
    this.backCamera.aspect = aspect
    this.backCamera.fov = backFov
    this.backCamera.updateProjectionMatrix()
  }

  private updateActors(dt: number): void {
    const time = this.time
    for (const actor of this.actors) {
      const { body, root } = actor
      if (actor.state === 'gone') continue
      if (actor.state === 'flying') {
        actor.timer += dt
        actor.velocity.y -= 16 * dt
        root.position.addScaledVector(actor.velocity, dt)
        body.rotation.x += actor.spin.x * dt
        body.rotation.y += actor.spin.y * dt
        body.rotation.z += actor.spin.z * dt
        const fade = MathUtils.clamp((actor.timer - 0.75) / 0.3, 0, 1)
        body.scale.setScalar(actor.baseScale * (1 - fade))
        if (fade >= 1) {
          actor.state = 'gone'
          root.visible = false
        }
        continue
      }
      const motion = this.reducedMotion ? 0 : 1
      const panic = actor.state === 'panic'
      const cheer = actor.state === 'cheer'
      const t = time + actor.phase
      body.position.y = (panic ? Math.abs(Math.sin(t * 13)) * 0.14 : cheer ? Math.abs(Math.sin(t * 7)) * 0.1 : Math.sin(t * 2.2) * 0.012) * motion
      if (actor.armR && actor.armL) {
        if (panic) {
          actor.armR.rotation.set(0, 0, -2.4 + Math.sin(t * 18) * 0.5 * motion)
          actor.armL.rotation.set(0, 0, 2.4 - Math.sin(t * 18) * 0.5 * motion)
        } else if (cheer) {
          actor.armR.rotation.set(0, 0, -2.6 + Math.sin(t * 7) * 0.2 * motion)
          actor.armL.rotation.set(0, 0, 2.6 - Math.sin(t * 7) * 0.2 * motion)
        } else {
          actor.armR.rotation.copy(actor.restR)
          actor.armL.rotation.copy(actor.restL)
          actor.armR.rotation.x += Math.sin(t * 2.6) * 0.06 * motion
          if (actor.spec.kind === 'person' && actor.spec.pose === 'cheer') {
            actor.armR.rotation.z += Math.sin(t * 6) * 0.25 * motion
            actor.armL.rotation.z -= Math.sin(t * 6) * 0.25 * motion
          }
        }
      }
      if (actor.tail) {
        const wag = actor.spec.kind === 'dog' ? Math.sin(t * 16) * 0.55 : Math.sin(t * 2.4) * 0.4
        actor.tail.rotation.y = wag * motion
      }
      if (actor.marker && actor.marker.visible) {
        const pop = actor.spec.marker === 'heart' ? 1 + Math.max(0, Math.sin(t * 2.1)) * 0.12 : 1
        actor.marker.position.set(root.position.x, root.position.y + actor.markerBase + Math.sin(t * 2.5) * 0.06 * motion + (panic ? 0.15 : 0), root.position.z)
        const { width, height } = markerSprite(actor.spec.marker ?? 'heart', this.lang)
        actor.marker.scale.set(width * 0.034 * pop, height * 0.034 * pop, 1)
      }
    }
  }

  private updateGlow(): void {
    const time = this.time
    for (const glow of this.glowMaterials) {
      if (glow.kind === 'led') glow.material.emissiveIntensity = glow.base * (0.4 + 0.6 * (Math.sin(time * 7 + glow.base) > 0 ? 1 : 0.3))
      else if (glow.kind === 'beacon') glow.material.emissiveIntensity = glow.base * (Math.sin(time * 3) > 0.2 ? 1 : 0.15)
      else glow.material.emissiveIntensity = glow.base * (0.92 + Math.sin(time * 0.7 + glow.base * 10) * 0.08)
    }
  }

  private readonly frame = (now: number): void => {
    if (this.disposed || tooSoon(this.quality, now, this.lastFrame)) return
    // Clamped: a long pause (a background tab) or a clock hiccup never makes a frame jump or run backwards.
    const dt = this.lastFrame === 0 ? 1 / 60 : MathUtils.clamp((now - this.lastFrame) / 1000, 0, this.quality.maxStep)
    this.lastFrame = now
    this.time += dt

    if (this.arrival) {
      const arrival = this.arrival
      arrival.time += dt
      const t = Math.min(1, arrival.time / arrival.duration)
      const eased = 1 - Math.pow(1 - t, 3)
      this.placeTram(MathUtils.lerp(arrival.from, LAYOUT.tramStart, eased), ROUTES.A)
      if (t >= 1) {
        this.arrival = null
        this.onEvent?.('bell')
      }
    } else if (!this.run && this.tramVisible) {
      this.placeTram(LAYOUT.tramStart, ROUTES.A)
      // Idling: a faint shudder and, now and then, the bell.
      if (!this.reducedMotion) this.tram.position.y += Math.sin(this.time * 38) * 0.004
      if (this.time > this.nextBell) {
        this.onEvent?.('bell')
        this.nextBell = this.time + 9 + Math.random() * 6
      }
    }
    this.updateRun(dt)

    this.leverAngle = this.reducedMotion ? this.leverTarget : MathUtils.damp(this.leverAngle, this.leverTarget, 16, dt)
    if (this.leverArm) this.leverArm.rotation.z = this.leverAngle
    // The switch follows the lever as it turns, dragged or pulled.
    this.switchRails.update((LEVER_REST - this.leverAngle) / (2 * LEVER_REST))

    this.updateActors(dt)
    this.particles.update(dt)
    this.fireflies.update(this.time)
    this.updateGlow()
    this.updateCamera(dt)
    this.updateLeverLabels()
    this.pipeline.render({ main: this.main, mainCamera: this.camera, back: this.back, backCamera: this.backCamera, overlay: this.overlay })
  }

  /** The current frame at art resolution (for the portal's cover image). */
  capture(): ReturnType<PixelPipeline['readPixels']> {
    return this.pipeline.readPixels()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.finishRun()
    this.renderer.setAnimationLoop(null)
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerCancel)
    this.clearActors()
    ;(this.leverHit.material as Material).dispose()
    for (const label of Object.values(this.leverLabels)) label.material.dispose()
    this.particles.dispose()
    this.fireflies.dispose()
    this.pipeline.dispose()
    for (const scene of [this.main, this.back]) {
      scene.traverse((object) => {
        const mesh = object as Mesh
        if (mesh.isMesh) mesh.geometry.dispose()
      })
    }
    disposeActorMaterials()
    disposeToonMaterials()
    disposeMarkerSprites()
    this.renderer.dispose()
  }
}
