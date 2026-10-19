import { vi } from 'vitest'
import type { Actor, AnyDilemma, TrolleyChoice } from '@/games/absurd-trolley-problems/content/types'
import type { SceneEventDetail, TrolleySceneOptions } from '@/games/absurd-trolley-problems/scene/TrolleyScene'
import { hitTracks } from '@/games/absurd-trolley-problems/state/run'

/**
 * Stands in for the WebGL scene (jsdom has no WebGL): it remembers what it was
 * asked to show and, when a run plays, reports one impact per actor hit.
 */
export class FakeTrolleyScene {
  static instances: FakeTrolleyScene[] = []
  static failNext = false
  readonly options: TrolleySceneOptions
  dilemma: AnyDilemma | null = null
  trackA: readonly Actor[] = []
  settled: TrolleyChoice | null = null
  lang: string
  readonly setDilemma = vi.fn((dilemma: AnyDilemma, trackA: readonly Actor[], settled: TrolleyChoice | null = null) => {
    this.dilemma = dilemma
    this.trackA = trackA
    this.settled = settled
  })
  readonly resize = vi.fn()
  readonly setVisible = vi.fn()
  readonly setReducedMotion = vi.fn()
  interactive = false
  readonly setInteractive = vi.fn((enabled: boolean) => {
    this.interactive = enabled
  })
  readonly dispose = vi.fn()

  constructor(options: TrolleySceneOptions) {
    this.options = options
    this.lang = options.lang
  }

  static async create(options: TrolleySceneOptions): Promise<FakeTrolleyScene> {
    if (FakeTrolleyScene.failNext) {
      FakeTrolleyScene.failNext = false
      throw new Error('WebGL is not available')
    }
    const scene = new FakeTrolleyScene(options)
    FakeTrolleyScene.instances.push(scene)
    return scene
  }

  setLang(lang: string): void {
    this.lang = lang
  }

  play(choice: TrolleyChoice): Promise<void> {
    const dilemma = this.dilemma
    if (!dilemma) return Promise.resolve()
    const emit = (event: Parameters<NonNullable<TrolleySceneOptions['onEvent']>>[0], detail?: SceneEventDetail): void => this.options.onEvent?.(event, detail)
    emit(choice === 'pull' ? 'lever' : 'depart')
    const hit = hitTracks(dilemma, choice)
    const victims = [...(hit.includes('A') ? this.trackA : []), ...(hit.includes('B') ? dilemma.trackB : [])]
    for (const actor of victims) emit('impact', { kind: actor.kind })
    emit('stop')
    return Promise.resolve()
  }

  /** The player lets go of the lever in the scene. */
  releaseLever(choice: TrolleyChoice): void {
    if (this.interactive) this.options.onLever?.(choice)
  }

  static latest(): FakeTrolleyScene {
    const scene = FakeTrolleyScene.instances[FakeTrolleyScene.instances.length - 1]
    if (!scene) throw new Error('No scene was created')
    return scene
  }

  static reset(): void {
    FakeTrolleyScene.instances = []
    FakeTrolleyScene.failNext = false
  }
}
