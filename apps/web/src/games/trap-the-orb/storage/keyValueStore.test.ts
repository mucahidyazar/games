import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBrowserStore, readJson, writeJson } from './keyValueStore'
import { createMemoryStore } from './memoryStore'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('getBrowserStore', () => {
  it('returns localStorage when it works', () => {
    expect(getBrowserStore()).toBe(window.localStorage)
  })

  it('returns null when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })

    expect(getBrowserStore()).toBeNull()
  })
})

describe('readJson / writeJson', () => {
  it('round-trips values and reports failures instead of throwing', () => {
    const store = createMemoryStore()

    expect(writeJson(store, 'k', { a: 1 })).toBe(true)
    expect(readJson(store, 'k')).toEqual({ a: 1 })
    expect(readJson(store, 'missing')).toBeNull()
    expect(writeJson(createMemoryStore({}, { failWrites: true }), 'k', 1)).toBe(false)
  })
})
