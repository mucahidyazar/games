import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Lazily loaded dialogs and pages are transformed on first import; under a busy
// machine (the whole workspace testing in parallel) that can take over a second.
configure({ asyncUtilTimeout: 5000 })

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup()
})

/*
 * jsdom lacks a few browser APIs the game relies on. These minimal stand-ins
 * let components mount; behaviour worth asserting is tested at the engine level.
 */

const noop = (): void => {}
const gradient = { addColorStop: noop }

/** A 2D context that accepts every drawing call and remembers assigned properties. */
function createFakeContext(): CanvasRenderingContext2D {
  const state: Record<PropertyKey, unknown> = {}
  return new Proxy(state, {
    get(target, property) {
      if (property in target) return target[property]
      if (property === 'createLinearGradient' || property === 'createRadialGradient') return () => gradient
      if (property === 'measureText') return () => ({ width: 0 })
      return noop
    },
    set(target, property, value) {
      target[property] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

// Test files may opt into the node environment, where none of this exists.
if (typeof window !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: function getContext() {
      return createFakeContext()
    },
  })

  class FakeResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver ??= FakeResizeObserver

  if (!window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: noop,
        removeEventListener: noop,
        addListener: noop,
        removeListener: noop,
        dispatchEvent: () => false,
      }) as MediaQueryList
  }

  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
}
