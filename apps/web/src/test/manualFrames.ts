import { expect, vi } from 'vitest'

/**
 * Hands requestAnimationFrame to the test: frames run only when stepped,
 * with whatever clock the test sets. For tests only.
 */
export function manualFrames() {
  let now = 0
  let queue: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queue.push(callback)
    return queue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)

  const step = (ms = 16): void => {
    now += ms
    const due = queue
    queue = []
    for (const callback of due) callback(now)
  }

  return {
    step,
    /** Steps frames, letting promises settle between them, until `promise` resolves. */
    async until(promise: Promise<unknown>, ms = 40, limit = 3000): Promise<void> {
      let done = false
      void promise.then(() => {
        done = true
      })
      for (let i = 0; i < limit && !done; i++) {
        step(ms)
        for (let j = 0; j < 6; j++) await Promise.resolve()
      }
      expect(done).toBe(true)
    },
    /** Steps frames for `total` ms of scene time. */
    async run(total: number, ms = 40): Promise<void> {
      for (let elapsed = 0; elapsed < total; elapsed += ms) {
        step(ms)
        for (let j = 0; j < 6; j++) await Promise.resolve()
      }
    },
  }
}
