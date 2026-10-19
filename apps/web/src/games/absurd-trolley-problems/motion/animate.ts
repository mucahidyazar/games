/**
 * A tiny animation runner for the motion scenes: tweens that call back with
 * eased progress every frame, sequenced with async/await. Nothing here
 * touches React; the scenes write SVG attributes straight to their nodes.
 */

export type Ease = (t: number) => number

export const linear: Ease = (t) => t
export const easeInQuad: Ease = (t) => t * t
export const easeOutQuad: Ease = (t) => 1 - (1 - t) * (1 - t)
export const easeInCubic: Ease = (t) => t * t * t
export const easeOutCubic: Ease = (t) => 1 - (1 - t) ** 3
export const easeInOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
/** Overshoots a little, then settles: things that pop into place. */
export const easeOutBack: Ease = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2

interface Running {
  readonly finish: () => void
}

/**
 * Runs one scene's tweens. With `instant` (reduced motion, or a browser
 * without requestAnimationFrame) every tween jumps straight to its end;
 * `finish()` does the same to whatever is running, and to anything started
 * after it, when the scene goes away mid-run.
 */
export class Timeline {
  private readonly running = new Set<Running>()
  private done = false
  private instant: boolean

  constructor(instant: boolean) {
    this.instant = instant
  }

  get finished(): boolean {
    return this.done
  }

  setInstant(instant: boolean): void {
    this.instant = instant
  }

  tween(duration: number, update: (value: number) => void, ease: Ease = easeInOutCubic): Promise<void> {
    if (this.instant || this.done || duration <= 0 || typeof requestAnimationFrame !== 'function') {
      update(1)
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      let start: number | null = null
      let frame = 0
      const entry: Running = {
        finish: () => {
          cancelAnimationFrame(frame)
          this.running.delete(entry)
          update(1)
          resolve()
        },
      }
      const step = (now: number): void => {
        start ??= now
        const t = Math.min(1, (now - start) / duration)
        update(ease(t))
        if (t < 1) {
          frame = requestAnimationFrame(step)
          return
        }
        this.running.delete(entry)
        resolve()
      }
      this.running.add(entry)
      frame = requestAnimationFrame(step)
    })
  }

  wait(duration: number): Promise<void> {
    return this.tween(duration, () => undefined, linear)
  }

  /** Jumps whatever is running to its end; tweens started afterwards run as usual. */
  skip(): void {
    for (const entry of [...this.running]) entry.finish()
  }

  /** Jumps everything to its end for good: the scene is going away. */
  finish(): void {
    this.done = true
    this.skip()
  }
}

/** Rounds to two decimals, for attributes written every frame. */
export const round2 = (value: number): number => Math.round(value * 100) / 100

/** "translate(x y) rotate(a) scale(s)", rounded so the DOM isn't flooded with digits. */
export function transform(x: number, y: number, rotate = 0, scale = 1): string {
  const r = (value: number): number => Math.round(value * 100) / 100
  let out = `translate(${r(x)} ${r(y)})`
  if (rotate) out += ` rotate(${r(rotate)})`
  if (scale !== 1) out += ` scale(${r(scale)})`
  return out
}

/** Sets an attribute on a node that may already be gone. */
export function setAttr(node: Element | null | undefined, name: string, value: string | number): void {
  node?.setAttribute(name, String(value))
}
